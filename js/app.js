/*
  Candidate Application Demo - Main Controller
  --------------------------------------------
  This file coordinates initialization across all HTML pages.
  Now only handles Wallet mode for voting.
*/
import { REGISTRATION_DEADLINE, getUserId, createEl } from './utils.js';
import { showMessage, initElectionClock, buildApplicationDetails, openApplicationModal, openSuccessModal, closeApplicationModal } from './ui.js';
import { 
    renderIndividualForm, 
    renderOrganizationForm, 
    renderConsortiumForm, 
    resetConsortiumMembers,
    setConsortiumMembers,
    populateForm
} from './forms.js';
import { initVotingPage } from './voting.js'; // Keep only initVotingPage
import { initResultsPage } from './results.js'; 
import { initAuditFeature } from './audit.js';

// Initialize Globals needed for Forms logic if they don't exist
window.isEditMode = false;
window.editEntryId = null;
window.editToken = null;

// --- Global State ---
let allApplications = [];
let currentFilter = 'All';

// --- Main Init Function ---
// This function runs once the DOM is fully loaded.
function initApp() {
    console.log('App Initializing...');
    initElectionClock();
    
    // DOM Elements
    const formContainer = document.getElementById('application-form');
    const applicationsList = document.getElementById('applications-list');
    
    // Page Specific Logic
    // If element exists, run the page's setup routine
    if (formContainer) initRegistrationPage();
    if (applicationsList) initCandidatesPage();
    if (document.getElementById('candidate-details')) initCandidateDetailPage();
    
    // Manual Edit Handler (These are crucial buttons for the Register page)
    const btnLoadManual = document.getElementById('btn-load-manual-edit');
    if (btnLoadManual) {
        btnLoadManual.addEventListener('click', handleManualEditLoad);
    }
    const btnShowEdit = document.getElementById('btn-show-edit-input');
    if (btnShowEdit) {
        btnShowEdit.addEventListener('click', () => {
            const container = document.getElementById('manual-edit-container');
            container.classList.toggle('hidden');
        });
    }

    // Voting Logic (Only Wallet mode now)
    // Removed dependency on vote-mode-switch as it no longer exists
    if (document.getElementById('wallet-mode')) {
        initVotingPage(); 
    }
    
    // Results & Audit Logic
    if (document.getElementById('results-placeholder')) {
        initResultsPage();
        initAuditFeature();
    }
}

