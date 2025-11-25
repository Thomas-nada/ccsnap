/*
  Candidate Application Demo - Main Controller
  --------------------------------------------
  This file coordinates initialization across all HTML pages.
  Updated to fix potential race condition when loading forms via click handler.
*/
import { REGISTRATION_DEADLINE, createEl, fetchConfig, ELECTION_NAME, SHOW_REGISTER, SHOW_VOTE, SHOW_RESULTS } from './utils.js'; 
import { showMessage, initElectionClock, buildApplicationDetails, openApplicationModal, openSuccessModal, closeApplicationModal } from './ui.js';
import { 
    renderIndividualForm, 
    renderOrganisationForm, 
    renderConsortiumForm, 
    resetConsortiumMembers,
    setConsortiumMembers,
    populateForm
} from './forms.js';
import { initVotingPage } from './voting.js'; 
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
async function initApp() {
    console.log('App Initializing...');
    
    // 1. Fetch Configuration (Sets Dates, Mode, Name & Thresholds, AND loads FORM_SCHEMA)
    await fetchConfig(); // *** ENSURE WE WAIT HERE ***

    // 2. Apply Dynamic Election Name
    document.querySelectorAll('.site-title, .logo h1').forEach(el => {
        el.textContent = ELECTION_NAME;
    });
    // Updates the Browser Tab Title
    document.title = ELECTION_NAME; 

    // 3. Apply Feature Flags (Visibility Toggles)
    applyFeatureFlags();

    // 4. Initialize Components
    initElectionClock();
    
    // DOM Elements
    const formContainer = document.getElementById('application-form');
    const applicationsList = document.getElementById('applications-list');
    
    // Page Specific Logic
    if (formContainer) initRegistrationPage();
    if (applicationsList) initCandidatesPage();
    if (document.getElementById('candidate-details')) initCandidateDetailPage();
    
    // Manual Edit Handler
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

// --- NEW: Feature Flag Enforcer ---
function applyFeatureFlags() {
    // Helper to hide nav links by their href
    const hideLink = (partialHref) => {
        const links = document.querySelectorAll(`nav.top-nav a[href*="${partialHref}"]`);
        links.forEach(link => link.style.display = 'none');
    };

    // Helper to redirect if user is on a disabled page
    const checkRedirect = (partialHref) => {
        if (window.location.pathname.includes(partialHref)) {
            window.location.href = '/ccsnap'; // Send back to Guide/Home
        }
    };

    if (!SHOW_REGISTER) {
        hideLink('register');
        checkRedirect('register');
        // Hide registration form if we are on the main dashboard (SPA mode)
        const regSection = document.getElementById('application-form-section'); // For SPA
        if(regSection) regSection.classList.add('hidden');
    }

    if (!SHOW_VOTE) {
        hideLink('vote');
        checkRedirect('vote');
        const voteSection = document.getElementById('wallet-mode'); // For SPA
        if(voteSection) voteSection.classList.add('hidden');
    }

    if (!SHOW_RESULTS) {
        hideLink('results');
        checkRedirect('results');
        const resSection = document.getElementById('results-section'); // For SPA
        if(resSection) resSection.classList.add('hidden');
    }
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
            loadForm(btn.dataset.type); // Load the form
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

function loadForm(type, initialData = {}) {
    const formContainer = document.getElementById('application-form');
    formContainer.innerHTML = '';
    
    // Pass initialData to the render functions (mandatory for dynamic forms to populate fields)
    if (type === 'Individual') renderIndividualForm(formContainer, initialData); 
    else if (type === 'Organization') renderOrganisationForm(formContainer, initialData); 
    else if (type === 'Consortium') renderConsortiumForm(formContainer, initialData);
    else showMessage(`Error: Form type '${type}' not recognized.`, 'error');
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
    
    // FIX: Use the new /api/lookup endpoint which is now implemented in server.js
    fetch('/api/lookup', { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body: JSON.stringify({token})
    })
        .then(async (res) => { 
            // Check for non-OK status (404, 403, 500)
            if(!res.ok) {
                // Safely attempt to parse error message from JSON body 
                // This correctly pulls the 'Invalid token' message from the server response.
                const errorData = await res.json().catch(() => ({ error: 'Lookup failed' }));
                throw new Error(errorData.error || 'Lookup failed');
            }
            return res.json(); 
        })
        .then(app => setupEditMode(app, token))
        .catch((err) => showMessage(err.message, 'error'));
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
    // The members array needs to be loaded into state BEFORE the render function runs.
    if (app.applicationType === 'Consortium' && app.data.consortiumMembers) {
        setConsortiumMembers(app.data.consortiumMembers);
    } else {
        resetConsortiumMembers();
    }

    // 4. Render Form: Pass the data object to populate fields dynamically
    loadForm(app.applicationType, app.data);

    // 5. Populate Data (The new renderDynamicForm handles most population, 
    // but this ensures any dynamic state is initialized.)
    // Note: populateForm is now much simpler/redundant but kept for consistency.
    populateForm(formContainer, app.applicationType, app.data);

    showMessage('Loaded for editing', 'success');
}