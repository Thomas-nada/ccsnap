/*
  forms.js
  --------
  Logic for Individual, Organization, and Consortium forms
*/

import { createEl, createFormGroup, createTextareaGroup, isValidEmail, isValidUrl, userId, BIO_LIMIT, MOTIVATION_LIMIT } from './utils.js';
import { showMessage, openSuccessModal } from './ui.js';

// Shared State for Consortium Members
let consortiumMembers = [];

// Helper to clear members when switching forms
export function resetConsortiumMembers() {
    consortiumMembers = [];
}

// Helper to set members (used when editing)
export function setConsortiumMembers(members) {
    consortiumMembers = members || [];
}

// --- NEW: Populate Form Logic ---
export function populateForm(formContainer, type, data) {
    // 1. Generic Field Population (Matches name="key" to data.key)
    const inputs = formContainer.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        if (data.hasOwnProperty(input.name)) {
            if (input.type !== 'checkbox' && input.type !== 'file') {
                input.value = data[input.name];
                // Trigger input event to update char counters
                input.dispatchEvent(new Event('input'));
            }
        }
    });

    // 2. Specific Checkbox Mapping (Because JSON keys differ from Input names)
    if (type === 'Individual') {
        if (data.proofOfLifeExempt) {
            const el = formContainer.querySelector('#hasPreviousIndividualProof');
            if (el) {
                el.checked = true;
                el.dispatchEvent(new Event('change')); // Trigger visibility toggle
            }
        }
    } else if (type === 'Organization') {
        if (data.orgProofOfLifeExempt) {
            const el = formContainer.querySelector('#hasPreviousOrgProof');
            if (el) {
                el.checked = true;
                el.dispatchEvent(new Event('change'));
            }
        }
    } else if (type === 'Consortium') {
        if (data.consortiumProofOfLifeExempt) {
            const el = formContainer.querySelector('#hasPreviousConsortiumProof');
            if (el) {
                el.checked = true;
                el.dispatchEvent(new Event('change'));
            }
        }
    }
}

