/*
  voting_ada.js
  -------------
  Dedicated logic for ADA Balance based voting (Multi-Candidate).

  FIX 1: Scoping error resolved by moving all critical helper functions to the top scope.
  FIX 2: RESOLVED BUTTON DUPLICATION. Grouped Clear Selections and Submit button into a single container placed below the candidate list.
  FIX 3: Implemented requested UI consistency: "Clear Selections" button is now placed ABOVE the candidate list.
  FIX 4: ENHANCED BUTTON TEXT to clarify minimum required vs. maximum allowed selections.
*/

import { showMessage, buildApplicationDetails, openApplicationModal, closeApplicationModal, getDisplayType } from './ui.js'; 
import { createEl, VOTING_END, stringToHex, MIN_VOTING_POWER, MIN_VOTES, MAX_VOTES, NETWORK_NAME } from './utils.js'; 
import { getBech32StakeAddressFromHex } from './wallet_utils.js'; 

let walletApi = null;
let walletPollInterval = null;
let pollAttempts = 0;
let currentVotingPower = 0; 
let currentLovelace = 0;    
let currentUserVote = null; 
let connectedAddress = null; 
let selectedCandidates = []; 

let isListenerAttached = false;

const MAX_POLL_ATTEMPTS = 10; 
const WALLET_STORAGE_KEY = 'ccConnectedWallet'; 
const isVotingClosed = Date.now() > VOTING_END;

// Global data to hold ballot state (required for refetching after vote)
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

