/*
  ui.js
  -----
  Modals, Toasts, Clock, and Renderers
*/

import { createEl, isValidEmail, REGISTRATION_START, REGISTRATION_DEADLINE } from './utils.js';

// Helper to translate internal data types to display text
export function getDisplayType(type) { // FIX: Added 'export'
    if (type === 'Organization') return 'Organisation';
    return type;
}

// --- Messages / Toasts ---
export function showMessage(text, variant = 'error') {
  const messagesDiv = document.getElementById('messages');
  if (!messagesDiv) return;
  
  const el = createEl('div', { class: variant === 'error' ? 'error' : 'success' }, [text]);
  messagesDiv.innerHTML = ''; 
  messagesDiv.appendChild(el);
  
  // FIX: REMOVED AUTOMATIC SCROLLING
  // messagesDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  setTimeout(() => {
    if (el.parentNode === messagesDiv) {
      messagesDiv.removeChild(el);
    }
  }, 6000);
}

// --- Details Builder (Used in Candidate Page & Modals) ---
export function buildApplicationDetails(app) {
  const container = createEl('div', { class: 'candidate-detail-card' }); 
  
  // Helper to safely create and append detail elements
  function addDetail(parent, label, value) {
      if (value === undefined || value === null || value === '') return;
      
      let displayValue = value;
      if (typeof value === 'boolean') {
          displayValue = value ? 'Yes' : 'No';
      } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          displayValue = createEl('a', { href: value, target: '_blank', rel: 'noopener noreferrer' }, [value]);
      } else if (typeof value === 'string' && value.includes('@') && !value.includes(' ') && isValidEmail(value)) {
          displayValue = createEl('a', { href: 'mailto:' + value }, [value]);
      } else if (typeof value === 'string' && value.includes('\n')) {
          displayValue = createEl('pre', {}, [value]);
      }

      const detailEl = createEl('div', { class: 'detail' });
      detailEl.appendChild(createEl('span', {}, [label + ':']));
      
      if (typeof displayValue === 'object') {
          detailEl.appendChild(displayValue);
      } else {
          detailEl.appendChild(document.createTextNode(' ' + displayValue));
      }
      parent.appendChild(detailEl);
  }

  // --- 1. Top Grid ---
  const grid = createEl('div', { class: 'detail-grid' });
  addDetail(grid, 'Submitted At', new Date(app.submittedAt).toLocaleString());
  addDetail(grid, 'Application Type', getDisplayType(app.applicationType)); // USE HELPER
  
  if (app.applicationType === 'Individual') {
      addDetail(grid, 'Full Name', app.data.fullName);
      addDetail(grid, 'Contact Email', app.data.email);
      addDetail(grid, 'Geographic Representation', app.data.geographicRep);
      addDetail(grid, 'Stake ID', app.data.stakeId);
      addDetail(grid, 'DRep ID', app.data.DRepId);
      addDetail(grid, 'Social Profile', app.data.socialProfile);
      addDetail(grid, 'PoL Exempt', app.data.proofOfLifeExempt);
      addDetail(grid, 'PoL Link', app.data.proofOfLifeLink);
  } else if (app.applicationType === 'Organization') {
      addDetail(grid, 'Organisation Name', app.data.orgName);
      addDetail(grid, 'Contact Person', app.data.contactPerson);
      addDetail(grid, 'Contact Email', app.data.contactEmail);
      addDetail(grid, 'PoL Exempt', app.data.orgProofOfLifeExempt);
      addDetail(grid, 'PoL Link', app.data.orgProofOfLifeLink);
  } else if (app.applicationType === 'Consortium') {
      addDetail(grid, 'Consortium Name', app.data.consortiumName);
      addDetail(grid, 'Contact Person', app.data.consortiumContactPerson);
      addDetail(grid, 'Contact Email', app.data.consortiumContactEmail);
      addDetail(grid, 'PoL Exempt', app.data.consortiumProofOfLifeExempt);
      addDetail(grid, 'PoL Link', app.data.consortiumProofOfLifeLink);
  }
  container.appendChild(grid);

  // --- 2. Long Text Sections ---
  if (app.applicationType === 'Individual') {
      addDetail(container, 'Biography', app.data.biography);
      addDetail(container, 'Conflict of Interest', app.data.conflictOfInterest);
      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Platform']));
      addDetail(container, 'Motivation', app.data.motivation);
      addDetail(container, 'Experience', app.data.experience);
      addDetail(container, 'Transparency Approach', app.data.transparencyApproach);
  } else if (app.applicationType === 'Organization') {
      addDetail(container, 'Description', app.data.orgDescription);
      addDetail(container, 'Conflict of Interest', app.data.orgConflictOfInterest);
      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Platform']));
      addDetail(container, 'Motivation', app.data.orgMotivation);
      addDetail(container, 'Experience', app.data.orgExperience);
      addDetail(container, 'Transparency Approach', app.data.orgTransparencyApproach);
  } else if (app.applicationType === 'Consortium') {
      addDetail(container, 'Mission', app.data.consortiumMission);
      addDetail(container, 'Values', app.data.consortiumValues);
      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Platform']));
      addDetail(container, 'Motivation', app.data.consortiumMotivation);
      addDetail(container, 'Experience', app.data.consortiumExperience);
      addDetail(container, 'Transparency Approach', app.data.consortiumTransparencyApproach);
  }

  // --- 3. Members ---
  if (app.data.consortiumMembers && Array.isArray(app.data.consortiumMembers)) {
      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Consortium Members']));
      app.data.consortiumMembers.forEach((member, idx) => {
          const memberCard = createEl('div', { class: 'member-card' });
          memberCard.appendChild(createEl('h5', {}, [`Member ${idx + 1}: ${member.name}`]));
          const memberGrid = createEl('div', { class: 'detail-grid', style: 'border: none; padding: 0; margin: 0; gap: 0.5rem 1.5rem;' });
          addDetail(memberGrid, 'Region', member.geographicRep);
          addDetail(memberGrid, 'Stake ID', member.stakeId);
          addDetail(memberGrid, 'DRep ID', member.DRepId);
          addDetail(memberGrid, 'Social', member.socialProfile);
          memberCard.appendChild(memberGrid);
          addDetail(memberCard, 'Biography', member.biography);
          addDetail(memberCard, 'Conflict of Interest', member.conflictOfInterest);
          container.appendChild(memberCard);
      });
  }
  return container;
}

