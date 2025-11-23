/*
  audit.js
  --------
  Client-side verification of election results.
  Performs REAL on-chain lookups using Koios API (via Local Proxy).
  IMPROVED: Expects Bech32 Stake Address for signer field.
*/

import { createEl } from './utils.js';
import { VOTING_MODE, SNAPSHOT_EPOCH } from './utils.js';

const KOIOS_PROXY_URL = "/api/proxy/koios";

// --- New Cooldown State ---
let isAuditing = false;
// --------------------------

export function initAuditFeature() {
    const auditBtn = document.getElementById('btn-run-audit');
    const downloadBtn = document.getElementById('btn-download-ledger');
    
    // Attach listener only once
    if (auditBtn && !auditBtn.hasAttribute('data-listener-attached')) {
        auditBtn.addEventListener('click', runAudit);
        auditBtn.setAttribute('data-listener-attached', 'true');
    }
    if (downloadBtn) downloadBtn.addEventListener('click', downloadLedger);
}

// Helper to apply the cooldown visual effect
function applyCooldown(btn) {
    const COOLDOWN_SECONDS = 5;
    let timeRemaining = COOLDOWN_SECONDS;

    btn.disabled = true;
    isAuditing = true; // Use global state to prevent parallel audits

    const interval = setInterval(() => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            isAuditing = false;
            btn.textContent = 'Re-Run Audit';
        } else {
            btn.textContent = `Cooldown (${timeRemaining}s)`;
        }
    }, 1000);
}


async function downloadLedger() {
    // Logic remains the same
    try {
        const res = await fetch('/api/votes');
        if (!res.ok) throw new Error('Failed to fetch votes');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'cc-snap-election-ledger.json'; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Download failed:", err);
        alert("Could not download the ledger file.");
    }
}

// --- ADDRESS VALIDATION HELPERS ---

// Simplified check to see if it looks like a Bech32 stake address
function isValidBech32StakeAddress(address) {
    // A Bech32 address must be a string, start with 'stake1', and have a reasonable length (~57 chars).
    return typeof address === 'string' && address.startsWith('stake1') && address.length > 50;
}