function updateVoteButtonState() {
    const btn = document.getElementById('btn-submit-ballot');
    const resetBtn = document.getElementById('btn-reset-ballot');
    const infoText = document.getElementById('multi-vote-info');
    if (!btn || !resetBtn || !infoText) return;
    
    if (isVotingClosed || currentLovelace < MIN_VOTING_POWER) {
        btn.disabled = true;
        resetBtn.disabled = true; // Disable reset button too
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

function updateWalletUI(stakeAddr, network, icon, votingPower, powerSource) { 
    const connectState = document.getElementById('wallet-connect-state');
    if (connectState) connectState.style.display = 'none';
    const detailsSection = document.getElementById('wallet-details-section');
    if (detailsSection) detailsSection.classList.remove('hidden');
    
    const displayAddr = stakeAddr.length > 20 ? stakeAddr.substring(0,12) + '...' + stakeAddr.slice(-6) : stakeAddr;
    document.getElementById('val-stake-cred').textContent = displayAddr;
    document.getElementById('val-network').textContent = network;
    const powerEl = document.getElementById('val-voting-power');
    
    // --- ELIGIBILITY CHECK (LOVELACE) ---
    let isBlocked = false;
    const blockingEl = document.getElementById('eligibility-msg');
    
    if (currentLovelace < MIN_VOTING_POWER) {
        isBlocked = true;
        blockingEl.textContent = `❌ Ineligible - Minimum ${MIN_VOTING_POWER} Lovelace required.`;
        blockingEl.style.color = '#dc2626';
    } else {
        blockingEl.textContent = `✓ Eligibility Verified (${votingPower.toLocaleString()} ₳) - Source: ${powerSource}`;
        blockingEl.style.color = '#16a34a'; 
    }
    
    if (powerEl) {
        powerEl.textContent = `${votingPower.toLocaleString()} ₳`;
        powerEl.style.color = isBlocked ? '#dc2626' : 'var(--primary)';
    }

    const iconEl = document.getElementById('val-wallet-icon');
    if (icon && iconEl) {
        iconEl.src = icon;
        iconEl.classList.remove('hidden');
    }
    
    if (!isBlocked && !isVotingClosed) {
        loadBallot(); 
    } else if (isBlocked) {
        document.getElementById('ballot-container').innerHTML = `
            <div style="padding: 2rem; border: 1px dashed #f87171; border-radius: 8px; background: #fef2f2;">
                <p style="color: #b91c1c; font-weight: 600;">Voting Restricted</p>
                <p style="font-size:0.9rem;">You do not meet the minimum voting power requirement (${MIN_VOTING_POWER} Lovelace).</p>
            </div>
        `;
    }
}

async function castVoteInternal(walletApi, selectedCandidates, votingPower, signerAddress) {
    try {
        // 1. DEFENSIVELY FETCH SIGNING ADDRESS (Hex)
        let signingAddressHex = null;
        try {
            // Attempt to get Change Address first (most reliable hex for signing)
            signingAddressHex = await walletApi.getChangeAddress();
        } catch (e) { 
            console.warn("getChangeAddress failed, trying getRewardAddresses for a fallback.", e); 
            // Fallback: Try to get a reward address, it might be in hex format or we can use it as a signer reference
            try {
                const rewardAddresses = await walletApi.getRewardAddresses();
                if (rewardAddresses && rewardAddresses.length > 0) {
                    // Use the first reward address, assuming the wallet can sign with it.
                    signingAddressHex = rewardAddresses[0]; 
                }
            } catch (e) {
                 // Final fallback failed
            }
        }

        if (!signingAddressHex) throw new Error("Could not retrieve a valid signing address from the wallet.");

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

async function performWalletConnection(walletKey, isSilent) {
    try {
        walletApi = await window.cardano[walletKey].enable();
        const networkId = await walletApi.getNetworkId();
        
        console.log(`Wallet Connected. Detected Network ID: ${networkId} (Type: ${typeof networkId})`);

        // --- FIXED NETWORK CHECK (Using Loose Equality '==') ---
        const targetIsMainnet = NETWORK_NAME === 'mainnet';
        const walletIsMainnet = (networkId == 1); // 1 or "1"

        if (targetIsMainnet && !walletIsMainnet) {
            throw new Error(`Wrong Network: App is on Mainnet, Wallet is on Testnet (ID: ${networkId}).`);
        }
        if (!targetIsMainnet && walletIsMainnet) {
            throw new Error(`Wrong Network: App is on Testnet, Wallet is on Mainnet (ID: ${networkId}).`);
        }

        const networkName = (networkId == 0) ? "Testnet" : "Mainnet";
        
        let rawAddress = null;
        let changeAddressHex = null; // Will store the raw hex needed for signing

        // 1. Try to get the Stake Reward Address (Bech32 or Hex)
        try {
            const rewardAddresses = await walletApi.getRewardAddresses();
            if (rewardAddresses && rewardAddresses.length > 0) {
                rawAddress = rewardAddresses[0];
            }
        } catch (e) { console.warn("getRewardAddresses failed:", e); }

        // 2. Try to get the Change Address (Hex, needed for signing in CIP-30)
        try {
             changeAddressHex = await walletApi.getChangeAddress();
        } catch (e) { console.warn("getChangeAddress failed:", e); }


        if (!rawAddress) {
             // Fallback: If no reward address, derive stake address from the change address hex
             if (changeAddressHex) {
                 rawAddress = changeAddressHex; // Use the change address hex as basis
             } else {
                 throw new Error("Could not retrieve any wallet address for verification.");
             }
        }
        
        // 3. Ensure we have a Bech32 stake address for connectedAddress variable (for API lookups)
        if (!rawAddress.startsWith('stake')) {
            connectedAddress = getBech32StakeAddressFromHex(rawAddress);
            if (!connectedAddress) throw new Error("Address format not supported or derivation failed.");
        } else {
            connectedAddress = rawAddress;
        }

        // Use the changeAddressHex (raw hex) for signing later if available
        if (!changeAddressHex) {
             // Fallback: If change address hex wasn't explicitly available, we must rely on the wallet to use the first available address for signing in castVoteInternal.
             // We won't set signingAddressHex here, we'll fetch it inside handleVote/castVoteInternal more defensively.
        }

        const walletObj = window.cardano[walletKey];
        const iconSrc = walletObj.icon;

        // --- ADA POWER LOGIC ---
        let finalVotingPower = 0;
        let finalLovelace = 0;
        let powerSource = 'ADA Balance';

        try {
            const payload = { 
                _stake_addresses: [connectedAddress],
                _action: 'total_balance' 
            };
            
            const koiosRes = await fetch("/api/proxy/koios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const koiosData = await koiosRes.json();

            if (Array.isArray(koiosData) && koiosData.length > 0) {
                const accountData = koiosData[0];
                const totalPowerLovelace = Number(accountData.total_balance || "0");
                if (!isNaN(totalPowerLovelace)) {
                    finalLovelace = totalPowerLovelace;
                    finalVotingPower = totalPowerLovelace / 1_000_000;
                }
            }

        } catch (err) {
            console.error(`Koios fetch failed, falling back to wallet UTxO:`, err);
            powerSource = 'Wallet UTxO (Fallback)';
            try {
                const balanceCBOR = await walletApi.getBalance();
                const lovelace = parseLovelaceFromCBOR(balanceCBOR);
                finalLovelace = lovelace;
                finalVotingPower = lovelace / 1_000_000;
            } catch (fallbackError) {
                // Production-ready addition: Ensure lovelace remains 0 on any fallback failure
                console.error("Fallback to wallet.getBalance() failed:", fallbackError);
                finalLovelace = 0;
                finalVotingPower = 0;
            }
        }

        currentVotingPower = finalVotingPower;
        currentLovelace = finalLovelace;

        // NEW: Fetch and set selectedCandidates from previous vote
        await fetchUserVote(connectedAddress); 
        updateWalletUI(connectedAddress, networkName, iconSrc, finalVotingPower, powerSource);
        
        if (!isSilent) showMessage('Wallet connected!', 'success');
        localStorage.setItem(WALLET_STORAGE_KEY, walletKey);
        
        return true;

    } catch (error) {
        console.error('Wallet connection failed:', error);
        if (!isSilent) showMessage(error.message || 'Connection failed.', 'error');
        // Return false so handleConnectWallet knows to unlock the button
        return false;
    }
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
        // NEW: Reset button text if wallets are detected
        if (connectBtn) {
            connectBtn.disabled = false;
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
        // Use a unique ID to distinguish it from the bottom submit group button
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
        
        // Candidate Name
        const nameEl = createEl('div', { class: 'candidate-name' }, [
            document.createTextNode(name)
        ]);

        // Voted Tag (Placed beneath the name)
        if (wasVotedFor) {
            card.appendChild(createEl('span', { class: 'voted-tag' }, ['VOTED']));
        }
        
        // Candidate Type
        const typeEl = createEl('div', { class: 'candidate-type' }, [getDisplayType(app.applicationType)]);
        
        // --- Assemble Card ---
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

function loadBallot() {
    fetch('/api/applications')
        .then(res => res.json())
        .then(apps => {
            currentBallotData = apps; // Cache data
            renderBallot(apps);
        })
        .catch(err => console.error('Failed to load ballot:', err));
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
    btn.innerHTML = 'Connecting...';

    const success = await performWalletConnection(walletKey, false);

    // FIX: Always unlock button if connection didn't return true
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
    const ballotContainer = document.getElementById('ballot-container');
    if (ballotContainer) ballotContainer.innerHTML = '<p style="color: var(--text-muted);">Loading Ballot...</p>';
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


export function initAdaVoting() {
    const connectBtn = document.getElementById('btn-connect-wallet');
    const disconnectBtn = document.getElementById('btn-disconnect-wallet');
    
    if (!document.getElementById('wallet-mode')) return;

    const statusDesc = document.getElementById('voting-status-desc');
    if (statusDesc) statusDesc.textContent = `Connect your ${NETWORK_NAME.toUpperCase()} wallet to verify eligibility.`;

    if (isVotingClosed) {
        const title = document.getElementById('voting-status-title');
        if (title) {
            title.textContent = "Voting is CLOSED";
            title.style.color = "#b91c1c"; 
        }
        if (statusDesc) {
            statusDesc.textContent = "The election period has ended. No new votes can be cast.";
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
        console.log('ADA Voting module initialized.');
    }
}