// --- 1. Individual Form ---
export function renderIndividualForm(formContainer) {
  const form = formContainer;
  const steps = [];
  
  // Step 0: Basics
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Full Name or Alias', name: 'fullName', type: 'text', required: true, placeholder: 'Satoshi Nakamoto' }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'email', type: 'email', required: true, placeholder: 'your@email.com', helper: 'This email will be made public.' }));
  step0.appendChild(createFormGroup({ label: 'Geographic Representation', name: 'geographicRep', type: 'text', required: false, placeholder: 'Europe, Asia, etc.' }));
  steps.push(step0);

  // Step 1: Bio & Links
  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Biography', name: 'biography', required: true, maxLength: BIO_LIMIT, rows: 4 }));
  step1.appendChild(createFormGroup({ label: 'Conflict of Interest (if any)', name: 'conflictOfInterest', type: 'text', required: false }));
  step1.appendChild(createFormGroup({ label: 'Stake ID (if any)', name: 'stakeId', type: 'text', required: false }));
  step1.appendChild(createFormGroup({ label: 'DRep ID (if any)', name: 'DRepId', type: 'text', required: false }));
  step1.appendChild(createFormGroup({ label: 'Social Profile Link (if any)', name: 'socialProfile', type: 'url', required: false, helper: 'Must start with http:// or https://' }));
  steps.push(step1);

  // Step 2: Proof of Life
  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const proofGroup = createEl('div', { class: 'form-group' });
  proofGroup.appendChild(createEl('label', { for: 'proofOfLifeLink' }, ['Proof‑of‑Life Video Link ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]));
  const proofInput = createEl('input', { type: 'url', id: 'proofOfLifeLink', name: 'proofOfLifeLink', placeholder: 'Public video URL' });
  proofGroup.appendChild(proofInput);
  proofGroup.appendChild(createEl('div', { class: 'helper-text' }, ['Must start with http:// or https://']));
  
  const exemptionDiv = createEl('div', { class: 'form-group' });
  const exemptionCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousIndividualProof', name: 'hasPreviousIndividualProof' });
  exemptionDiv.appendChild(exemptionCheckbox);
  exemptionDiv.appendChild(createEl('label', { for: 'hasPreviousIndividualProof', class: 'helper-text', style: 'display:inline-block; margin-left:0.25rem;' }, ['I submitted PoL for a previous election.']));
  step2.appendChild(proofGroup);
  step2.appendChild(exemptionDiv);
  
  exemptionCheckbox.addEventListener('change', () => {
    if (exemptionCheckbox.checked) { proofGroup.classList.add('hidden'); proofInput.value = ''; } 
    else { proofGroup.classList.remove('hidden'); }
  });
  steps.push(step2);

  // Step 3: Platform
  const step3 = createEl('div', { class: 'form-step', dataset: { step: 3 } });
  step3.appendChild(createTextareaGroup({ label: 'Motivation for Serving', name: 'motivation', required: true, maxLength: MOTIVATION_LIMIT, rows: 4 }));
  step3.appendChild(createTextareaGroup({ label: 'Relevant Experience', name: 'experience', required: true, rows: 4 }));
  step3.appendChild(createTextareaGroup({ label: 'Transparency Approach', name: 'transparencyApproach', required: true, rows: 4 }));
  steps.push(step3);

  steps.forEach((s) => form.appendChild(s));
  setupMultiStepNav(form, steps, validateIndividualStep, handleSubmitIndividual);
}

function validateIndividualStep(stepIndex, formContainer) {
    if (stepIndex === 0) {
      const name = formContainer.querySelector('[name="fullName"]').value.trim();
      const email = formContainer.querySelector('[name="email"]').value.trim();
      if (!name || !email) { showMessage('Full name and email required.', 'error'); return false; }
      if (!isValidEmail(email)) { showMessage('Invalid email.', 'error'); return false; }
      return true;
    }
    if (stepIndex === 1) {
      const bio = formContainer.querySelector('[name="biography"]').value.trim();
      const social = formContainer.querySelector('[name="socialProfile"]').value.trim();
      if (!bio) { showMessage('Biography required.', 'error'); return false; }
      if (social && !isValidUrl(social)) { showMessage('Invalid social URL.', 'error'); return false; }
      return true;
    }
    if (stepIndex === 2) {
      const checked = formContainer.querySelector('#hasPreviousIndividualProof').checked;
      const url = formContainer.querySelector('#proofOfLifeLink').value.trim();
      if (!checked && !url) { showMessage('Proof of Life link required.', 'error'); return false; }
      if (!checked && url && !isValidUrl(url)) { showMessage('Invalid video URL.', 'error'); return false; }
      return true;
    }
    if (stepIndex === 3) {
      const m = formContainer.querySelector('[name="motivation"]').value.trim();
      const e = formContainer.querySelector('[name="experience"]').value.trim();
      const t = formContainer.querySelector('[name="transparencyApproach"]').value.trim();
      if (!m || !e || !t) { showMessage('All platform fields required.', 'error'); return false; }
      return true;
    }
    return true;
}

function handleSubmitIndividual(e, formContainer) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = Object.fromEntries(formData.entries());
  
  data.hasPreviousIndividualProof = formContainer.querySelector('#hasPreviousIndividualProof').checked;

  const application = {
    applicationType: 'Individual',
    submittedAt: Date.now(),
    userId: userId,
    data: {
      fullName: data.fullName,
      email: data.email,
      geographicRep: data.geographicRep || '',
      biography: data.biography,
      conflictOfInterest: data.conflictOfInterest || '',
      stakeId: data.stakeId || '',
      DRepId: data.DRepId || '',
      socialProfile: data.socialProfile || '',
      proofOfLifeLink: data.proofOfLifeLink || '',
      proofOfLifeExempt: data.hasPreviousIndividualProof,
      motivation: data.motivation,
      experience: data.experience,
      transparencyApproach: data.transparencyApproach,
    },
  };
  submitToServer(application, 'Individual');
}

// --- 2. Organization Form ---
export function renderOrganizationForm(formContainer) {
  const form = formContainer;
  const steps = [];
  
  // Step 0
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Organisation Name', name: 'orgName', type: 'text', required: true }));
  step0.appendChild(createFormGroup({ label: 'Contact Person', name: 'contactPerson', type: 'text', required: true }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'contactEmail', type: 'email', required: true }));
  steps.push(step0);
  
  // Step 1
  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Organisation Description', name: 'orgDescription', required: true, maxLength: BIO_LIMIT, rows: 4 }));
  step1.appendChild(createFormGroup({ label: 'Conflict of Interest', name: 'orgConflictOfInterest', type: 'text', required: false }));
  steps.push(step1);
  
  // Step 2: PoL
  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const proofGroup = createEl('div', { class: 'form-group' });
  proofGroup.appendChild(createEl('label', { for: 'orgProofOfLifeLink' }, ['Proof‑of‑Life Video Link ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]));
  const proofInput = createEl('input', { type: 'url', id: 'orgProofOfLifeLink', name: 'orgProofOfLifeLink', placeholder: 'Public video URL' });
  proofGroup.appendChild(proofInput);
  
  const exemptionDiv = createEl('div', { class: 'form-group' });
  const exemptionCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousOrgProof', name: 'hasPreviousOrgProof' });
  exemptionDiv.appendChild(exemptionCheckbox);
  exemptionDiv.appendChild(createEl('label', { for: 'hasPreviousOrgProof', class: 'helper-text', style: 'display:inline-block;' }, ['Organisation submitted PoL previously.']));
  step2.appendChild(proofGroup);
  step2.appendChild(exemptionDiv);
  
  exemptionCheckbox.addEventListener('change', () => {
    if (exemptionCheckbox.checked) { proofGroup.classList.add('hidden'); proofInput.value = ''; } 
    else { proofGroup.classList.remove('hidden'); }
  });
  steps.push(step2);

  // Step 3
  const step3 = createEl('div', { class: 'form-step', dataset: { step: 3 } });
  step3.appendChild(createTextareaGroup({ label: 'Experience', name: 'orgExperience', required: true, rows: 4 }));
  step3.appendChild(createTextareaGroup({ label: 'Transparency Approach', name: 'orgTransparencyApproach', required: true, rows: 4 }));
  step3.appendChild(createTextareaGroup({ label: 'Motivation', name: 'orgMotivation', required: true, maxLength: MOTIVATION_LIMIT, rows: 4 }));
  steps.push(step3);
  
  steps.forEach((s) => form.appendChild(s));
  setupMultiStepNav(form, steps, validateOrganizationStep, handleSubmitOrganisation);
}

function validateOrganizationStep(stepIndex, formContainer) {
    if (stepIndex === 0) {
        const name = formContainer.querySelector('[name="orgName"]').value.trim();
        const contact = formContainer.querySelector('[name="contactPerson"]').value.trim();
        const email = formContainer.querySelector('[name="contactEmail"]').value.trim();
        if (!name || !contact || !email) { showMessage('Name, contact person, and email required.', 'error'); return false; }
        if (!isValidEmail(email)) { showMessage('Invalid email.', 'error'); return false; }
        return true;
    }
    if (stepIndex === 1) {
        if (!formContainer.querySelector('[name="orgDescription"]').value.trim()) { showMessage('Description required.', 'error'); return false; }
        return true;
    }
    if (stepIndex === 2) {
        const checked = formContainer.querySelector('#hasPreviousOrgProof').checked;
        const url = formContainer.querySelector('#orgProofOfLifeLink').value.trim();
        if (!checked && !url) { showMessage('Proof of Life link required.', 'error'); return false; }
        if (!checked && url && !isValidUrl(url)) { showMessage('Invalid video URL.', 'error'); return false; }
        return true;
    }
    if (stepIndex === 3) {
        const e = formContainer.querySelector('[name="orgExperience"]').value.trim();
        const t = formContainer.querySelector('[name="orgTransparencyApproach"]').value.trim();
        const m = formContainer.querySelector('[name="orgMotivation"]').value.trim();
        if (!e || !t || !m) { showMessage('All fields required.', 'error'); return false; }
        return true;
    }
    return true;
}

function handleSubmitOrganisation(e, formContainer) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = Object.fromEntries(formData.entries());
  data.hasPreviousOrgProof = formContainer.querySelector('#hasPreviousOrgProof').checked;

  const application = {
    applicationType: 'Organization',
    submittedAt: Date.now(),
    userId: userId,
    data: {
      orgName: data.orgName,
      contactPerson: data.contactPerson,
      contactEmail: data.contactEmail,
      orgDescription: data.orgDescription,
      orgConflictOfInterest: data.orgConflictOfInterest || '',
      orgProofOfLifeLink: data.orgProofOfLifeLink || '',
      orgProofOfLifeExempt: data.hasPreviousOrgProof,
      orgExperience: data.orgExperience,
      orgTransparencyApproach: data.orgTransparencyApproach,
      orgMotivation: data.orgMotivation,
    },
  };
  submitToServer(application, 'Organisation');
}

// --- 3. Consortium Form ---
export function renderConsortiumForm(formContainer) {
  const form = formContainer;
  const steps = [];
  
  // Step 0
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Consortium Name', name: 'consortiumName', type: 'text', required: true }));
  step0.appendChild(createFormGroup({ label: 'Contact Person', name: 'consortiumContactPerson', type: 'text', required: true }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'consortiumContactEmail', type: 'email', required: true }));
  steps.push(step0);
  
  // Step 1
  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Mission (Optional)', name: 'consortiumMission', required: false, rows: 3 }));
  step1.appendChild(createTextareaGroup({ label: 'Values (Optional)', name: 'consortiumValues', required: false, rows: 3 }));
  steps.push(step1);
  
  // Step 2: PoL
  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const proofGroup = createEl('div', { class: 'form-group' });
  proofGroup.appendChild(createEl('label', { for: 'consortiumProofOfLifeLink' }, ['Proof‑of‑Life (Contact Person) ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]));
  const proofInput = createEl('input', { type: 'url', id: 'consortiumProofOfLifeLink', name: 'consortiumProofOfLifeLink', placeholder: 'Public video URL' });
  proofGroup.appendChild(proofInput);
  
  const exemptionDiv = createEl('div', { class: 'form-group' });
  const exemptionCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousConsortiumProof', name: 'hasPreviousConsortiumProof' });
  exemptionDiv.appendChild(exemptionCheckbox);
  exemptionDiv.appendChild(createEl('label', { for: 'hasPreviousConsortiumProof', class: 'helper-text', style: 'display:inline-block;' }, ['Exempt (50%+ members participated previously).']));
  step2.appendChild(proofGroup);
  step2.appendChild(exemptionDiv);
  
  exemptionCheckbox.addEventListener('change', () => {
    if (exemptionCheckbox.checked) { proofGroup.classList.add('hidden'); proofInput.value = ''; } 
    else { proofGroup.classList.remove('hidden'); }
  });
  steps.push(step2);

  // Step 3
  const step3 = createEl('div', { class: 'form-step', dataset: { step: 3 } });
  step3.appendChild(createTextareaGroup({ label: 'Motivation', name: 'consortiumMotivation', required: true, maxLength: MOTIVATION_LIMIT, rows: 4 }));
  step3.appendChild(createTextareaGroup({ label: 'Experience', name: 'consortiumExperience', required: true, rows: 4 }));
  step3.appendChild(createTextareaGroup({ label: 'Transparency Approach', name: 'consortiumTransparencyApproach', required: true, rows: 4 }));
  steps.push(step3);
  
  // Step 4: Members
  const step4 = createEl('div', { class: 'form-step', dataset: { step: 4 } });
  function renderMembers() {
    step4.innerHTML = '';
    step4.appendChild(createEl('h3', { style: 'margin-bottom:0.5rem;' }, ['Consortium Members']));
    const membersContainer = createEl('div', { id: 'members-container' });
    if (consortiumMembers.length === 0) consortiumMembers.push({ name: '', geographicRep: '', biography: '', conflictOfInterest: '', stakeId: '', DRepId: '', socialProfile: '' });
    
    consortiumMembers.forEach((member, index) => {
      const card = createEl('div', { class: 'member-card' });
      const header = createEl('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;' }, [createEl('span', { style: 'font-weight:600;' }, [`Member ${index + 1}`])]);
      if (consortiumMembers.length > 1) {
        const removeBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'padding:0.25rem 0.5rem; font-size:0.75rem;' }, ['Remove']);
        removeBtn.addEventListener('click', () => { consortiumMembers.splice(index, 1); renderMembers(); });
        header.appendChild(removeBtn);
      }
      card.appendChild(header);
      // NOTE: Values here are populated from the consortiumMembers array which is set via setConsortiumMembers
      card.appendChild(createFormGroup({ label: 'Name', name: `mName${index}`, value: member.name, required: true, onInput: e => member.name = e.target.value }));
      card.appendChild(createFormGroup({ label: 'Region', name: `mRep${index}`, value: member.geographicRep, onInput: e => member.geographicRep = e.target.value }));
      card.appendChild(createTextareaGroup({ label: 'Biography', name: `mBio${index}`, value: member.biography, required: true, rows: 2, onInput: e => member.biography = e.target.value }));
      card.appendChild(createFormGroup({ label: 'Conflict of Interest', name: `mCon${index}`, value: member.conflictOfInterest, onInput: e => member.conflictOfInterest = e.target.value }));
      card.appendChild(createFormGroup({ label: 'Stake ID', name: `mStake${index}`, value: member.stakeId, onInput: e => member.stakeId = e.target.value }));
      card.appendChild(createFormGroup({ label: 'DRep ID', name: `mDRep${index}`, value: member.DRepId, onInput: e => member.DRepId = e.target.value }));
      card.appendChild(createFormGroup({ label: 'Social', name: `mSoc${index}`, value: member.socialProfile, onInput: e => member.socialProfile = e.target.value }));
      membersContainer.appendChild(card);
    });
    step4.appendChild(membersContainer);
    const addBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-top:0.5rem;' }, ['Add Member']);
    addBtn.addEventListener('click', () => { consortiumMembers.push({ name: '', geographicRep: '', biography: '', conflictOfInterest: '', stakeId: '', DRepId: '', socialProfile: '' }); renderMembers(); });
    step4.appendChild(addBtn);
  }
  renderMembers();
  steps.push(step4);

  steps.forEach((s) => form.appendChild(s));
  setupMultiStepNav(form, steps, validateConsortiumStep, handleSubmitConsortium);
}

function validateConsortiumStep(stepIndex, formContainer) {
    if (stepIndex === 0) {
        if (!formContainer.querySelector('[name="consortiumName"]').value.trim() || !formContainer.querySelector('[name="consortiumContactEmail"]').value.trim()) { showMessage('Basics required.', 'error'); return false; }
        return true;
    }
    if (stepIndex === 2) { // PoL
        const checked = formContainer.querySelector('#hasPreviousConsortiumProof').checked;
        const url = formContainer.querySelector('#consortiumProofOfLifeLink').value.trim();
        if (!checked && !url) { showMessage('PoL required.', 'error'); return false; }
        return true;
    }
    if (stepIndex === 3) { // Platform
        if (!formContainer.querySelector('[name="consortiumMotivation"]').value.trim()) { showMessage('Motivation required.', 'error'); return false; }
        return true;
    }
    if (stepIndex === 4) { // Members
        if (consortiumMembers.length === 0) { showMessage('Add a member.', 'error'); return false; }
        for (let m of consortiumMembers) { if (!m.name.trim() || !m.biography.trim()) { showMessage('Member name/bio required.', 'error'); return false; } }
        return true;
    }
    return true;
}

function handleSubmitConsortium(e, formContainer) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = Object.fromEntries(formData.entries());
  data.hasPreviousConsortiumProof = formContainer.querySelector('#hasPreviousConsortiumProof').checked;

  const application = {
    applicationType: 'Consortium',
    submittedAt: Date.now(),
    userId: userId,
    data: {
      consortiumName: data.consortiumName,
      consortiumContactPerson: data.consortiumContactPerson,
      consortiumContactEmail: data.consortiumContactEmail,
      consortiumMission: data.consortiumMission,
      consortiumValues: data.consortiumValues,
      consortiumMotivation: data.consortiumMotivation,
      consortiumExperience: data.consortiumExperience,
      consortiumTransparencyApproach: data.consortiumTransparencyApproach,
      consortiumProofOfLifeLink: data.consortiumProofOfLifeLink,
      consortiumProofOfLifeExempt: data.hasPreviousConsortiumProof,
      consortiumMembers: consortiumMembers,
    },
  };
  submitToServer(application, 'Consortium');
}

// --- Shared Nav Logic ---
function setupMultiStepNav(form, steps, validator, submitHandler) {
  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem; display: flex; justify-content: space-between;' });
  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'display:none; margin-right:0.5rem;' }, ['Previous']);
  
  let current = 0;
  const showStep = (i) => {
      steps.forEach((s, idx) => s.style.display = idx === i ? '' : 'none');
      prevBtn.style.display = i === 0 ? 'none' : '';
      nextBtn.textContent = i === steps.length - 1 ? (window.isEditMode ? 'Update' : 'Submit') : 'Next';
  };
  
  prevBtn.addEventListener('click', () => { if (current > 0) { current--; showStep(current); } });
  nextBtn.addEventListener('click', () => {
      if (!validator(current, form)) return;
      if (current < steps.length - 1) { current++; showStep(current); } 
      else { form.requestSubmit(); }
  });
  form.onsubmit = (e) => submitHandler(e, form);
  
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  form.appendChild(nav);
  showStep(0);
}

// --- Network Submission ---
function submitToServer(application, typeLabel) {
  if (window.isEditMode) {
    application.entryId = window.editEntryId;
    application.editToken = window.editToken;
  }

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(application),
  })
    .then(async (res) => { 
      if (!res.ok) throw new Error((await res.json()).error || 'Submission failed');
      return res.json();
    })
    .then((data) => {
      showMessage(`${typeLabel} application ${window.isEditMode ? 'updated' : 'submitted'} successfully!`, 'success');
      openSuccessModal('Application received!', data.entryId, data.editToken);
      if (window.isEditMode) setTimeout(() => { window.location.href = '/ccsnap/candidates'; }, 2000);
    })
    .catch((err) => showMessage(err.message, 'error'));
}