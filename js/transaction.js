/*
  transaction.js
  --------------
  Handles vote payload construction and signing (CIP-30 signData).
*/

import { showMessage } from './ui.js';

export async function castVote(walletApi, candidateId, candidateName) {
    if (!walletApi) {
        showMessage('Wallet not connected.', 'error');
        return false;
    }

    try {
        // 1. Construct Vote Payload
        // In a real governance app, this would be a transaction metadata object
        // or a specific plutus datum. Here we use a JSON structure.
        const votePayload = {
            action: "vote",
            electionId: "cc-snap-2025",
            candidateId: candidateId,
            candidateName: candidateName,
            timestamp: Date.now()
        };

        const messageHex = stringToHex(JSON.stringify(votePayload));
        const addresses = await walletApi.getUsedAddresses();
        const signerAddress = addresses[0]; // Use first used address

        showMessage(`Please sign the vote for ${candidateName}...`, 'success');

        // 2. Request Signature from Wallet (CIP-30 signData)
        // This proves the user controls the stake key and authorizes this specific vote payload.
        const signature = await walletApi.signData(signerAddress, messageHex);

        console.log("Vote Signed:", signature);

        // 3. Submit to Server
        const result = await submitVoteToServer({
            payload: votePayload,
            signature: signature,
            signer: signerAddress
        });

        if (result.status === 'ok') {
            showMessage(`Vote successfully cast for ${candidateName}!`, 'success');
            return true;
        } else {
            throw new Error(result.error || "Submission failed");
        }

    } catch (error) {
        console.error("Voting Error:", error);
        if (error.code === 2) { // User declined
            showMessage('Transaction declined by user.', 'error');
        } else {
            showMessage(`Voting failed: ${error.message || error}`, 'error');
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

// Helper: Convert string to Hex
function stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16);
    }
    return hex;
}