/*
  voting.js
  ---------
  Handles wallet connection, ballot rendering, and voting submission.
  Now focused entirely on the Wallet Interface.
*/

import { showMessage, buildApplicationDetails, openApplicationModal, closeApplicationModal } from './ui.js';
import { createEl, VOTING_END, VOTING_MODE, SNAPSHOT_EPOCH, stringToHex } from './utils.js'; 

let walletApi = null;
let walletPollInterval = null;
let pollAttempts = 0;
let currentVotingPower = 0; 
let currentUserVote = null; // Holds the user's currently recorded vote
let connectedAddress = null; 

let isListenerAttached = false;

const MAX_POLL_ATTEMPTS = 10; 
const WALLET_STORAGE_KEY = 'ccConnectedWallet'; 
const isVotingClosed = Date.now() > VOTING_END;

// --- USER PROVIDED BECH32 IMPLEMENTATION ---
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values) {
    const GENERATORS = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
    let chk = 1;
    for (let v of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) chk ^= GENERATORS[i];
        }
    }
    return chk;
}

function hrpExpand(hrp) {
    return [...hrp].map(c => c.charCodeAt(0) >> 5)
            .concat(0, [...hrp].map(c => c.charCodeAt(0) & 31));
}

function createChecksum(hrp, data) {
    const values = hrpExpand(hrp).concat(data, [0,0,0,0,0,0]);
    const mod = polymod(values) ^ 1;
    return Array.from({length: 6}, (_, i) => (mod >> 5 * (5 - i)) & 31);
}

function bech32Encode(hrp, data) {
    return hrp + "1" + data.concat(createChecksum(hrp, data)).map(v => CHARSET[v]).join('');
}

function convertBits(data, fromBits, toBits) {
    let acc = 0, bits = 0;
    const ret = [];
    const maxv = (1 << toBits) - 1;

    for (let value of data) {
        acc = (acc << fromBits) | value;
        bits += fromBits;
        while (bits >= toBits) {
            bits -= toBits;
            ret.push((acc >> bits) & maxv);
        }
    }

    if (bits > 0) {
        ret.push((acc << (toBits - bits)) & maxv);
    }

    return ret;
}

function getBech32StakeAddressFromHex(hex) {
    try {
        if (!hex || typeof hex !== 'string') return null;
        hex = hex.trim().toLowerCase();

        if (!/^[0-9a-f]+$/.test(hex)) {
            console.error("Invalid hex.");
            return null;
        }

        if (hex.length === 56) {
            hex = "e1" + hex;  // add mainnet header automatically
        } else if (hex.length === 58) {
            if (!hex.startsWith("e1")) {
                console.error("Not a mainnet hex (must start with e1).");
                return null;
            }
        } else {
            console.error("Hex must be 56 or 58 characters.");
            return null;
        }

        const bytes = new Uint8Array(hex.match(/../g).map(x => parseInt(x, 16)));
        const words = convertBits(bytes, 8, 5);
        return bech32Encode("stake", words);
    } catch (e) {
        console.error("Conversion error:", e);
        return null;
    }
}
// --- END USER IMPLEMENTATION ---


// --- WALLET MODE LOGIC ---

export function initVotingPage() {
    const connectBtn = document.getElementById('btn-connect-wallet');
    const disconnectBtn = document.getElementById('btn-disconnect-wallet');
    
    // Ensure the wallet mode container exists before initializing.
    if (!document.getElementById('wallet-mode')) return;

    if (isVotingClosed) {
        const title = document.getElementById('voting-status-title');
        const desc = document.getElementById('voting-status-desc');
        if (title) {
            title.textContent = "Voting is CLOSED";
            title.style.color = "#b91c1c"; 
        }
        if (desc) {
            desc.textContent = "The election period has ended. No new votes can be cast.";
        }
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
        console.log('Wallet Voting module initialized.');
    }
}

