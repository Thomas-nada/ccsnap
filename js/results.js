/*
  results.js
  ----------
  Fetches and displays voting results (Multi-Candidate compatible).
  Calculates winner based on Total Voting Power.
*/

import { createEl, VOTING_END } from './utils.js';
import { showMessage } from './ui.js';

export function initResultsPage() {
    const container = document.getElementById('results-placeholder');
    if (!container) return;

    // 1. Update Status Badge Immediately
    const statusBadge = document.getElementById('election-status-badge');
    const now = Date.now();
    
    if (statusBadge) {
        if (now > VOTING_END) {
            statusBadge.textContent = "Voting Closed";
            statusBadge.style.backgroundColor = "#fee2e2"; // Red background
            statusBadge.style.color = "#991b1b";
            statusBadge.style.borderColor = "#fecaca";
        } else {
            statusBadge.textContent = "Voting Open";
            statusBadge.style.backgroundColor = "#dcfce7"; // Green background
            statusBadge.style.color = "#166534";
            statusBadge.style.borderColor = "#bbf7d0";
        }
    }

    // Clear placeholder
    container.innerHTML = '';
    container.style.padding = '0';
    container.style.border = 'none';
    container.style.backgroundColor = 'transparent';

    // Build Table Structure for Raw Log
    const tableContainer = createEl('div', { class: 'wallet-details-container', style: 'margin-top: 0;' });
    const table = createEl('table', { class: 'wallet-table results-table' }); 
    const thead = createEl('thead');
    const headerRow = createEl('tr');
    
    // FIX 1: Changed header to 'Stake Address'
    ['Time', 'Candidate', 'Stake Address', 'Power (₳)'].forEach(text => {
        const th = createEl('th', { style: 'text-align: left; padding: 0.75rem 1rem; background: var(--surface-alt); color: var(--primary-dark); font-weight: 600; border-bottom: 2px solid var(--border); font-size: 0.9rem;' }, [text]);
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = createEl('tbody', { id: 'results-body' });
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    container.appendChild(tableContainer);

    // Fetch Data
    loadResults();
}

function loadResults() {
    fetch('/api/votes')
        .then(res => res.json())
        .then(votes => {
            renderResults(votes);
            calculateWinner(votes);
        })
        .catch(err => console.error('Failed to load results:', err));
}

function calculateWinner(votes) {
    const winnerSection = document.getElementById('winner-section');
    const winnerTitleEl = document.getElementById('winner-title');
    const winnerNameEl = document.getElementById('winner-name');
    const winnerStatsEl = document.getElementById('winner-stats');
    const rankingsSection = document.getElementById('rankings-section');

    if (!votes || votes.length === 0) {
        winnerSection.classList.add('hidden');
        rankingsSection.classList.add('hidden');
        return;
    }

    // Tally Votes
    const tally = {}; // { candidateName: totalPower }
    let totalVotesCast = 0; // This should be the sum of unique voter power
    
    const uniqueVoters = new Set(); // Track unique voters to calculate totalVotesCast correctly

    votes.forEach(v => {
        const totalPower = v.payload.votingPower || 0;
        const signer = v.signer;
        
        // Track total power based on unique voters (not cumulative power)
        if (!uniqueVoters.has(signer)) {
            totalVotesCast += totalPower; 
            uniqueVoters.add(signer);
        }

        // --- FIX: Add full power to EACH selected candidate (Stacked Voting) ---
        if (Array.isArray(v.payload.votedCandidates)) {
            v.payload.votedCandidates.forEach(candidate => {
                const name = candidate.candidateName;
                if (!tally[name]) tally[name] = 0;
                tally[name] += totalPower; // Add FULL power for each selection
            });
        }
        // Fallback for old single-vote records (should behave the same as a single stacked vote)
        else if (v.payload.candidateName && v.payload.candidateId) {
             const name = v.payload.candidateName;
             if (!tally[name]) tally[name] = 0;
             tally[name] += totalPower;
        }
    });

    // Convert to Array for Sorting
    const ranking = Object.entries(tally).map(([name, power]) => ({ name, power }));
    ranking.sort((a, b) => b.power - a.power); // Sort descending

    // Find Winner (First in sorted array)
    const winner = ranking.length > 0 ? ranking[0] : null;
    
    // Calculate the total *VOTING POOL* against which the share is measured.
    // If multiple candidates are selected, the overall pool size can be greater than totalVotesCast (unique voters' power).
    // For cumulative voting, the 'Share' is calculated as (Candidate Power / Total *Unique Voter* Power), although this often exceeds 100%.
    // To represent this simply, we will use the largest total power recorded as the base for the display percentage, but this is complex.
    // The standard approach is to calculate the share against the total *possible* power in the election (which we don't know).
    // For display simplicity, we will stick to using the `totalVotesCast` (sum of unique voter powers) as the denominator, acknowledging the percentage might exceed 100%.

    if (winner) {
        winnerSection.classList.remove('hidden');
        rankingsSection.classList.remove('hidden');
        
        // Update Title based on Election Status
        const now = Date.now();
        if (now > VOTING_END) {
            winnerTitleEl.textContent = "Winner";
        } else {
            winnerTitleEl.textContent = "Current Leader";
        }

        winnerNameEl.textContent = winner.name;
        
        // Use totalVotesCast as the denominator for the share percentage
        const percentage = totalVotesCast > 0 ? ((winner.power / totalVotesCast) * 100).toFixed(1) : 0;
        winnerStatsEl.textContent = `${winner.power.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₳ (${percentage}%)`;

        // Render Full Rankings
        renderRankings(ranking, totalVotesCast);
    }
}

function renderRankings(ranking, totalVotes) {
    const tbody = document.getElementById('rankings-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    ranking.forEach((item, index) => {
        const row = createEl('tr');
        
        // Rank
        const rankCell = createEl('td', { class: 'value-cell', style: 'font-weight: 700; color: var(--text-muted);' }, [`#${index + 1}`]);
        
        // Name (Highlight winner)
        const nameStyle = index === 0 ? 'font-weight: 700; color: #166534;' : 'font-weight: 500;';
        const nameCell = createEl('td', { class: 'value-cell', style: nameStyle }, [item.name]);
        if (index === 0) {
            const badge = createEl('span', { style: 'margin-left: 8px; font-size: 0.8em; background: #dcfce7; padding: 2px 6px; border-radius: 4px; color: #166534;' }, ['LEADER']);
            nameCell.appendChild(badge);
        }

        // Power (Round for display)
        const powerDisplay = item.power.toLocaleString(undefined, { maximumFractionDigits: 0 });
        const powerCell = createEl('td', { class: 'value-cell', style: 'text-align: right; font-family: monospace;' }, [`${powerDisplay} ₳`]);

        // Share (Percentage of total unique voter power, may exceed 100%)
        const percentage = totalVotes > 0 ? ((item.power / totalVotes) * 100).toFixed(1) : 0;
        const shareCell = createEl('td', { class: 'value-cell', style: 'text-align: right; color: var(--text-muted);' }, [`${percentage}%`]);

        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(powerCell);
        row.appendChild(shareCell);
        tbody.appendChild(row);
    });
}

function renderResults(votes) {
    const tbody = document.getElementById('results-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (votes.length === 0) {
        const row = createEl('tr');
        const cell = createEl('td', { colspan: 4, style: 'text-align: center; padding: 2rem; color: var(--text-muted);' }, ['No votes cast yet.']);
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }
    
    // NEW: We need to flatten the votes array for the raw log display
    const flattenedVotes = [];
    votes.forEach(voteRecord => {
        const totalPower = voteRecord.payload.votingPower || 0;
        const timestamp = voteRecord.payload.timestamp;
        const signer = voteRecord.signer_bech32 || voteRecord.signer;

        if (Array.isArray(voteRecord.payload.votedCandidates)) {
            // Since power is stacked, each candidate entry in the log gets the FULL power for that voter.
            const distributedPower = totalPower;

            voteRecord.payload.votedCandidates.forEach(candidate => {
                flattenedVotes.push({
                    signer: signer,
                    candidateName: candidate.candidateName,
                    votingPower: distributedPower, // Full power applied
                    timestamp: timestamp
                });
            });
        } 
        // Fallback for old single-vote records
        else if (voteRecord.payload.candidateName && voteRecord.payload.candidateId) {
             flattenedVotes.push({
                signer: signer,
                candidateName: voteRecord.payload.candidateName,
                votingPower: totalPower,
                timestamp: timestamp
            });
        }
    });


    // Sort by time descending
    flattenedVotes.sort((a, b) => b.timestamp - a.timestamp);

    flattenedVotes.forEach(vote => {
        const row = createEl('tr');
        
        let rawSigner = vote.signer; 
        let voterDisplay = rawSigner;
        if (voterDisplay && voterDisplay.length > 16) {
            voterDisplay = voterDisplay.substring(0, 8) + '...' + voterDisplay.slice(-6);
        }

        const power = vote.votingPower || 0; 
        const time = new Date(vote.timestamp).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        // Order: Time, Candidate, Voter, Power
        row.appendChild(createEl('td', { class: 'value-cell', style: 'white-space: nowrap; color: var(--text-muted);' }, [time]));
        row.appendChild(createEl('td', { class: 'value-cell', style: 'font-weight: 500; color: var(--primary-dark);' }, [vote.candidateName]));
        row.appendChild(createEl('td', { class: 'value-cell', style: 'font-family: monospace; font-size: 0.85rem; overflow-wrap: break-word;' }, [voterDisplay]));
        // Display power rounded to 2 decimals for the raw log
        row.appendChild(createEl('td', { class: 'value-cell', style: 'font-weight: 600; text-align: right;' }, [`${power.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₳`]));
        
        tbody.appendChild(row);
    });
}