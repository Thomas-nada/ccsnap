/*
  results.js
  ----------
  Fetches and displays voting results.
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
    let totalVotesCast = 0;
    
    votes.forEach(v => {
        const name = v.payload.candidateName;
        const power = v.payload.votingPower || 0;
        
        if (!tally[name]) tally[name] = 0;
        tally[name] += power;
        totalVotesCast += power;
    });

    // Convert to Array for Sorting
    const ranking = Object.entries(tally).map(([name, power]) => ({ name, power }));
    ranking.sort((a, b) => b.power - a.power); // Sort descending

    // Find Winner (First in sorted array)
    const winner = ranking.length > 0 ? ranking[0] : null;

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
        
        const percentage = totalVotesCast > 0 ? ((winner.power / totalVotesCast) * 100).toFixed(1) : 0;
        winnerStatsEl.textContent = `${winner.power.toLocaleString()} ₳ (${percentage}%)`;

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
            const badge = createEl('span', { style: 'margin-left: 8px; font-size: 0.8em; background: #dcfce7; padding: 2px 6px; border-radius: 4px; color: #166534;' }, ['WINNER']);
            nameCell.appendChild(badge);
        }

        // Power
        const powerCell = createEl('td', { class: 'value-cell', style: 'text-align: right; font-family: monospace;' }, [`${item.power.toLocaleString()} ₳`]);

        // Share
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

    // Sort by time descending
    votes.sort((a, b) => b.payload.timestamp - a.payload.timestamp);

    votes.forEach(vote => {
        const row = createEl('tr');
        
        // FIX 2: Prioritize the Bech32 stake address, falling back to the raw signer ID if necessary.
        // The raw signer ID (vote.signer) might be hex or a bech32 key hash.
        let rawSigner = vote.signer_bech32 || vote.signer; 

        // FIX 3: Reintroduce truncation logic, but ONLY check if the string is long enough
        let voterDisplay = rawSigner;
        if (voterDisplay && voterDisplay.length > 16) {
            // Truncate to show the start (8 chars) and end (6 chars) separated by '...'
            voterDisplay = voterDisplay.substring(0, 8) + '...' + voterDisplay.slice(-6);
        }


        const power = vote.payload.votingPower || 0; 
        const time = new Date(vote.payload.timestamp).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        // Order: Time, Candidate, Voter, Power
        row.appendChild(createEl('td', { class: 'value-cell', style: 'white-space: nowrap; color: var(--text-muted);' }, [time]));
        row.appendChild(createEl('td', { class: 'value-cell', style: 'font-weight: 500; color: var(--primary-dark);' }, [vote.payload.candidateName]));
        row.appendChild(createEl('td', { class: 'value-cell', style: 'font-family: monospace; font-size: 0.85rem; overflow-wrap: break-word;' }, [voterDisplay]));
        row.appendChild(createEl('td', { class: 'value-cell', style: 'font-weight: 600; text-align: right;' }, [`${power.toLocaleString()} ₳`]));
        
        tbody.appendChild(row);
    });
}