// --- CRITICAL FIX: Ensure initialization waits for the DOM ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// --- Registration Page Logic ---
function initRegistrationPage() {
    const formContainer = document.getElementById('application-form');
    const formSwitchButtons = document.querySelectorAll('#form-switch button');

    if (Date.now() > REGISTRATION_DEADLINE) {
        formContainer.innerHTML = `<div class="guide" style="text-align:center; padding:3rem;"><h3 style="color:#dc2626;">Registration Closed</h3></div>`;
        return;
    }

    // Form Switcher
    formSwitchButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            formSwitchButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            resetConsortiumMembers();
            loadForm(btn.dataset.type);
        });
    });

    // Edit Mode via URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('entryId') && params.get('token')) {
        loadApplicationForEdit(params.get('entryId'), params.get('token'));
    } else {
        // Default State (No form loaded)
        formSwitchButtons.forEach(b => b.classList.remove('active'));
        formContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color: var(--surface-alt); border-radius: 12px; border: 2px dashed var(--border);">
                <h3 style="margin-top: 0; color: var(--primary);">Ready to Register?</h3>
                <p>Please select your category above (Individual, Organisation, or Consortium) to begin.</p>
            </div>
        `;
    }
}

function loadForm(type) {
    const formContainer = document.getElementById('application-form');
    formContainer.innerHTML = '';
    if (type === 'Individual') renderIndividualForm(formContainer);
    else if (type === 'Organization') renderOrganizationForm(formContainer);
    else if (type === 'Consortium') renderConsortiumForm(formContainer);
}

// --- Candidates Page Logic ---
function initCandidatesPage() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', renderFilteredApplications);
    
    const filterContainer = document.querySelector('.filter-buttons');
    if(filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                document.querySelectorAll('.filter-buttons button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                renderFilteredApplications();
            }
        });
    }

    // Load Data
    fetch('/api/applications')
        .then(res => res.json())
        .then(apps => { allApplications = apps; renderFilteredApplications(); })
        .catch(err => showMessage('Failed to load candidates', 'error'));
}

function renderFilteredApplications() {
    const applicationsList = document.getElementById('applications-list');
    const term = document.getElementById('search-input')?.value.toLowerCase() || '';
    const filtered = allApplications.filter(app => {
        const typeMatch = currentFilter === 'All' || app.applicationType === currentFilter;
        const name = (app.data.fullName || app.data.orgName || app.data.consortiumName || '').toLowerCase();
        return typeMatch && name.includes(term);
    });
    
    applicationsList.innerHTML = '';
    if (filtered.length === 0) { applicationsList.innerHTML = '<p>No candidates found.</p>'; return; }
    
    filtered.forEach(app => {
        const card = createEl('div', { class: 'candidate-card' });
        card.onclick = () => window.location.href = `/ccsnap/candidates/${app.entryId}`;
        const name = app.data.fullName || app.data.orgName || app.data.consortiumName;
        card.appendChild(createEl('div', { class: 'candidate-name' }, [name]));
        card.appendChild(createEl('div', { class: 'candidate-type' }, [app.applicationType]));
        applicationsList.appendChild(card);
    });
}

// --- Single Candidate Detail Page Logic ---
function initCandidateDetailPage() {
    const parts = window.location.pathname.split('/');
    const entryId = parts[parts.length - 1];
    const container = document.getElementById('candidate-details');
    
    fetch(`/api/applications/${entryId}`)
        .then(res => { if(!res.ok) throw new Error(); return res.json(); })
        .then(app => {
            document.getElementById('candidate-name-heading').textContent = app.data.fullName || app.data.orgName || app.data.consortiumName;
            container.appendChild(buildApplicationDetails(app));
        })
        .catch(() => {
            container.innerHTML = '<p>Candidate not found.</p>';
        });
}

// --- Edit Logic ---
function handleManualEditLoad() {
    const token = document.getElementById('manual-edit-token').value.trim();
    if (!token) { showMessage('Token required', 'error'); return; }
    
    fetch('/api/lookup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token})})
        .then(res => { if(!res.ok) throw new Error(); return res.json(); })
        .then(app => setupEditMode(app, token))
        .catch(() => showMessage('Invalid token', 'error'));
}

function loadApplicationForEdit(id, token) {
    fetch(`/api/applications/${id}`)
        .then(res => res.json())
        .then(app => setupEditMode(app, token))
        .catch(() => showMessage('Edit load failed', 'error'));
}

function setupEditMode(app, token) {
    const formContainer = document.getElementById('application-form');
    const formSwitchButtons = document.querySelectorAll('#form-switch button');
    
    window.isEditMode = true;
    window.editEntryId = app.entryId;
    window.editToken = token;
    
    document.getElementById('edit-banner')?.classList.remove('hidden');
    document.getElementById('manual-edit-container')?.classList.add('hidden');
    
    // 1. Disable Switchers
    formSwitchButtons.forEach(b => b.disabled = true);
    
    // 2. Activate visual button
    formSwitchButtons.forEach(b => {
        if (b.dataset.type === app.applicationType) b.classList.add('active');
        else b.classList.remove('active');
    });

    // 3. Set State (CRITICAL for Consortium to work before render)
    if (app.applicationType === 'Consortium' && app.data.consortiumMembers) {
        setConsortiumMembers(app.data.consortiumMembers);
    } else {
        resetConsortiumMembers();
    }

    // 4. Render Form
    loadForm(app.applicationType);

    // 5. Populate Data (Fills flat fields and checkboxes)
    populateForm(formContainer, app.applicationType, app.data);

    showMessage('Loaded for editing', 'success');
}