function startWalletDetection() {
    const statusDiv = document.getElementById('voting-placeholder');
    
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

function checkWallets(isPolling = false) {
    const selectContainer = document.getElementById('wallet-selection');
    const selectEl = document.getElementById('wallet-select');
    const connectBtn = document.getElementById('btn-connect-wallet');
    
    if (typeof window.cardano === 'undefined') return false;

    const availableWallets = [];
    for (const key in window.cardano) {
        const wallet = window.cardano[key];
        if (wallet && wallet.enable && (wallet.apiVersion || wallet.name)) {
            availableWallets.push({ key: key, name: wallet.name, icon: wallet.icon });
        }
    }

    if (availableWallets.length === 0) return false;
    
    if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = availableWallets.length > 1 ? "Select and Connect Wallet" : `Connect ${availableWallets[0].name}`;
        connectBtn.style.pointerEvents = 'auto';
        connectBtn.style.opacity = '1';
    }

    if (availableWallets.length > 1) {
        selectContainer.style.display = 'block';
        selectEl.innerHTML = '<option value="" disabled selected>Select a Wallet...</option>';
        availableWallets.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.key;
            opt.text = w.name.charAt(0).toUpperCase() + w.name.slice(1);
            selectEl.appendChild(opt);
        });
    } else {
        selectContainer.style.display = 'none';
        selectEl.innerHTML = `<option value="${availableWallets[0].key}" selected>${availableWallets[0].name}</option>`;
    }
    return true;
}

async function attemptAutoConnect() {
    const savedWalletKey = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!savedWalletKey) return;
    if (window.cardano && window.cardano[savedWalletKey]) {
        const selectEl = document.getElementById('wallet-select');
        if (selectEl) selectEl.value = savedWalletKey;
        await performWalletConnection(savedWalletKey, true);
    }
}

