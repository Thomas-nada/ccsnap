/*
  voting_drep.js
  --------------
  Dedicated logic for DRep based voting (Multi-Candidate).
  Refactored to use shared wallet_utils.

  FIX 1: Scoping error resolved by moving all critical helper functions to the top scope.
  FIX 2: Implemented requested UI consistency: "Clear Selections" button is now placed ABOVE the candidate list, matching ADA mode.
  FIX 3: ENHANCED BUTTON TEXT to clarify minimum required vs. maximum allowed selections.
*/

import { showMessage, buildApplicationDetails, openApplicationModal, closeApplicationModal, getDisplayType } from './ui.js'; 
import { createEl, VOTING_END, stringToHex, MIN_VOTING_POWER, MIN_VOTES, MAX_VOTES, NETWORK_NAME } from './utils.js'; // NEW: Imported MIN_VOTES, MAX_VOTES
import { getBech32StakeAddressFromHex } from './wallet_utils.js'; 

let walletApi = null;
let walletPollInterval = null;
let pollAttempts = 0;
let currentVotingPower = 0; 
let currentLovelace = 0;
let currentUserVote = null; 
let connectedAddress = null; 
let signingAddressHex = null; 
let selectedCandidates = []; // NEW: Array of {candidateId, candidateName} objects

let isListenerAttached = false;

const MAX_POLL_ATTEMPTS = 10; 
const WALLET_STORAGE_KEY = 'ccConnectedWalletDRep'; 
const isVotingClosed = Date.now() > VOTING_END;

// Global data to hold ballot state (required for refetching after vote)
// This variable is declared ONLY ONCE at the module level.
let currentBallotData = []; 


// =======================================================
// --- START: Core Helper Functions (TOP SCOPE) ---
// =======================================================

async function submitVoteToServer(data) {
    const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return await res.json();
}