// --- Modals ---

export function openApplicationModal(app) {
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
  
  content.appendChild(createEl('div', { class: 'detail' }, [createEl('span', {}, ['Application Type:']), ' ' + getDisplayType(app.applicationType)])); // USE HELPER
  
  // Safe clone for display
  const safeApp = JSON.parse(JSON.stringify(app));
  if (safeApp.data) {
      delete safeApp.data.email;
      delete safeApp.data.contactEmail;
      delete safeApp.data.proofOfLifeLink;
      delete safeApp.data.orgProofOfLifeLink;
      delete safeApp.data.consortiumProofOfLifeLink;
  }

  content.appendChild(buildApplicationDetails(safeApp));

  const entryId = app.entryId || app.id;
  const viewButton = createEl('a', { 
    href: `/ccsnap/candidates/${entryId}`, 
    class: 'btn', 
    style: 'margin-top: 1.5rem; text-decoration: none;'
  }, ['View Full Profile']);
  content.appendChild(viewButton);

  modal.classList.remove('hidden');
}

export function closeApplicationModal() {
  const modal = document.getElementById('application-modal');
  if (modal) modal.classList.add('hidden');
}

export function openSuccessModal(message, entryId = null, editToken = null) {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#0033ad', '#1a5dd6', '#00a3c4', '#ffffff'] });
  }

  const modal = document.getElementById('success-modal');
  if (!modal) return;
  
  const content = modal.querySelector('.modal-content');
  content.innerHTML = '';
  const header = createEl('div', { class: 'modal-header' });
  header.appendChild(createEl('h3', {}, ['Success']));
  const closeBtn = createEl('button', { class: 'modal-close', 'aria-label': 'Close' }, ['×']);
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  header.appendChild(closeBtn);
  content.appendChild(header);
  content.appendChild(createEl('p', {}, [message]));
  
  if (entryId && editToken) {
    content.appendChild(createEl('hr', { style: 'margin: 1rem 0; border: 0; border-top: 1px solid #eee;' }));
    content.appendChild(createEl('p', { style: 'font-weight: 600; margin-bottom: 0.5rem;' }, ['Save this credential to edit later:']));
    
    content.appendChild(createEl('label', { style: 'font-size: 0.8rem; display:block; margin-bottom:0.25rem;' }, ['Secret Token']));
    
    const tokenContainer = createEl('div', { style: 'display: flex; gap: 0.5rem; margin-bottom: 0.75rem;' });
    const tokenInput = createEl('input', { 
        type: 'text', value: editToken, readonly: true, 
        style: 'flex-grow: 1; font-size: 0.9rem; background: #f9fafb; cursor: text;' 
    });
    tokenInput.addEventListener('click', () => tokenInput.select()); 
    
    const copyBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'padding: 0.6rem 0.75rem; font-size: 0.85rem;' }, ['Copy']);
    copyBtn.addEventListener('click', () => {
        tokenInput.select();
        tokenInput.setSelectionRange(0, 99999);
        try { document.execCommand('copy'); showMessage('Token copied!', 'success'); } 
        catch (e) { showMessage('Manual copy required', 'error'); }
    });
    
    tokenContainer.appendChild(tokenInput);
    tokenContainer.appendChild(copyBtn);
    content.appendChild(tokenContainer);
    content.appendChild(createEl('p', { class: 'helper-text', style: 'margin-top: 0.5rem; color: #dc2626;' }, ['Warning: If you lose this token, you cannot edit your submission.']));
  
    const viewButton = createEl('a', { 
        href: `/ccsnap/candidates/${entryId}`, 
        class: 'btn', 
        style: 'margin-top: 1rem; text-decoration: none; background: #065f46; border-color: #065f46;'
    }, ['View Your Submission']);
    content.appendChild(viewButton);
  }
  modal.classList.remove('hidden');
}

// --- Clock ---
export function initElectionClock() {
  const clockEl = document.getElementById('election-clock');
  if (!clockEl) return;

  setInterval(updateClock, 1000);
  updateClock(); 

  function updateClock() {
    const now = new Date().getTime();
    
    if (now < REGISTRATION_START) {
        const d = REGISTRATION_START - now;
        const days = Math.floor(d / (1000 * 60 * 60 * 24));
        const hours = Math.floor((d % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((d % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((d % (1000 * 60)) / 1000);
        clockEl.textContent = `Registration opens in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        clockEl.style.backgroundColor = "#065f46"; 
        return;
    }

    const dist = REGISTRATION_DEADLINE - now;
    if (dist < 0) {
      clockEl.textContent = "REGISTRATION IS CLOSED";
      clockEl.style.backgroundColor = "#dc2626";
      return;
    }

    const days = Math.floor(dist / (1000 * 60 * 60 * 24));
    const hours = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((dist % (1000 * 60)) / 1000);
    clockEl.textContent = `Time remaining to register: ${days}d ${hours}h ${minutes}m ${seconds}s`;
    clockEl.style.backgroundColor = "var(--primary-dark)";
  }
}