function parseLovelaceFromCBOR(hex) {
    try {
        const firstByte = parseInt(hex.substring(0, 2), 16);
        const majorType = firstByte >> 5;
        const additionalInfo = firstByte & 0x1F;

        if (majorType === 0) {
            if (additionalInfo < 24) return additionalInfo;
            else if (additionalInfo === 24) return parseInt(hex.substring(2, 4), 16);
            else if (additionalInfo === 25) return parseInt(hex.substring(2, 6), 16);
            else if (additionalInfo === 26) return parseInt(hex.substring(2, 10), 16);
            else if (additionalInfo === 27) { 
                const highPart = parseInt(hex.substring(2, 10), 16);
                const lowPart = parseInt(hex.substring(10, 18), 16);
                return (highPart * 4294967296) + lowPart;
            }
        } 
        if (majorType === 4) return parseLovelaceFromCBOR(hex.substring(2));
        return 0;
    } catch (e) {
        return 0;
    }
}

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
    btn.innerHTML = 'Connecting...';

    const success = await performWalletConnection(walletKey, false);

    if (!success) {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function performWalletConnection(walletKey, isSilent) {
    try {
        walletApi = await window.cardano[walletKey].enable();
        
        const networkId = await walletApi.getNetworkId();
        const networkName = networkId === 0 ? "Testnet (Preprod/Preview)" : "Mainnet";
        
        let finalAddress = null;

        // 1. Try direct Bech32 from wallet
        try {
            const rewardAddresses = await walletApi.getRewardAddresses();
            if (rewardAddresses && rewardAddresses.length > 0) {
                finalAddress = rewardAddresses[0];
            }
        } catch (e) { console.warn("getRewardAddresses failed", e); }

        // 2. Fallback: Get Hex change address and convert using user's logic
        if (!finalAddress) {
            try {
                const rawHex = await walletApi.getChangeAddress();
                if (rawHex && rawHex.length >= 56) {
                    const rawStakeHash = rawHex.slice(-56);
                    // Convert Hex to Bech32
                    finalAddress = getBech32StakeAddressFromHex(rawStakeHash);
                }
            } catch (e) { console.warn("getChangeAddress failed", e); }
        }

        if (!finalAddress) throw new Error("Could not retrieve wallet address.");
        
        connectedAddress = finalAddress;

        const walletObj = window.cardano[walletKey];
        const iconSrc = walletObj.icon;

        // --- VOTING POWER LOGIC BASED ON VOTING_MODE ---
        let koiosStakeAddr = connectedAddress;
        if (!connectedAddress.startsWith("stake")) {
            koiosStakeAddr = getBech32StakeAddressFromHex(
                connectedAddress.replace(/^e1/i, "").slice(-56)
            );
        }

        let finalVotingPower = 0;
        let powerSource = VOTING_MODE === 'DREP_POWER' ? 'Total Delegation' : 'ADA Balance';

        try {
            const payload = { _stake_addresses: [koiosStakeAddr] };
            
            // Set action for server proxy to dispatch
            payload._action = VOTING_MODE === 'DREP_POWER' ? 'drep_power' : 'total_balance';
            if (SNAPSHOT_EPOCH) payload._epoch_no = SNAPSHOT_EPOCH;

            const koiosRes = await fetch("/api/proxy/koios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const koiosData = await koiosRes.json();

            if (Array.isArray(koiosData) && koiosData.length > 0) {
                const accountData = koiosData[0];
                let totalPowerLovelace = 0;
                
                if (VOTING_MODE === 'DREP_POWER') {
                    // CRITICAL: Use delegated_drep_power field returned by the fixed server logic
                    totalPowerLovelace = Number(accountData.delegated_drep_power || "0"); 
                } else {
                    // ADA_BALANCE: Use the standard total_balance
                    totalPowerLovelace = Number(accountData.total_balance || "0");
                }
                
                if (!isNaN(totalPowerLovelace)) {
                    finalVotingPower = totalPowerLovelace / 1_000_000;
                }
            }

        } catch (err) {
            console.error(`Koios fetch for ${powerSource} failed, falling back to wallet UTxO:`, err);
            powerSource = 'Wallet UTxO (Fallback)';
            const balanceCBOR = await walletApi.getBalance();
            const lovelace = parseLovelaceFromCBOR(balanceCBOR);
            finalVotingPower = lovelace / 1_000_000;
        }

        // Store and display
        currentVotingPower = finalVotingPower;
        
        // Await vote fetch before updating UI
        await fetchUserVote(connectedAddress); 

        updateWalletUI(connectedAddress, networkName, iconSrc, finalVotingPower, powerSource);

        
        if (!isSilent) showMessage('Wallet connected!', 'success');
        localStorage.setItem(WALLET_STORAGE_KEY, walletKey);
        
        // loadBallot() is called inside updateWalletUI now
        
        return true;

    } catch (error) {
        console.error('Wallet connection failed:', error);
        if (!isSilent) showMessage('Connection failed.', 'error');
        return false;
    }
}

async function fetchUserVote(address) {
    try {
        const res = await fetch('/api/votes');
        if (!res.ok) return;
        const votes = await res.json();
        const myVote = votes.find(v => v.signer === address); 
        if (myVote) {
            currentUserVote = myVote;
        } else {
            currentUserVote = null;
        }
    } catch (e) {
        console.error("Error checking votes:", e);
    }
}

function handleDisconnectWallet() {
    walletApi = null;
    currentVotingPower = 0;
    currentUserVote = null; 
    connectedAddress = null;
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
    const ballotContainer = document.getElementById('ballot-container');
    if (ballotContainer) ballotContainer.innerHTML = '<p style="color: var(--text-muted);">Loading Ballot...</p>';
    showMessage('Wallet disconnected.', 'success');
}

function updateWalletUI(stakeAddr, network, icon, votingPower, powerSource) { 
    const connectState = document.getElementById('wallet-connect-state');
    if (connectState) connectState.style.display = 'none';
    const detailsSection = document.getElementById('wallet-details-section');
    if (detailsSection) detailsSection.classList.remove('hidden');
    
    const displayAddr = stakeAddr.length > 20 ? stakeAddr.substring(0,12) + '...' + stakeAddr.slice(-6) : stakeAddr;
    document.getElementById('val-stake-cred').textContent = displayAddr;
    document.getElementById('val-network').textContent = network;
    const powerEl = document.getElementById('val-voting-power');
    
    // --- DREP BLOCKING LOGIC ---
    let isBlocked = false;
    const blockingEl = document.getElementById('eligibility-msg');
    const ballotContainer = document.getElementById('ballot-container');
    
    if (VOTING_MODE === 'DREP_POWER' && votingPower < 1) { // Check for near zero power
        isBlocked = true;
        blockingEl.textContent = `❌ Eligibility Failed - Account is not a registered DRep.`;
        blockingEl.style.color = '#dc2626'; // Red color
        if (ballotContainer) {
            ballotContainer.innerHTML = `
                <div style="padding: 2rem; border: 1px dashed #f87171; border-radius: 8px;">
                    <p style="color: #b91c1c; font-weight: 600;">Voting is restricted to registered Delegated Representatives (DReps) in this election phase.</p>
                </div>
            `;
        }
    } else {
        blockingEl.textContent = `✓ Eligibility Verified (${votingPower.toLocaleString(undefined, { maximumFractionDigits: 0 })} Votes) - Source: ${powerSource}`;
        blockingEl.style.color = '#16a34a'; // Green color
    }
    
    if (powerEl) {
        powerEl.textContent = `${votingPower.toLocaleString()} ₳`;
        if (isBlocked) powerEl.style.color = '#dc2626';
        else powerEl.style.color = 'var(--primary)';
    }

    const iconEl = document.getElementById('val-wallet-icon');
    if (icon && iconEl) {
        iconEl.src = icon;
        iconEl.classList.remove('hidden');
    }
    
    const table = document.querySelector('.wallet-table');
    if (table) {
         const powerRow = table.querySelector('tbody tr:nth-child(3)');
         if (powerRow) {
             const labelCell = powerRow.querySelector('.label-cell');
             if (labelCell) {
                  labelCell.textContent = powerSource.includes('DRep') ? 'DRep Voting Power' : 'Voting Power';
             }
         }
    }
    
    if (!isBlocked && !isVotingClosed) {
        // Only load ballot if not blocked and voting is open
        loadBallot(); 
    }
}

function loadBallot() {
    const ballotContainer = document.getElementById('ballot-container');
    if(ballotContainer && ballotContainer.innerHTML.includes('restricted')) return; // Don't overwrite error message
    
    fetch('/api/applications')
        .then(res => res.json())
        .then(apps => renderBallot(apps))
        .catch(err => console.error('Failed to load ballot:', err));
}

function renderBallot(apps) {
    const container = document.getElementById('ballot-container');
    if (!container || container.innerHTML.includes('restricted')) return; // Respect blocking message

    container.innerHTML = '';
    if (!apps || apps.length === 0) {
        container.innerHTML = '<p>No candidates available.</p>';
        return;
    }
    apps.forEach(app => {
        const entryId = app.entryId;
        // Check if currentUserVote exists AND if the candidateId matches the current application
        const isVoted = currentUserVote && currentUserVote.payload.candidateId === entryId;
        
        const card = createEl('div', { 
            class: 'candidate-card',
            // Apply green border/background if voted
            style: isVoted ? 'border: 2px solid #16a34a; background-color: #f0fdf4;' : '' 
        });
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-vote')) return; 
            openVotingModal(app);
        });
        
        const name = app.data.fullName || app.data.orgName || app.data.consortiumName;
        const typeEl = createEl('div', { class: 'candidate-type' }, [app.applicationType]);

        // NEW STRUCTURE: Header container using flexbox
        // This is a direct replacement for the previous positioning that was causing overlap.
        const headerContainer = createEl('div', { 
            style: 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;' 
        });

        const textContainer = createEl('div', { 
            style: 'flex-grow: 1; min-width: 0;' 
        });
        
        textContainer.appendChild(createEl('div', { class: 'candidate-name' }, [name]));
        
        const statusRow = createEl('div', { 
            style: 'display: flex; align-items: center; margin-top: 0.25rem;' 
        });
        
        statusRow.appendChild(typeEl);
        
        // --- REMOVED THE BADGE LOGIC ---
        // We no longer add the badge element here as the Voted button provides confirmation.
        // if (badgeEl) statusRow.appendChild(badgeEl);
        
        textContainer.appendChild(statusRow);
        
        // Append elements to the card
        card.appendChild(textContainer);
        
        let btnText = 'Vote for Candidate';
        let btnStyle = 'margin-top: 1rem; width: 100%; background: #065f46; border-color: #065f46;';
        
        if (isVotingClosed) {
            btnText = 'Voting Closed';
            btnStyle += ' background: #9ca3af; border-color: #9ca3af; cursor: not-allowed;';
        } else if (isVoted) {
            btnText = '✓ Voted';
            btnStyle += ' background: #16a34a; border-color: #16a34a; cursor: default;';
        }
        
        const voteBtn = createEl('button', { class: 'btn btn-vote', style: btnStyle }, [btnText]);
        
        // Disable the button if the user has already voted for this candidate
        if (isVotingClosed || currentVotingPower < 1 || isVoted) voteBtn.disabled = true; 
        else voteBtn.addEventListener('click', (e) => { e.stopPropagation(); handleVote(app); });
        
        card.appendChild(voteBtn);
        
        container.appendChild(card);
    });
}