function updateVoteButtonState() {
    const btn = document.getElementById('btn-submit-ballot');
    const resetBtn = document.getElementById('btn-reset-ballot');
    const infoText = document.getElementById('multi-vote-info');
    if (!btn || !resetBtn || !infoText) return;
    
    if (isVotingClosed || currentLovelace < MIN_VOTING_POWER) {
        btn.disabled = true;
        resetBtn.disabled = true;
        btn.textContent = isVotingClosed ? 'Voting Closed' : 'Ineligible to Vote';
        return;
    }

    const count = selectedCandidates.length;
    let message = `Selected ${count} candidate${count === 1 ? '' : 's'}.`;
    const remaining = MAX_VOTES - count;
    
    // Update card visual state based on selection limit
    document.querySelectorAll('.candidate-card').forEach(card => {
        const entryId = card.dataset.entryId;
        const isCurrentlySelected = selectedCandidates.some(c => c.candidateId === entryId);
        
        if (!isCurrentlySelected && selectedCandidates.length >= MAX_VOTES) {
             card.style.opacity = '0.5';
             card.style.cursor = 'not-allowed';
        } else {
             card.style.opacity = '1';
             card.style.cursor = 'pointer';
        }
        if (isCurrentlySelected) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    if (count < MIN_VOTES) {
        btn.disabled = true;
        btn.textContent = `Select ${MIN_VOTES - count} more candidate${MIN_VOTES - count === 1 ? '' : 's'} (Min)`;
        infoText.style.color = '#b45309'; // Warning color
    } else if (count > MAX_VOTES) {
        // This case should be prevented by the click handler, but as a fallback:
        btn.disabled = true;
        btn.textContent = 'Too many candidates selected';
        infoText.style.color = '#dc2626'; // Error color
    } else {
        // Condition where selection is valid (count >= MIN_VOTES and count <= MAX_VOTES)
        btn.disabled = false;
        
        const actionText = currentUserVote ? 'Sign & Update Vote' : 'Sign & Submit Vote';
        
        if (remaining > 0) {
            btn.textContent = `${actionText} (Can select ${remaining} more)`;
        } else {
            btn.textContent = `${actionText} (Max reached)`;
        }
        
        infoText.style.color = 'var(--text-muted)'; // Default color
    }
    
    // Update info text
    infoText.textContent = `${message} (Min: ${MIN_VOTES}, Max: ${MAX_VOTES})`;
}

function updateDRepUI(stakeAddr, network, icon, votingPower, isRegistered) { 
    const connectState = document.getElementById('wallet-connect-state');
    if (connectState) connectState.style.display = 'none';
    const detailsSection = document.getElementById('wallet-details-section');
    if (detailsSection) detailsSection.classList.remove('hidden');
    
    const table = document.querySelector('.wallet-table');
    if(table) {
        const labelRow1 = table.querySelector('tr:nth-child(1) .label-cell');
        if(labelRow1) labelRow1.textContent = "DRep ID";
        
        const labelRow3 = table.querySelector('tr:nth-child(3) .label-cell');
        if(labelRow3) labelRow3.textContent = "Delegated Power";
    }

    const displayAddr = stakeAddr;
    const shortAddr = stakeAddr.length > 20 ? stakeAddr.substring(0,12) + '...' + stakeAddr.slice(-6) : stakeAddr;
    document.getElementById('val-stake-cred').textContent = shortAddr;
    document.getElementById('val-network').textContent = network;
    
    const powerEl = document.getElementById('val-voting-power');
    const blockingEl = document.getElementById('eligibility-msg');
    
    const isBlocked = !isRegistered || currentLovelace < MIN_VOTING_POWER;

    if (!isBlocked) {
        blockingEl.textContent = `✓ DRep Eligibility Verified (${votingPower.toLocaleString()} Votes)`;
        blockingEl.style.color = '#16a34a'; 
        powerEl.textContent = `${votingPower.toLocaleString()} ₳`;
        powerEl.style.color = 'var(--primary)';
        
        if (!isVotingClosed) loadBallot();
    } else {
        blockingEl.textContent = `❌ Ineligible (Must be a Registered DRep with Min: ${MIN_VOTING_POWER} Lovelace)`;
        blockingEl.style.color = '#dc2626';
        powerEl.textContent = `${votingPower.toLocaleString()} ₳`;
        powerEl.style.color = '#dc2626';
        
        document.getElementById('ballot-container').innerHTML = `
            <div style="padding: 2rem; border: 1px dashed #f87171; border-radius: 8px; background: #fef2f2;">
                <p style="color: #b91c1c; font-weight: 600;">Voting Restricted</p>
                <p style="font-size:0.9rem;">Requirements not met: Must be a registered DRep with at least ${MIN_VOTING_POWER} Lovelace Voting Power.</p>
            </div>
        `;
    }

    const iconEl = document.getElementById('val-wallet-icon');
    if (icon && iconEl) {
        iconEl.src = icon;
        iconEl.classList.remove('hidden');
    }
}

async function castVoteInternal(walletApi, selectedCandidates, votingPower, signerAddress) {
    try {
        // 1. FETCH RAW HEX ADDRESS FOR SIGNING
        let signingAddressHex = null;
        try {
            const rewardAddresses = await walletApi.getRewardAddresses();
            if (rewardAddresses && rewardAddresses.length > 0) {
                signingAddressHex = rewardAddresses[0];
            }
        } catch (e) { console.error("Could not fetch raw address for signing", e); }

        if (!signingAddressHex) throw new Error("Could not retrieve signing address.");

        // NEW: Payload contains array of voted candidates
        const votePayload = {
            action: "multi-vote", // Changed action to multi-vote
            electionId: "cc-snap-2025",
            votedCandidates: selectedCandidates, // Array of {candidateId, candidateName}
            votingPower: votingPower,
            timestamp: Date.now()
        };
        let hex = stringToHex(JSON.stringify(votePayload));
        
        showMessage(`Please sign the multi-candidate ballot...`, 'success');
        
        // 2. SIGN USING THE HEX ADDRESS
        const signature = await walletApi.signData(signingAddressHex, hex); 
        console.log("Multi-Vote Signed:", signature);
        
        const signerBech32 = signerAddress; 

        const result = await submitVoteToServer({
            payload: votePayload,
            signature: signature,
            signer: signerBech32, 
            signer_bech32: signerBech32
        });
        if (result.status === 'ok') {
            showMessage(`Vote successfully cast for ${selectedCandidates.length} candidate(s)!`, 'success');
            return true;
        } else {
            throw new Error(result.error || "Submission failed");
        }
    } catch (error) {
        console.error("Voting Error:", error);
        
        let errorMessage = "Voting failed.";
        if (error.code === 2) { 
            errorMessage = "Transaction declined by user.";
        } else if (error.message) {
            errorMessage = `Voting failed: ${error.message}`;
        }

        showMessage(errorMessage, 'error');
        return false;
    }
}

async function handleVote(e) {
    if (e) e.preventDefault();
    if (isVotingClosed || currentLovelace < MIN_VOTING_POWER) return; 
    
    const count = selectedCandidates.length;

    if (count < MIN_VOTES || count > MAX_VOTES) {
        showMessage(`You must select between ${MIN_VOTES} and ${MAX_VOTES} candidates.`, 'error');
        return;
    }
    
    if (!walletApi) { showMessage('Please connect your wallet to vote.', 'error'); return; }
    
    if (currentUserVote) {
        const confirmChange = confirm(`You are about to REPLACE your previous DRep vote with ${count} new selection(s). Continue?`);
        if (!confirmChange) return;
    }

    await castVoteInternal(walletApi, selectedCandidates, currentVotingPower, connectedAddress).then(success => {
        if (success) {
            // After successful vote, update permanent status and re-render ballot
            currentUserVote = { 
                signer: connectedAddress, 
                payload: { votedCandidates: selectedCandidates.slice() } 
            };
            loadBallot();
        }
    });
}

async function fetchUserVote(address) {
    try {
        const res = await fetch('/api/votes');
        if (!res.ok) return;
        const votes = await res.json();
        const myVote = votes.find(v => v.signer === address); 
        
        selectedCandidates = []; // Reset selections
        currentUserVote = null;

        if (myVote) {
            currentUserVote = myVote;
            // The new payload structure uses 'votedCandidates' array
            if (myVote.payload && Array.isArray(myVote.payload.votedCandidates)) {
                selectedCandidates = myVote.payload.votedCandidates;
            }
        }
    } catch (e) {
        console.error("Error checking votes:", e);
    }
}

async function performDRepConnection(walletKey, isSilent) {
    console.log("Initiating DRep connection flow...");
    try {
        walletApi = await window.cardano[walletKey].enable();
        const networkId = await walletApi.getNetworkId();
        
        console.log(`Wallet Connected. Detected Network ID: ${networkId}`);

        // --- UPDATED NETWORK CHECK ---
        const targetIsMainnet = NETWORK_NAME === 'mainnet';
        const walletIsMainnet = (networkId == 1);

        if (targetIsMainnet && !walletIsMainnet) {
            throw new Error(`Wrong Network: App is on Mainnet, Wallet is on Testnet (ID: ${networkId}).`);
        }
        if (!targetIsMainnet && walletIsMainnet) {
            throw new Error(`Wrong Network: App is on Testnet, Wallet is on Mainnet (ID: ${networkId}).`);
        }
        // ------------------------------

        const networkName = (networkId == 0) ? "Testnet" : "Mainnet";
        let rawAddressHex = null; // Store Hex for signing
        let rawAddress = null; // Store raw value from wallet

        try {
            const rewardAddresses = await walletApi.getRewardAddresses();
            if (rewardAddresses && rewardAddresses.length > 0) {
                rawAddress = rewardAddresses[0];
                rawAddressHex = rawAddress.startsWith('stake') ? null : rawAddress; // Only assign if it looks like hex
            }
        } catch (e) { console.warn("getRewardAddresses failed", e); }
        
        // Fallback to change address to ensure we capture the hex for signing
        if (!rawAddressHex) {
             try {
                const addresses = await walletApi.getUsedAddresses();
                // This usually gives payment addresses, but often in hex format, which we can use for signing
                rawAddressHex = addresses[0]; 
            } catch (e) { }
        }


        if (!rawAddress) throw new Error("Could not retrieve wallet address.");
        // If rawAddressHex is still null, set it to rawAddress (it might be bech32, which will fail later, but we need a value)
        if (!rawAddressHex) {
            rawAddressHex = rawAddress;
        }

        // Convert the address for API/Server consumption (Bech32)
        if (!rawAddress.startsWith('stake')) {
            connectedAddress = getBech32StakeAddressFromHex(rawAddress);
            if (!connectedAddress) throw new Error("Address format not supported");
        } else {
            connectedAddress = rawAddress;
        }

        signingAddressHex = rawAddressHex; // Use the raw hex derived above

        const walletObj = window.cardano[walletKey];
        const iconSrc = walletObj.icon;

        let finalVotingPower = 0;
        let finalLovelace = 0;
        let isRegisteredDRep = false;

        try {
            const payload = { 
                _stake_addresses: [connectedAddress],
                _action: 'drep_power'
            };
            
        const koiosRes = await fetch("/api/proxy/koios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const koiosData = await koiosRes.json();

            if (Array.isArray(koiosData) && koiosData.length > 0) {
                const accountData = koiosData[0];
                const powerLovelace = Number(accountData.delegated_drep_power || "0");
                
                if (!isNaN(powerLovelace)) {
                    finalLovelace = powerLovelace;
                    finalVotingPower = powerLovelace / 1_000_000;
                    if(finalLovelace >= 0) isRegisteredDRep = true; 
                }
            }
        } catch (err) {
            // Production-ready addition: Ensure lovelace remains 0 on any network failure
            console.error("DRep Power fetch failed due to network error:", err);
            finalLovelace = 0;
            finalVotingPower = 0;
        }

        currentVotingPower = finalVotingPower;
        currentLovelace = finalLovelace;
        
        // NEW: Fetch and set selectedCandidates from previous vote
        await fetchUserVote(connectedAddress); 
        updateDRepUI(connectedAddress, networkName, iconSrc, finalVotingPower, isRegisteredDRep);
        
        if(!isSilent) showMessage(isRegisteredDRep ? 'DRep Verified!' : 'Wallet Connected (No DRep Power)', isRegisteredDRep ? 'success' : 'warning');
        
        return true;

    } catch (error) {
        console.error('Connection failed:', error);
        if (!isSilent) showMessage(error.message || 'Connection failed.', 'error');
        return false;
    }
}

function startWalletDetection() {
    if (checkWallets(true)) {
        attemptAutoConnect();
        return;
    }
    
    const connectBtn = document.getElementById('btn-connect-wallet');
    if (connectBtn) {
        connectBtn.textContent = "Detecting Wallets...";
        connectBtn.disabled = true;
    }
    
    if (walletPollInterval) clearInterval(walletPollInterval);

    walletPollInterval = setInterval(() => {
        pollAttempts++;
        if (checkWallets(true)) {
            clearInterval(walletPollInterval);
            attemptAutoConnect(); 
        } else if (pollAttempts >= MAX_POLL_ATTEMPTS) {
            clearInterval(walletPollInterval);
            if (connectBtn) {
                connectBtn.textContent = "No Wallet Found";
                showMessage('No Cardano wallet extension detected.', 'error');
            }
        }
    }, 500);
}

// --- START: Wallet Handler Definitions ---

async function handleConnectWallet() {
    const selectEl = document.getElementById('wallet-select');
    const btn = document.getElementById('btn-connect-wallet');
    
    if (typeof window.cardano === 'undefined' || !selectEl.value) {
        showMessage('Please select a wallet.', 'error');
        return;
    }

    let walletKey = selectEl.value;
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Verifying DRep Status...';

    const success = await performDRepConnection(walletKey, false);

    if (!success) {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function handleDisconnectWallet() {
    walletApi = null;
    currentVotingPower = 0;
    currentLovelace = 0;
    currentUserVote = null; 
    connectedAddress = null;
    selectedCandidates = []; // NEW: Reset
    localStorage.removeItem(WALLET_STORAGE_KEY);
    
    const connectState = document.getElementById('wallet-connect-state');
    const detailsSection = document.getElementById('wallet-details-section');
    const btn = document.getElementById('btn-connect-wallet');
    
    if (detailsSection) detailsSection.classList.add('hidden');
    if (connectState) connectState.style.display = 'block';
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔌 Connect Wallet';
    }
    
    const table = document.querySelector('.wallet-table');
    if(table) {
        const labelRow1 = table.querySelector('tr:nth-child(1) .label-cell');
        if(labelRow1) labelRow1.textContent = "Voter Key Hash";
        const labelRow3 = table.querySelector('tr:nth-child(3) .label-cell');
        if(labelRow3) labelRow3.textContent = "Voting Power";
    }

    showMessage('Wallet disconnected.', 'success');
}

function handleResetBallot() {
    selectedCandidates = [];
    updateVoteButtonState();
    // Visually update cards by re-triggering render state
    document.querySelectorAll('.candidate-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    showMessage('Selections cleared. Start a new ballot.', 'info');
}

// --- END: Wallet Handler Definitions ---


function loadBallot() {
    fetch('/api/applications')
        .then(res => res.json())
        .then(apps => {
            currentBallotData = apps; // Cache data
            renderBallot(apps);
        })
        .catch(err => console.error('Failed to load ballot:', err));
}


function renderBallot(apps) {
    const container = document.getElementById('ballot-container');
    if (!container) return; 
    
    if (container.innerHTML.includes('Restricted')) return;

    // Remove previous Submit button and info text if they exist
    document.getElementById('vote-submit-container')?.remove();

    // --- CLEANUP: Check if the old top controls container exists and remove it ---
    document.getElementById('top-vote-controls')?.remove();


    // --- NEW: TOP CONTROL CONTAINER (Reset Button + Info Text) ---
    const topControlsContainer = createEl('div', { 
        id: 'top-vote-controls', 
        style: 'margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; text-align: center;' 
    });

    // 1. Add multi-selection info text (placed first)
    const infoText = createEl('p', { 
        id: 'multi-vote-info', 
        style: 'color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; text-align: left;' 
    }, [
        `Select between ${MIN_VOTES} and ${MAX_VOTES} candidates below.`
    ]);
    topControlsContainer.appendChild(infoText);
    
    // NEW Reset Button (placed second, above the candidates list)
    const resetBtnTop = createEl('button', {
        id: 'btn-reset-ballot',
        type: 'button',
        class: 'btn secondary',
        style: 'padding: 0.5rem 1.25rem; font-size: 0.9rem; width: 100%;'
    }, ['Clear All Selections']);
    
    resetBtnTop.addEventListener('click', handleResetBallot);
    topControlsContainer.appendChild(resetBtnTop);

    // Insert top controls above the ballot container
    container.parentNode.insertBefore(topControlsContainer, container);
    
    container.innerHTML = '';
    if (!apps || apps.length === 0) {
        container.innerHTML = '<p>No candidates available.</p>';
        return;
    }
    
    const isBlocked = isVotingClosed || currentLovelace < MIN_VOTING_POWER;

    apps.forEach(app => {
        const entryId = app.entryId;
        const name = app.data.fullName || app.data.orgName || app.data.consortiumName;
        // Check if currently selected (for the draft ballot)
        const isSelected = selectedCandidates.some(c => c.candidateId === entryId);
        // Check if previously voted (for the permanent tag)
        const wasVotedFor = currentUserVote && currentUserVote.payload.votedCandidates.some(c => c.candidateId === entryId);

        const cardClasses = ['candidate-card'];
        if (isSelected) cardClasses.push('selected');
        if (wasVotedFor) cardClasses.push('voted');
        
        const card = createEl('div', { 
            class: cardClasses.join(' '),
            dataset: { entryId: entryId }
        });
        
        // --- NEW: Toggle selection on click ---
        card.addEventListener('click', () => {
            if (isBlocked) return;
            
            const candidateInfo = { candidateId: entryId, candidateName: name };
            const index = selectedCandidates.findIndex(c => c.candidateId === entryId);
            
            if (index === -1) {
                // Select Candidate
                if (selectedCandidates.length >= MAX_VOTES) {
                    showMessage(`You can only select a maximum of ${MAX_VOTES} candidates.`, 'error');
                    return;
                }
                selectedCandidates.push(candidateInfo);
                card.classList.add('selected');
            } else {
                // Deselect Candidate
                selectedCandidates.splice(index, 1);
                card.classList.remove('selected');
            }
            updateVoteButtonState();
        });
        
        // Candidate Name and Voted Tag
        const nameEl = createEl('div', { class: 'candidate-name', style: 'display: flex; align-items: center;' }, [
            document.createTextNode(name)
        ]);
        
        if (wasVotedFor) {
            nameEl.appendChild(createEl('span', { class: 'voted-tag' }, ['VOTED']));
        }
        
        const typeEl = createEl('div', { class: 'candidate-type' }, [getDisplayType(app.applicationType)]);
        
        // --- REMOVED CHECKBOX INPUT ---
        
        card.appendChild(nameEl);
        card.appendChild(typeEl);
        
        container.appendChild(card);
    });
    
    // 3. Add Submit Button (placed below the candidate list)
    const submitContainer = createEl('div', { 
        id: 'vote-submit-container', 
        style: 'margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 2rem; text-align: center;' 
    });
    
    const submitBtn = createEl('button', { 
        id: 'btn-submit-ballot', 
        class: 'btn', 
        style: 'padding: 0.75rem 2rem; font-size: 1.1rem; width: 100%; max-width: 300px;' 
    }, ['Sign & Submit Vote']);
    
    submitBtn.addEventListener('click', handleVote);
    submitContainer.appendChild(submitBtn);

    // Re-insert the submit container (will be before the next section in vote.html)
    document.getElementById('wallet-details-section').appendChild(submitContainer);
    
    updateVoteButtonState();
}

export function initDRepVoting() {
    console.log("Initializing DRep Voting Logic...");
    
    const connectBtn = document.getElementById('btn-connect-wallet');
    const disconnectBtn = document.getElementById('btn-disconnect-wallet');
    
    const statusTitle = document.getElementById('voting-status-title');
    const statusDesc = document.getElementById('voting-status-desc');
    if (statusTitle) statusTitle.textContent = "DRep Voting Portal";
    if (statusDesc) statusDesc.textContent = `Connect your ${NETWORK_NAME.toUpperCase()} wallet to verify DRep status.`;

    if (isVotingClosed && statusTitle) {
        statusTitle.textContent = "DRep Voting Closed";
        statusTitle.style.color = "#b91c1c";
    }

    if (connectBtn) {
        if (!isListenerAttached) {
            connectBtn.addEventListener('click', handleConnectWallet);
            if (disconnectBtn) {
                disconnectBtn.addEventListener('click', handleDisconnectWallet);
            }
            isListenerAttached = true;
        }
        startWalletDetection();
    }
}