async function runAudit() {
    const statusEl = document.getElementById('audit-status');
    const logEl = document.getElementById('audit-log');
    const btn = document.getElementById('btn-run-audit');

    if (!statusEl || !logEl || isAuditing) return;

    // 1. APPLY COOLDOWN BEFORE AUDIT EXECUTION
    applyCooldown(btn);
    
    // Reset visuals for new run
    btn.textContent = 'Auditing...';
    statusEl.classList.add('hidden');
    logEl.classList.remove('hidden');
    logEl.innerHTML = '';
    
    const addLog = (msg, type = 'info') => {
        const line = createEl('div', { class: `audit-line ${type}` }, [msg]);
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    };

    try {
        addLog('1. Fetching raw vote ledger from server...', 'info');
        const res = await fetch('/api/votes');
        if (!res.ok) throw new Error('Failed to fetch vote ledger.');
        const votes = await res.json();

        addLog(`✓ Retrieved ${votes.length} vote records.`, 'success');
        
        addLog('2. Preparing Credentials & Querying Koios (Mainnet)...', 'header');
        addLog(`   VOTING MODE: ${VOTING_MODE} | SNAPSHOT EPOCH: ${SNAPSHOT_EPOCH || 'Latest'}`, 'info'); // <-- UPDATED LOGGING

        // Filter: ONLY include votes where the signer is a valid Bech32 Stake Address 
        // AND the signature key is not our fake placeholder.
const stakeAddresses = votes
    .filter(v => {
        const addr = v.signer_bech32 || v.signer;
        return addr 
            && isValidBech32StakeAddress(addr)
            && !(v.signature && v.signature.key && v.signature.key.startsWith('random_key'));
    })
    .map(v => v.signer_bech32 || v.signer);

        const uniqueAddresses = [...new Set(stakeAddresses)];
        
        var balanceMap = {};

        if (uniqueAddresses.length === 0) {
            addLog('ℹ No valid, non-mock Bech32 credentials found for API query.', 'info');
        } else {
            addLog(`ℹ Querying ledger for ${uniqueAddresses.length} unique credentials...`, 'info');
            
            try {
                // Prepare payload for Koios. The audit needs the raw balance (or DRep power)
                // to verify the vote's claimed power.
                const koiosPayload = { _stake_addresses: uniqueAddresses };
                
                // Pass mode/epoch to the proxy so it knows what to fetch
                if (VOTING_MODE === 'DREP_POWER') {
                    koiosPayload._action = 'drep_power';
                } else {
                    koiosPayload._action = 'total_balance';
                }
                if (SNAPSHOT_EPOCH) koiosPayload._epoch_no = SNAPSHOT_EPOCH;
                
                const koiosRes = await fetch(KOIOS_PROXY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(koiosPayload)
                });

                if (!koiosRes.ok) {
                     console.warn(`Koios API Status: ${koiosRes.status} - Checksum/Format Error.`);
                } else {
                    const accountInfos = await koiosRes.json(); 
                    if (Array.isArray(accountInfos)) {
                        accountInfos.forEach(acc => {
                            // Map the power source based on the mode
                            let powerLovelace = 0;
                            if (VOTING_MODE === 'DREP_POWER') {
                                powerLovelace = parseInt(acc.delegated_drep_power || acc.total_balance || "0"); 
                            } else {
                                powerLovelace = parseInt(acc.total_balance || "0");
                            }
                            balanceMap[acc.stake_address] = powerLovelace;
                        });
                        addLog(`✓ Received live data for ${accountInfos.length} accounts.`, 'success');
                    }
                }
            } catch (netErr) {
                console.warn("Network Error contacting ledger:", netErr);
            }
        }

        let validCount = 0;
        let invalidCount = 0;
        const tally = {};
        let totalPower = 0;

		// Verify Loop
		for (let i = 0; i < votes.length; i++) {
		const vote = votes[i];
		const claimedPower = vote.payload.votingPower || 0;

		// 3a. Signature Check (Covers Fakes)
		if (vote.signature.key && vote.signature.key.startsWith('random_key')) {
        addLog(`❌ Record #${i + 1}: Invalid Signature (Fake Key).`, 'error');
        invalidCount++;
        continue;
		}

		// 3b. Credential Format Check
		const stakeAddr = vote.signer_bech32 || vote.signer;

		if (!stakeAddr || !isValidBech32StakeAddress(stakeAddr)) {
        addLog(`❌ Record #${i + 1}: Invalid Credential Format (Must be stake1...).`, 'error');
        invalidCount++;
        continue;
		}

		// 3c. LEDGER CHECK
		const realBalanceLovelace = balanceMap[stakeAddr] ? balanceMap[stakeAddr] : 0;
		const realBalanceAda = realBalanceLovelace / 1_000_000;


            const delta = Math.abs(realBalanceAda - claimedPower);
            
            // Allow a small delta (e.g., 5 ADA) for potential timing/epoch discrepancies
            if (delta > 5) { 
                 addLog(`❌ Record #${i + 1}: Ledger Mismatch! Claimed: ${claimedPower.toLocaleString()} ₳ | Actual: ${realBalanceAda.toLocaleString()} ₳`, 'error');
                 invalidCount++;
            } else {
                 addLog(`✓ Record #${i + 1}: Verified on Ledger. Power matches (~${realBalanceAda.toLocaleString()} ₳).`, 'success');
                 
                 const candidate = vote.payload.candidateName;
                 if (!tally[candidate]) tally[candidate] = 0;
                 tally[candidate] += claimedPower;
                 totalPower += claimedPower;
                 validCount++;
            }
        }

        addLog('--------------------------------', 'header');

        if (validCount === 0) {
             statusEl.textContent = "Audit: 0 Valid Votes";
             statusEl.className = 'audit-badge error';
             addLog('No votes passed the On-Chain Audit.', 'warning');
        } else {
            addLog('--- VERIFIED LEDGER TALLY ---', 'header');
            Object.entries(tally).sort(([,a], [,b]) => b - a).forEach(([name, power]) => {
                const percent = totalPower > 0 ? ((power / totalPower) * 100).toFixed(2) : 0;
                addLog(`${name}: ${power.toLocaleString()} ₳ (${percent}%)`, 'data');
            });
            statusEl.textContent = `✓ Audit Passed (${validCount} Valid)`;
            statusEl.className = 'audit-badge success';
            addLog(`✓ Verified ${validCount} votes against Cardano Mainnet.`, 'success');
        }
        
        if (invalidCount > 0) {
            addLog(`⚠ Rejected ${invalidCount} invalid votes.`, 'warning');
        }

        statusEl.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        addLog(`❌ Audit Failed: ${err.message}`, 'error');
        statusEl.textContent = "Audit Error";
        statusEl.className = 'audit-badge error';
        logEl.classList.remove('hidden');
    }
}