function openVotingModal(app) {
    const modal = document.getElementById('application-modal');
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    content.innerHTML = '';
    let applicantName = app.data.fullName || app.data.orgName || app.data.consortiumName || 'Candidate';
    const header = createEl('div', { class: 'modal-header' });
    header.appendChild(createEl('h3', {}, [applicantName]));
    const closeBtn = createEl('button', { class: 'modal-close', 'aria-label': 'Close' }, ['×']);
    closeBtn.addEventListener('click', closeApplicationModal);
    header.appendChild(closeBtn);
    content.appendChild(header);
    const safeApp = JSON.parse(JSON.stringify(app));
    if (safeApp.data) { delete safeApp.data.email; delete safeApp.data.contactEmail; }
    content.appendChild(buildApplicationDetails(safeApp));
    
    const isBlocked = currentVotingPower < 1 || isVotingClosed;
    
    const voteBtn = createEl('button', { 
        class: 'btn', 
        style: `margin-top: 1.5rem; width: 100%; padding: 1rem; font-size: 1.1rem; background: ${isBlocked ? '#9ca3af' : '#065f46'}; color: white;`
    }, [isBlocked ? (isVotingClosed ? 'Voting Closed' : 'Not Eligible to Vote') : 'Vote for ' + applicantName]);
    
    if (!isBlocked) voteBtn.addEventListener('click', () => { handleVote(app); closeApplicationModal(); });
    else voteBtn.disabled = true;
    
    content.appendChild(voteBtn);
    modal.classList.remove('hidden');
}

async function handleVote(app) {
    if (isVotingClosed || currentVotingPower < 1) return; // Final defense check
    const name = app.data.fullName || app.data.orgName || app.data.consortiumName;
    const id = app.entryId;
    if (!walletApi) { showMessage('Please connect your wallet to vote.', 'error'); return; }
    if (currentUserVote) {
        const confirmChange = confirm(`Change vote to "${name}"?`);
        if (!confirmChange) return;
    }
    // Update fetchUserVote after successful castVote to reflect new status
    await castVote(walletApi, id, name, currentVotingPower).then(success => {
        if (success) {
            // After successful vote submission, re-fetch user vote and re-render ballot
            fetchUserVote(connectedAddress).then(() => loadBallot());
        }
    });
}

async function castVote(walletApi, candidateId, candidateName, votingPower) {
    try {
        const votePayload = {
            action: "vote",
            electionId: "cc-snap-2025",
            candidateId: candidateId,
            candidateName: candidateName,
            votingPower: votingPower,
            timestamp: Date.now()
        };
        let hex = '';
        const str = JSON.stringify(votePayload);
        for (let i = 0; i < str.length; i++) {
            hex += '' + str.charCodeAt(i).toString(16).padStart(2, '0');
        }
        const signerAddress = connectedAddress; 
        showMessage(`Please sign the vote...`, 'success');
        const signature = await walletApi.signData(signerAddress, hex); 
        console.log("Vote Signed:", signature);
        const signerBech32 = getBech32StakeAddressFromHex(signerAddress.replace(/^e1/i, "").slice(-56));

        const result = await submitVoteToServer({
            payload: votePayload,
            signature: signature,
            signer: signerAddress,
            signer_bech32: signerBech32
        });
        if (result.status === 'ok') {
            showMessage(`Vote successfully cast for ${candidateName}!`, 'success');
            // The success logic is moved to the calling function (handleVote)
            return true;
        } else {
            throw new Error(result.error || "Submission failed");
        }
    } catch (error) {
        console.error("Voting Error:", error);
        if (error.code === 2) { 
            showMessage('Transaction declined by user.', 'error');
        } else {
            showMessage(`Voting failed: ${error.message || 'Check browser console.'}`, 'error');
        }
        return false;
    }
}

async function submitVoteToServer(data) {
    const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return await res.json();
}