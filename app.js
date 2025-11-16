/*
  Candidate Application Demo
  --------------------------
*/

// ---------- Constants ----------
const BIO_LIMIT = 500;
const MOTIVATION_LIMIT = 1000;
const STORAGE_KEY = 'ccApplications';
const USER_ID_KEY = 'ccUserId';

// DEADLINE: November 25, 2025, 12:00 UTC
const REGISTRATION_DEADLINE = new Date('2025-11-25T12:00:00Z').getTime();

function getUserId() {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

const userId = getUserId();

// ---------- DOM Helpers ----------

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataVal]) => {
        el.dataset[dataKey] = dataVal;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.substring(2), value);
    } else if (value !== null && value !== undefined) {
      el.setAttribute(key, value);
    }
  });
  children.forEach((child) => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  });
  return el;
}

// ---------- State ----------

let currentFormType = null;
let consortiumMembers = []; 

// Root elements
const formContainer = document.getElementById('application-form');
const messagesDiv = document.getElementById('messages');
const applicationsList = document.getElementById('applications-list');
const formSwitchButtons = document.querySelectorAll('#form-switch button');

if (formSwitchButtons) {
  formSwitchButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      switchForm(type);
    });
  });
}

function switchForm(type) {
  currentFormType = type;
  if (formSwitchButtons) {
    formSwitchButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
  }
  if (messagesDiv) messagesDiv.innerHTML = '';
  if (type !== 'Consortium') {
    consortiumMembers = [];
  }
  renderForm(type);
}

function renderForm(type) {
  if (!formContainer) return;
  formContainer.innerHTML = '';

  // CHECK DEADLINE
  if (Date.now() > REGISTRATION_DEADLINE) {
    formContainer.innerHTML = `
      <div class="guide" style="text-align:center; padding: 3rem;">
        <h3 style="color: #dc2626; border:none;">Registration Closed</h3>
        <p>The deadline for candidate submissions has passed (Nov 25, 2025).</p>
        <p>New applications and edits are no longer accepted.</p>
      </div>
    `;
    // Also hide switch buttons and manual edit trigger
    const switchNav = document.getElementById('form-switch');
    if (switchNav) switchNav.style.display = 'none';
    const manualTrigger = document.getElementById('btn-show-edit-input');
    if (manualTrigger && manualTrigger.parentNode) manualTrigger.parentNode.style.display = 'none';
    return;
  }

  if (type === 'Individual') {
    renderIndividualForm();
  } else if (type === 'Organization') {
    renderOrganizationForm();
  } else if (type === 'Consortium') {
    renderConsortiumForm();
  }
}

function showMessage(text, variant = 'error') {
  if (!messagesDiv) return;
  const el = createEl('div', { class: variant === 'error' ? 'error' : 'success' }, [text]);
  messagesDiv.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }, 6000);
}

// -------- Individual Form --------
function renderIndividualForm() {
  const form = formContainer;
  const steps = [];
  
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Full Name or Alias', name: 'fullName', type: 'text', required: true, placeholder: 'Satoshi Nakamoto' }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'email', type: 'email', required: true, placeholder: 'your@email.com' }));
  step0.appendChild(createFormGroup({ label: 'Geographic Representation', name: 'geographicRep', type: 'text', required: false, placeholder: 'Europe, Asia, etc.', helper: 'Optional – your region or area represented.' }));
  steps.push(step0);

  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Biography', name: 'biography', required: true, maxLength: BIO_LIMIT, rows: 4, helper: `Tell us about yourself (max ${BIO_LIMIT} characters).` }));
  step1.appendChild(createFormGroup({ label: 'Conflict of Interest (if any)', name: 'conflictOfInterest', type: 'text', required: false, placeholder: 'Describe any conflicts of interest' }));
  step1.appendChild(createFormGroup({ label: 'Stake ID (if any)', name: 'stakeId', type: 'text', required: false, placeholder: 'Optional stake key or account' }));
  step1.appendChild(createFormGroup({ label: 'dRep ID (if any)', name: 'dRepId', type: 'text', required: false, placeholder: 'Optional dRep identifier' }));
  step1.appendChild(createFormGroup({ label: 'Social Profile Link (if any)', name: 'socialProfile', type: 'url', required: false, placeholder: 'https://twitter.com/yourhandle' }));
  steps.push(step1);

  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const proofGroup = createEl('div', { class: 'form-group' });
  const proofLabel = createEl('label', { for: 'proofOfLifeLink' }, ['Proof‑of‑Life Video Link ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]);
  proofGroup.appendChild(proofLabel);
  const proofInput = createEl('input', { type: 'url', id: 'proofOfLifeLink', name: 'proofOfLifeLink', placeholder: 'https://youtube.com/link-to-video' });
  proofGroup.appendChild(proofInput);
  const exemptionDiv = createEl('div', { class: 'form-group' });
  const exemptionCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousIndividualProof', name: 'hasPreviousIndividualProof' });
  const exemptionLabel = createEl('label', { for: 'hasPreviousIndividualProof', class: 'helper-text', style: 'display:inline-block; margin-left:0.25rem;' }, ['I have previously submitted a Proof‑of‑Life video for an earlier election.']);
  exemptionDiv.appendChild(exemptionCheckbox);
  exemptionDiv.appendChild(exemptionLabel);
  step2.appendChild(proofGroup);
  step2.appendChild(exemptionDiv);
  steps.push(step2);

  function toggleProofVisibility() {
    if (exemptionCheckbox.checked) {
      proofGroup.classList.add('hidden');
      proofInput.value = ''; 
    } else {
      proofGroup.classList.remove('hidden');
    }
  }
  exemptionCheckbox.addEventListener('change', toggleProofVisibility);
  toggleProofVisibility();

  const step3 = createEl('div', { class: 'form-step', dataset: { step: 3 } });
  step3.appendChild(createTextareaGroup({ label: 'Motivation for Serving', name: 'motivation', required: true, maxLength: MOTIVATION_LIMIT, rows: 4, helper: `Explain why you want to serve (max ${MOTIVATION_LIMIT} characters).` }));
  step3.appendChild(createTextareaGroup({ label: 'Relevant Governance or Constitutional Experience', name: 'experience', required: true, rows: 4, helper: 'Describe any past experience in governance, law, policy or community leadership.' }));
  step3.appendChild(createTextareaGroup({ label: 'Communication & Transparency Approach', name: 'transparencyApproach', required: true, rows: 4, helper: 'Describe your plan for regular communication and maintaining transparency.' }));
  steps.push(step3);

  steps.forEach((s) => form.appendChild(s));

  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem;' });
  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-right:0.5rem;' }, ['Previous']);
  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  form.appendChild(nav);

  let current = 0;
  showStep(current);

  prevBtn.addEventListener('click', () => {
    if (current > 0) {
      current--;
      showStep(current);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (!validateIndividualStep(current)) return;
    if (current < steps.length - 1) {
      current++;
      showStep(current);
    } else {
      form.requestSubmit();
    }
  });

  function showStep(idx) {
    steps.forEach((stepDiv, i) => {
      stepDiv.style.display = i === idx ? '' : 'none';
    });
    prevBtn.style.display = idx === 0 ? 'none' : '';
    nextBtn.textContent = idx === steps.length - 1 ? (window.isEditMode ? 'Update' : 'Submit') : 'Next';
  }

  function validateIndividualStep(stepIndex) {
    if (stepIndex === 0) {
      const nameInput = formContainer.querySelector('[name="fullName"]');
      const emailInput = formContainer.querySelector('[name="email"]');
      if (!nameInput.value.trim() || !emailInput.value.trim()) {
        showMessage('Please fill out your full name and email.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      const bioInput = formContainer.querySelector('[name="biography"]');
      if (!bioInput.value.trim()) {
        showMessage('Please provide your biography.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 2) {
      const proofCheckbox = formContainer.querySelector('#hasPreviousIndividualProof');
      const proofUrl = formContainer.querySelector('#proofOfLifeLink');
      if (!proofCheckbox.checked && !proofUrl.value.trim()) {
        showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 3) {
      const motiv = formContainer.querySelector('[name="motivation"]');
      const exp = formContainer.querySelector('[name="experience"]');
      const trans = formContainer.querySelector('[name="transparencyApproach"]');
      if (!motiv.value.trim() || !exp.value.trim() || !trans.value.trim()) {
        showMessage('Please fill out motivation, experience and transparency approach.', 'error');
        return false;
      }
      return true;
    }
    return true;
  }
  form.onsubmit = (e) => handleSubmitIndividual(e);
}

function handleSubmitIndividual(e) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value.trim();
  });
  data.hasPreviousIndividualProof = formContainer.querySelector('#hasPreviousIndividualProof').checked;

  // Basic validation
  if (!data.fullName || !data.email || !data.biography || !data.motivation || !data.experience || !data.transparencyApproach) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  if (!data.hasPreviousIndividualProof && !data.proofOfLifeLink) {
    showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
    return;
  }
  
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
      dRepId: data.dRepId || '',
      socialProfile: data.socialProfile || '',
      proofOfLifeLink: data.proofOfLifeLink || '',
      proofOfLifeExempt: data.hasPreviousIndividualProof,
      motivation: data.motivation,
      experience: data.experience,
      transparencyApproach: data.transparencyApproach,
    },
  };

  if (window.isEditMode) {
    application.entryId = window.editEntryId;
    application.editToken = window.editToken;
  }

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(application),
  })
    .then((res) => {
      if (!res.ok) {
        if (res.status === 403) throw new Error('Registration Closed');
        throw new Error('Submission failed');
      }
      return res.json();
    })
    .then((data) => {
      if (window.isEditMode) {
        showMessage('Application updated successfully!', 'success');
        openSuccessModal('Your individual application has been updated!');
      } else {
        showMessage('Individual application submitted successfully!', 'success');
        openSuccessModal('Your individual application has been submitted!', data.entryId, data.editToken);
      }
      
      switchForm('Individual');
      if (window.isEditMode) {
        // FIX 1: Correct redirect path
        setTimeout(() => { window.location.href = '/ccsnap/candidates'; }, 2000);
      } else {
        loadApplications();
      }
    })
    .catch((err) => {
      console.error(err);
      showMessage(err.message === 'Registration Closed' ? 'Submission failed: Registration is closed.' : 'Failed to submit application to the server.', 'error');
    });
}

// -------- Organisation Form --------
function renderOrganizationForm() {
  const form = formContainer;
  const steps = [];
  
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Organisation Name', name: 'orgName', type: 'text', required: true, placeholder: 'Cardano Association' }));
  step0.appendChild(createFormGroup({ label: 'Contact Person', name: 'contactPerson', type: 'text', required: true, placeholder: 'Jane Doe' }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'contactEmail', type: 'email', required: true, placeholder: 'contact@organisation.com' }));
  steps.push(step0);
  
  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Organisation Description', name: 'orgDescription', required: true, maxLength: BIO_LIMIT, rows: 4, helper: `Describe your organisation (max ${BIO_LIMIT} characters).` }));
  step1.appendChild(createFormGroup({ label: 'Conflict of Interest (if any)', name: 'orgConflictOfInterest', type: 'text', required: false, placeholder: 'Describe any conflicts of interest' }));
  steps.push(step1);
  
  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const orgProofGroup = createEl('div', { class: 'form-group' });
  orgProofGroup.appendChild(createEl('label', { for: 'orgProofOfLifeLink' }, ['Proof‑of‑Life Video Link ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]));
  const orgProofInput = createEl('input', { type: 'url', id: 'orgProofOfLifeLink', name: 'orgProofOfLifeLink', placeholder: 'https://youtube.com/link-to-video' });
  orgProofGroup.appendChild(orgProofInput);
  const orgExemptionDiv = createEl('div', { class: 'form-group' });
  const orgCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousOrgProof', name: 'hasPreviousOrgProof' });
  const orgLabel = createEl('label', { for: 'hasPreviousOrgProof', class: 'helper-text', style: 'display:inline-block; margin-left:0.25rem;' }, ['Organisation has previously submitted a Proof‑of‑Life video.']);
  orgExemptionDiv.appendChild(orgCheckbox);
  orgExemptionDiv.appendChild(orgLabel);
  step2.appendChild(orgProofGroup);
  step2.appendChild(orgExemptionDiv);
  steps.push(step2);

  function toggleOrgProofVisibility() {
    if (orgCheckbox.checked) {
      orgProofGroup.classList.add('hidden');
      orgProofInput.value = '';
    } else {
      orgProofGroup.classList.remove('hidden');
    }
  }
  orgCheckbox.addEventListener('change', toggleOrgProofVisibility);
  toggleOrgProofVisibility();

  const step3 = createEl('div', { class: 'form-step', dataset: { step: 3 } });
  step3.appendChild(createTextareaGroup({ label: 'Relevant Governance or Constitutional Experience', name: 'orgExperience', required: true, rows: 4, helper: 'Describe your organisation’s past experience in governance, law or policy.' }));
  step3.appendChild(createTextareaGroup({ label: 'Communication & Transparency Approach', name: 'orgTransparencyApproach', required: true, rows: 4, helper: 'Describe your organisation’s plan for communication and transparency.' }));
  step3.appendChild(createTextareaGroup({ label: 'Motivation for Serving', name: 'orgMotivation', required: true, maxLength: MOTIVATION_LIMIT, rows: 4, helper: `Explain why your organisation wants to serve (max ${MOTIVATION_LIMIT} characters).` }));
  steps.push(step3);
  
  steps.forEach((s) => form.appendChild(s));
  
  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem;' });
  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-right:0.5rem;' }, ['Previous']);
  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  form.appendChild(nav);
  
  let current = 0;
  showStep(current);
  
  prevBtn.addEventListener('click', () => {
    if (current > 0) {
      current--;
      showStep(current);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (!validateOrganizationStep(current)) return;
    if (current < steps.length - 1) {
      current++;
      showStep(current);
    } else {
      form.requestSubmit();
    }
  });

  function showStep(idx) {
    steps.forEach((stepDiv, i) => {
      stepDiv.style.display = i === idx ? '' : 'none';
    });
    prevBtn.style.display = idx === 0 ? 'none' : '';
    nextBtn.textContent = idx === steps.length - 1 ? (window.isEditMode ? 'Update' : 'Submit') : 'Next';
  }

  function validateOrganizationStep(stepIndex) {
    if (stepIndex === 0) {
      const name = formContainer.querySelector('[name="orgName"]');
      const contact = formContainer.querySelector('[name="contactPerson"]');
      const email = formContainer.querySelector('[name="contactEmail"]');
      if (!name.value.trim() || !contact.value.trim() || !email.value.trim()) {
        showMessage('Please fill out organisation name, contact person and contact email.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      const description = formContainer.querySelector('[name="orgDescription"]');
      if (!description.value.trim()) {
        showMessage('Please provide your organisation description.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 2) {
      const proofCheckbox = formContainer.querySelector('#hasPreviousOrgProof');
      const proofUrl = formContainer.querySelector('#orgProofOfLifeLink');
      if (!proofCheckbox.checked && (!proofUrl || !proofUrl.value.trim())) {
        showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 3) {
      const experience = formContainer.querySelector('[name="orgExperience"]');
      const transparency = formContainer.querySelector('[name="orgTransparencyApproach"]');
      const motivation = formContainer.querySelector('[name="orgMotivation"]');
      if (!experience.value.trim() || !transparency.value.trim() || !motivation.value.trim()) {
        showMessage('Please fill out experience, transparency approach and motivation.', 'error');
        return false;
      }
      return true;
    }
    return true;
  }
  form.onsubmit = (e) => handleSubmitOrganisation(e);
}

function handleSubmitOrganisation(e) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value.trim();
  });
  data.hasPreviousOrgProof = formContainer.querySelector('#hasPreviousOrgProof').checked;
  
  if (!data.orgName || !data.contactPerson || !data.contactEmail || !data.orgDescription || !data.orgExperience || !data.orgTransparencyApproach || !data.orgMotivation) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  if (!data.hasPreviousOrgProof && !data.orgProofOfLifeLink) {
    showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
    return;
  }

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

  if (window.isEditMode) {
    application.entryId = window.editEntryId;
    application.editToken = window.editToken;
  }

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(application),
  })
    .then((res) => {
      if (!res.ok) {
        if (res.status === 403) throw new Error('Registration Closed');
        throw new Error('Submission failed');
      }
      return res.json();
    })
    .then((data) => {
      if (window.isEditMode) {
        showMessage('Application updated successfully!', 'success');
        openSuccessModal('Your organisation application has been updated!');
      } else {
        showMessage('Organisation application submitted successfully!', 'success');
        openSuccessModal('Your organisation application has been submitted!', data.entryId, data.editToken);
      }
      switchForm('Organization');
      if (window.isEditMode) {
        // Correct redirect path
        setTimeout(() => { window.location.href = '/ccsnap/candidates'; }, 2000);
      } else {
        loadApplications();
      }
    })
    .catch((err) => {
      console.error(err);
      showMessage(err.message === 'Registration Closed' ? 'Submission failed: Registration is closed.' : 'Failed to submit application to the server.', 'error');
    });
}

// -------- Consortium Form --------
function renderConsortiumForm() {
  const form = formContainer;
  const steps = [];
  
  // Step 0: Identity
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Consortium Name', name: 'consortiumName', type: 'text', required: true, placeholder: 'Consortium of Innovators' }));
  step0.appendChild(createFormGroup({ label: 'Contact Person', name: 'consortiumContactPerson', type: 'text', required: true, placeholder: 'Jane Doe' }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'consortiumContactEmail', type: 'email', required: true, placeholder: 'consortium@example.com' }));
  steps.push(step0);
  
  // Step 1: Mission & Values
  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Mission', name: 'consortiumMission', required: false, rows: 3, helper: 'Optional – describe the mission of your consortium.' }));
  step1.appendChild(createTextareaGroup({ label: 'Values', name: 'consortiumValues', required: false, rows: 3, helper: 'Optional – describe core values of the consortium.' }));
  steps.push(step1);
  
  // Step 2: Proof-of-Life (Contact Person) -- NEW STEP
  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  
  // Proof of Life Input Group
  const consProofGroup = createEl('div', { class: 'form-group' });
  consProofGroup.appendChild(createEl('label', { for: 'consortiumProofOfLifeLink' }, ['Proof‑of‑Life Video Link (Contact Person) ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]));
  const consProofInput = createEl('input', { type: 'url', id: 'consortiumProofOfLifeLink', name: 'consortiumProofOfLifeLink', placeholder: 'https://youtube.com/link-to-video' });
  consProofGroup.appendChild(consProofInput);
  
  // Exemption Group
  const consExemptionDiv = createEl('div', { class: 'form-group' });
  const consCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousConsortiumProof', name: 'hasPreviousConsortiumProof' });
  const consLabel = createEl('label', { for: 'hasPreviousConsortiumProof', class: 'helper-text', style: 'display:inline-block; margin-left:0.25rem;' }, ['Consortium qualifies for exemption (e.g. >50% previous candidates).']);
  consExemptionDiv.appendChild(consCheckbox);
  consExemptionDiv.appendChild(consLabel);

  // Disclaimer
  const disclaimer = createEl('div', { class: 'helper-text', style: 'margin-top: 1rem; padding: 0.5rem; background-color: var(--surface-alt); border-radius: 6px; border: 1px solid var(--border); font-style: italic;' }, [
    'Disclaimer: The Contact Person vouches for each member whether they applied previously or not.'
  ]);

  step2.appendChild(consProofGroup);
  step2.appendChild(consExemptionDiv);
  step2.appendChild(disclaimer);
  steps.push(step2);

  // Toggle Visibility Logic
  function toggleConsProofVisibility() {
    if (consCheckbox.checked) {
      consProofGroup.classList.add('hidden');
      consProofInput.value = '';
    } else {
      consProofGroup.classList.remove('hidden');
    }
  }
  consCheckbox.addEventListener('change', toggleConsProofVisibility);
  toggleConsProofVisibility();

  // Step 3: Motivation & Experience (Previously Step 2)
  const step3 = createEl('div', { class: 'form-step', dataset: { step: 3 } });
  step3.appendChild(createTextareaGroup({ label: 'Motivation for Serving', name: 'consortiumMotivation', required: true, maxLength: MOTIVATION_LIMIT, rows: 4, helper: `Explain why your consortium wants to serve (max ${MOTIVATION_LIMIT} characters).` }));
  step3.appendChild(createTextareaGroup({ label: 'Relevant Governance or Constitutional Experience', name: 'consortiumExperience', required: true, rows: 4, helper: 'Describe any past experience in governance, law or policy.' }));
  step3.appendChild(createTextareaGroup({ label: 'Communication & Transparency Approach', name: 'consortiumTransparencyApproach', required: true, rows: 4, helper: 'Describe your plan for communication and transparency.' }));
  steps.push(step3);
  
  // Step 4: Members (Previously Step 3)
  const step4 = createEl('div', { class: 'form-step', dataset: { step: 4 } });
  function renderMembers() {
    step4.innerHTML = '';
    step4.appendChild(createEl('h3', { style: 'margin-bottom:0.5rem;' }, ['Consortium Members']));
    const membersContainer = createEl('div', { id: 'members-container' });
    if (consortiumMembers.length === 0) {
      consortiumMembers.push(createEmptyMember());
    }
    consortiumMembers.forEach((member, index) => {
      renderMemberForm(membersContainer, index, renderMembers);
    });
    step4.appendChild(membersContainer);
    const addMemberBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-top:0.5rem;' }, ['Add Member']);
    addMemberBtn.addEventListener('click', () => {
      consortiumMembers.push(createEmptyMember());
      renderMembers();
    });
    step4.appendChild(addMemberBtn);
  }
  renderMembers();
  steps.push(step4);
  
  steps.forEach((s) => form.appendChild(s));
  
  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem;' });
  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-right:0.5rem;' }, ['Previous']);
  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  form.appendChild(nav);
  
  let current = 0;
  showStep(current);
  prevBtn.addEventListener('click', () => {
    if (current > 0) {
      current--;
      showStep(current);
    }
  });
  nextBtn.addEventListener('click', () => {
    if (!validateConsortiumStep(current)) return;
    if (current < steps.length - 1) {
      current++;
      showStep(current);
    } else {
      form.requestSubmit();
    }
  });

  function showStep(idx) {
    steps.forEach((stepDiv, i) => {
      stepDiv.style.display = i === idx ? '' : 'none';
    });
    prevBtn.style.display = idx === 0 ? 'none' : '';
    nextBtn.textContent = idx === steps.length - 1 ? (window.isEditMode ? 'Update' : 'Submit') : 'Next';
  }

  function validateConsortiumStep(stepIndex) {
    // Step 0: Identity
    if (stepIndex === 0) {
      const name = formContainer.querySelector('[name="consortiumName"]');
      const contact = formContainer.querySelector('[name="consortiumContactPerson"]');
      const email = formContainer.querySelector('[name="consortiumContactEmail"]');
      if (!name.value.trim() || !contact.value.trim() || !email.value.trim()) {
        showMessage('Please fill out consortium name, contact person and email.', 'error');
        return false;
      }
      return true;
    }
    // Step 1: Mission (Optional)
    if (stepIndex === 1) {
      return true;
    }
    // Step 2: Proof of Life
    if (stepIndex === 2) {
        const proofCheckbox = formContainer.querySelector('#hasPreviousConsortiumProof');
        const proofUrl = formContainer.querySelector('#consortiumProofOfLifeLink');
        if (!proofCheckbox.checked && (!proofUrl || !proofUrl.value.trim())) {
          showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
          return false;
        }
        return true;
    }
    // Step 3: Motivation
    if (stepIndex === 3) {
      const mot = formContainer.querySelector('[name="consortiumMotivation"]');
      const exp = formContainer.querySelector('[name="consortiumExperience"]');
      const trans = formContainer.querySelector('[name="consortiumTransparencyApproach"]');
      if (!mot.value.trim() || !exp.value.trim() || !trans.value.trim()) {
        showMessage('Please fill out motivation, experience and transparency approach.', 'error');
        return false;
      }
      return true;
    }
    // Step 4: Members
    if (stepIndex === 4) {
      if (consortiumMembers.length === 0) {
        showMessage('Please add at least one consortium member.', 'error');
        return false;
      }
      for (let i = 0; i < consortiumMembers.length; i++) {
        const m = consortiumMembers[i];
        if (!m.name.trim() || !m.biography.trim()) {
          showMessage(`Member ${i + 1}: name and biography are required.`, 'error');
          return false;
        }
        // REMOVED member proof validation
      }
      return true;
    }
    return true;
  }
  form.onsubmit = (e) => handleSubmitConsortium(e);
}

function createEmptyMember() {
  return {
    name: '',
    geographicRep: '',
    biography: '',
    conflictOfInterest: '',
    stakeId: '',
    dRepId: '',
    socialProfile: '',
    // Removed proof fields
  };
}

function renderMemberForm(container, index, renderMembersCallback = null) {
  const member = consortiumMembers[index];
  const card = createEl('div', { class: 'member-card' });
  const header = createEl('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;' }, [createEl('span', { style: 'font-weight:600;' }, [`Member ${index + 1}`])]);
  if (consortiumMembers.length > 1) {
    const removeBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'padding:0.25rem 0.5rem; font-size:0.75rem;' }, ['Remove']);
    removeBtn.addEventListener('click', () => {
      consortiumMembers.splice(index, 1);
      if (typeof renderMembersCallback === 'function') {
        renderMembersCallback();
      }
    });
    header.appendChild(removeBtn);
  }
  card.appendChild(header);
  
  card.appendChild(createFormGroup({ label: 'Full Name or Alias', name: `memberName${index}`, type: 'text', required: true, placeholder: 'Name', value: member.name, onInput: (e) => { consortiumMembers[index].name = e.target.value; } }));
  card.appendChild(createFormGroup({ label: 'Geographic Representation', name: `memberGeographicRep${index}`, type: 'text', required: false, placeholder: 'Region', value: member.geographicRep, onInput: (e) => { consortiumMembers[index].geographicRep = e.target.value; } }));
  card.appendChild(createTextareaGroup({ label: 'Biography', name: `memberBiography${index}`, required: true, maxLength: BIO_LIMIT, rows: 3, value: member.biography, helper: `Describe the member (max ${BIO_LIMIT} characters).`, onInput: (e) => { consortiumMembers[index].biography = e.target.value; } }));
  card.appendChild(createFormGroup({ label: 'Conflict of Interest (if any)', name: `memberConflictOfInterest${index}`, type: 'text', required: false, placeholder: 'Any conflicts', value: member.conflictOfInterest, onInput: (e) => { consortiumMembers[index].conflictOfInterest = e.target.value; } }));
  card.appendChild(createFormGroup({ label: 'Stake ID (if any)', name: `memberStakeId${index}`, type: 'text', required: false, placeholder: 'Stake ID', value: member.stakeId, onInput: (e) => { consortiumMembers[index].stakeId = e.target.value; } }));
  card.appendChild(createFormGroup({ label: 'dRep ID (if any)', name: `memberDRepId${index}`, type: 'text', required: false, placeholder: 'dRep ID', value: member.dRepId, onInput: (e) => { consortiumMembers[index].dRepId = e.target.value; } }));
  card.appendChild(createFormGroup({ label: 'Social Profile Link (if any)', name: `memberSocialProfile${index}`, type: 'url', required: false, placeholder: 'https://', value: member.socialProfile, onInput: (e) => { consortiumMembers[index].socialProfile = e.target.value; } }));
  
  // Removed Proof of Life UI for members
  
  container.appendChild(card);
}

function handleSubmitConsortium(e) {
  e.preventDefault();
  const formData = new FormData(formContainer); // To get standard fields if needed, but using manual collection below
  const data = {};
  const fields = ['consortiumName', 'consortiumContactPerson', 'consortiumContactEmail', 'consortiumMission', 'consortiumValues', 'consortiumMotivation', 'consortiumExperience', 'consortiumTransparencyApproach'];
  fields.forEach((field) => {
    const input = formContainer.querySelector(`[name="${field}"]`);
    data[field] = input ? input.value.trim() : '';
  });
  
  // Get PoL data
  data.hasPreviousConsortiumProof = formContainer.querySelector('#hasPreviousConsortiumProof').checked;
  const proofInput = formContainer.querySelector('#consortiumProofOfLifeLink');
  data.consortiumProofOfLifeLink = proofInput ? proofInput.value.trim() : '';

  if (!data.consortiumName || !data.consortiumContactPerson || !data.consortiumContactEmail || !data.consortiumMotivation || !data.consortiumExperience || !data.consortiumTransparencyApproach) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  
  if (!data.hasPreviousConsortiumProof && !data.consortiumProofOfLifeLink) {
    showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
    return;
  }

  if (consortiumMembers.length === 0) {
    showMessage('Please add at least one consortium member.', 'error');
    return;
  }
  
  const membersData = consortiumMembers.map((m) => ({
    name: m.name.trim(),
    geographicRep: m.geographicRep.trim(),
    biography: m.biography.trim(),
    conflictOfInterest: m.conflictOfInterest.trim(),
    stakeId: m.stakeId.trim(),
    dRepId: m.dRepId.trim(),
    socialProfile: m.socialProfile.trim(),
    // Removed PoL fields
  }));

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
      consortiumMembers: membersData,
    },
  };

  if (window.isEditMode) {
    application.entryId = window.editEntryId;
    application.editToken = window.editToken;
  }

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(application),
  })
    .then((res) => {
      if (!res.ok) {
        if (res.status === 403) throw new Error('Registration Closed');
        throw new Error('Submission failed');
      }
      return res.json();
    })
    .then((data) => {
      if (window.isEditMode) {
        showMessage('Application updated successfully!', 'success');
        openSuccessModal('Your consortium application has been updated!');
      } else {
        showMessage('Consortium application submitted successfully!', 'success');
        openSuccessModal('Your consortium application has been submitted!', data.entryId, data.editToken);
      }
      
      consortiumMembers = [];
      switchForm('Consortium');
      if (window.isEditMode) {
        // Correct redirect path
        setTimeout(() => { window.location.href = '/ccsnap/candidates'; }, 2000);
      } else {
        loadApplications();
      }
    })
    .catch((err) => {
      console.error(err);
      showMessage(err.message === 'Registration Closed' ? 'Submission failed: Registration is closed.' : 'Failed to submit application to the server.', 'error');
    });
}

// ---------- Form group helpers ----------
function createFormGroup({ label, name, type, required = false, placeholder = '', helper = '', value = '', onInput = null }) {
  const group = createEl('div', { class: 'form-group' });
  const labelEl = createEl('label', { for: name }, [label, required ? createEl('span', { style: 'color:#dc2626;' }, [' *']) : '']);
  const inputAttrs = { type: type || 'text', id: name, name: name, placeholder: placeholder };
  if (value) inputAttrs.value = value;
  if (required) inputAttrs.required = true;
  const inputEl = createEl('input', inputAttrs);
  if (onInput) {
    inputEl.addEventListener('input', onInput);
  }
  group.appendChild(labelEl);
  group.appendChild(inputEl);
  if (helper) {
    group.appendChild(createEl('div', { class: 'helper-text' }, [helper]));
  }
  return group;
}

function createTextareaGroup({ label, name, required = false, maxLength = null, rows = 3, helper = '', value = '', onInput = null }) {
  const group = createEl('div', { class: 'form-group' });
  const labelEl = createEl('label', { for: name }, [
    label,
    required ? createEl('span', { style: 'color:#dc2626;' }, [' *']) : '',
    maxLength
      ? createEl('span', { class: 'char-count', id: `${name}-char` }, [(value ? value.length : 0) + ' / ' + maxLength])
      : '',
  ]);
  const textareaAttrs = { id: name, name: name, rows: rows };
  if (value) textareaAttrs.value = value;
  if (required) textareaAttrs.required = true;
  if (maxLength) textareaAttrs.maxLength = maxLength;
  const textareaEl = createEl('textarea', textareaAttrs);
  textareaEl.addEventListener('input', (e) => {
    if (maxLength) {
      const counter = document.getElementById(`${name}-char`);
      if (counter) {
        counter.textContent = e.target.value.length + ' / ' + maxLength;
      }
    }
    if (onInput) {
      onInput(e);
    }
  });
  group.appendChild(labelEl);
  group.appendChild(textareaEl);
  if (helper) {
    group.appendChild(createEl('div', { class: 'helper-text' }, [helper]));
  }
  return group;
}

// ---------- Application persistence ----------
function loadApplications() {
  fetch('/api/applications')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load applications');
      return res.json();
    })
    .then((apps) => {
      renderApplicationsList(apps);
    })
    .catch((err) => {
      console.error(err);
      renderApplicationsList([]);
      showMessage('Could not load applications from the server.', 'error');
    });
}

function renderApplicationsList(apps) {
  applicationsList.innerHTML = '';
  if (!apps || apps.length === 0) {
    applicationsList.appendChild(createEl('p', {}, ['No candidates submitted yet.']));
    return;
  }
  apps.forEach((app) => {
    let applicantName = '';
    let typeLabel = '';
    if (app.applicationType === 'Individual') {
      applicantName = app.data.fullName || 'Individual';
      typeLabel = 'Individual';
    } else if (app.applicationType === 'Organization') {
      applicantName = app.data.orgName || 'Organisation';
      typeLabel = 'Organisation';
    } else if (app.applicationType === 'Consortium') {
      applicantName = app.data.consortiumName || 'Consortium';
      typeLabel = 'Consortium';
    }
    const entryId = app.entryId || app.id;
    const card = createEl('div', { class: 'candidate-card' });
    card.addEventListener('click', () => openApplicationModal(app));
    card.appendChild(createEl('div', { class: 'candidate-name' }, [applicantName]));
    card.appendChild(createEl('div', { class: 'candidate-type' }, [typeLabel]));
    card.appendChild(createEl('div', { class: 'candidate-id' }, ['#' + entryId]));
    applicationsList.appendChild(card);
  });
}

function buildApplicationDetails(app) {
  const container = createEl('div', { class: 'modal-details' });
  function addDetail(label, value) {
    container.appendChild(
      createEl('div', { class: 'detail' }, [
        createEl('span', {}, [label + ':']),
        ' ' + value,
      ]),
    );
  }
  addDetail('Submitted At', new Date(app.submittedAt).toLocaleString());
  Object.entries(app.data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || key === 'consortiumMembers') {
      return;
    }
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    let displayValue = value;
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    }
    addDetail(formattedKey, displayValue);
  });
  if (app.data.consortiumMembers && Array.isArray(app.data.consortiumMembers)) {
    const membersHeader = createEl('h4', {}, ['Consortium Members']);
    container.appendChild(membersHeader);
    app.data.consortiumMembers.forEach((member, idx) => {
      const memberCard = createEl('div', { class: 'member-card' });
      memberCard.appendChild(createEl('div', { class: 'detail' }, [createEl('span', {}, [`Member ${idx + 1} Name:`]), ' ' + member.name]));
      
      if (member.geographicRep) {
        memberCard.appendChild(
          createEl('div', { class: 'detail' }, [
            createEl('span', {}, ['Geographic Representation:']),
            ' ' + member.geographicRep,
          ]),
        );
      }
      memberCard.appendChild(
        createEl('div', { class: 'detail' }, [
          createEl('span', {}, ['Biography:']),
          ' ' + member.biography,
        ]),
      );
      if (member.conflictOfInterest) {
        memberCard.appendChild(
          createEl('div', { class: 'detail' }, [
            createEl('span', {}, ['Conflict of Interest:']),
            ' ' + member.conflictOfInterest,
          ]),
        );
      }
      if (member.stakeId) {
        memberCard.appendChild(
          createEl('div', { class: 'detail' }, [
            createEl('span', {}, ['Stake ID:']),
            ' ' + member.stakeId,
          ]),
        );
      }
      if (member.dRepId) {
        memberCard.appendChild(
          createEl('div', { class: 'detail' }, [
            createEl('span', {}, ['dRep ID:']),
            ' ' + member.dRepId,
          ]),
        );
      }
      if (member.socialProfile) {
        memberCard.appendChild(
          createEl('div', { class: 'detail' }, [
            createEl('span', {}, ['Social Profile:']),
            ' ' + member.socialProfile,
          ]),
        );
      }
      // Removed Member PoL Display
      container.appendChild(memberCard);
    });
  }
  return container;
}

function openApplicationModal(app) {
  const modal = document.getElementById('application-modal');
  const content = modal.querySelector('.modal-content');
  content.innerHTML = '';
  let applicantName = '';
  if (app.applicationType === 'Individual') {
    applicantName = app.data.fullName || 'Individual';
  } else if (app.applicationType === 'Organization') {
    applicantName = app.data.orgName || 'Organisation';
  } else if (app.applicationType === 'Consortium') {
    applicantName = app.data.consortiumName || 'Consortium';
  }
  const header = createEl('div', { class: 'modal-header' });
  header.appendChild(createEl('h3', {}, [applicantName]));
  const closeBtn = createEl('button', { class: 'modal-close', 'aria-label': 'Close' }, ['×']);
  closeBtn.addEventListener('click', closeApplicationModal);
  header.appendChild(closeBtn);
  content.appendChild(header);
  content.appendChild(createEl('div', { class: 'detail' }, [createEl('span', {}, ['Application Type:']), ' ' + app.applicationType]));
  content.appendChild(buildApplicationDetails(app));
  modal.classList.remove('hidden');
}

function closeApplicationModal() {
  const modal = document.getElementById('application-modal');
  modal.classList.add('hidden');
}

/**
 * Executes a highly reliable copy-to-clipboard function using the document.execCommand fallback.
 * @param {string} text The text to copy (optional, used for error logging).
 * @param {HTMLInputElement} inputEl The input element containing the text to copy.
 */
function copyTokenToClipboard(text, inputEl) {
    if (!inputEl) {
        showMessage('Error: Copy element not found.', 'error');
        return;
    }
    
    // 1. Ensure the element is visible and selectable.
    inputEl.select(); 
    inputEl.setSelectionRange(0, 99999); // For mobile devices

    // 2. Execute the copy command directly.
    let successful = false;
    try {
        successful = document.execCommand('copy');
    } catch (err) {
        console.error('Copy command failed:', err);
    }

    // 3. Provide feedback.
    if (successful) {
        showMessage('Token copied!', 'success');
    } else {
        // Fallback notification if document.execCommand fails
        showMessage('Could not copy token automatically. Please copy the highlighted text manually.', 'error');
    }
}

// Updated: Shows only Secret Token with working Copy button
function openSuccessModal(message, entryId = null, editToken = null) {
  // --- ADD CONFETTI HERE ---
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0033ad', '#1a5dd6', '#00a3c4', '#ffffff'] // Your brand colours!
    });
  }
  // -------------------------

  const modal = document.getElementById('success-modal');
  if (!modal) return;
  
  const content = modal.querySelector('.modal-content');
  content.innerHTML = '';
  const header = createEl('div', { class: 'modal-header' });
  header.appendChild(createEl('h3', {}, ['Success']));
  const closeBtn = createEl('button', { class: 'modal-close', 'aria-label': 'Close' }, ['×']);
  closeBtn.addEventListener('click', closeSuccessModal);
  header.appendChild(closeBtn);
  content.appendChild(header);
  content.appendChild(createEl('p', {}, [message]));
  
  if (entryId && editToken) {
    content.appendChild(createEl('hr', { style: 'margin: 1rem 0; border: 0; border-top: 1px solid #eee;' }));
    content.appendChild(createEl('p', { style: 'font-weight: 600; margin-bottom: 0.5rem;' }, ['Save this credential to edit later:']));
    
    // Secret Token 
    content.appendChild(createEl('label', { style: 'font-size: 0.8rem; display:block; margin-bottom:0.25rem;' }, ['Secret Token']));
    
    const tokenContainer = createEl('div', { style: 'display: flex; gap: 0.5rem; margin-bottom: 0.75rem;' });
    const tokenInput = createEl('input', { 
        type: 'text', 
        value: editToken, 
        readonly: true, 
        id: 'token-to-copy',
        style: 'flex-grow: 1; font-size: 0.9rem; background: #f9fafb; cursor: text;' 
    });
    // This listener allows manual selection/copy when clicking the input field
    tokenInput.addEventListener('click', () => tokenInput.select()); 
    
    // Create the copy button 
    const copyBtn = createEl('button', { 
        type: 'button', 
        class: 'btn secondary', 
        style: 'padding: 0.6rem 0.75rem; font-size: 0.85rem; white-space: nowrap;'
    }, ['Copy']);

    // *** FINAL FIX: Attach the listener directly to the new robust function ***
    copyBtn.addEventListener('click', () => {
        copyTokenToClipboard(editToken, tokenInput);
    }); 
    
    tokenContainer.appendChild(tokenInput);
    tokenContainer.appendChild(copyBtn);
    content.appendChild(tokenContainer);

    content.appendChild(createEl('p', { class: 'helper-text', style: 'margin-top: 0.5rem; color: #dc2626;' }, ['Warning: If you lose this token, you cannot edit your submission.']));
  }
  
  modal.classList.remove('hidden');
}

function closeSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function populateForm(type, data) {
  if (type === 'Individual') {
    if(data.fullName) document.querySelector('[name="fullName"]').value = data.fullName;
    if(data.email) document.querySelector('[name="email"]').value = data.email;
    if(data.geographicRep) document.querySelector('[name="geographicRep"]').value = data.geographicRep;
    if(data.biography) document.querySelector('[name="biography"]').value = data.biography;
    if(data.conflictOfInterest) document.querySelector('[name="conflictOfInterest"]').value = data.conflictOfInterest;
    if(data.stakeId) document.querySelector('[name="stakeId"]').value = data.stakeId;
    if(data.dRepId) document.querySelector('[name="dRepId"]').value = data.dRepId;
    if(data.socialProfile) document.querySelector('[name="socialProfile"]').value = data.socialProfile;
    
    const exemptCheck = document.querySelector('#hasPreviousIndividualProof');
    if (exemptCheck && data.proofOfLifeExempt) {
      exemptCheck.checked = true;
      // Trigger change event to update UI state (hiding the input)
      exemptCheck.dispatchEvent(new Event('change'));
    } else if (data.proofOfLifeLink) {
      document.querySelector('[name="proofOfLifeLink"]').value = data.proofOfLifeLink;
    }
    
    if(data.motivation) document.querySelector('[name="motivation"]').value = data.motivation;
    if(data.experience) document.querySelector('[name="experience"]').value = data.experience;
    if(data.transparencyApproach) document.querySelector('[name="transparencyApproach"]').value = data.transparencyApproach;
  } 
  else if (type === 'Organization') {
    if(data.orgName) document.querySelector('[name="orgName"]').value = data.orgName;
    if(data.contactPerson) document.querySelector('[name="contactPerson"]').value = data.contactPerson;
    if(data.contactEmail) document.querySelector('[name="contactEmail"]').value = data.contactEmail;
    if(data.orgDescription) document.querySelector('[name="orgDescription"]').value = data.orgDescription;
    if(data.orgConflictOfInterest) document.querySelector('[name="orgConflictOfInterest"]').value = data.orgConflictOfInterest;
    
    const exemptCheck = document.querySelector('#hasPreviousOrgProof');
    if (exemptCheck && data.orgProofOfLifeExempt) {
      exemptCheck.checked = true;
      exemptCheck.dispatchEvent(new Event('change'));
    } else if (data.orgProofOfLifeLink) {
      document.querySelector('[name="orgProofOfLifeLink"]').value = data.orgProofOfLifeLink;
    }
    
    if(data.orgExperience) document.querySelector('[name="orgExperience"]').value = data.orgExperience;
    if(data.orgTransparencyApproach) document.querySelector('[name="orgTransparencyApproach"]').value = data.orgTransparencyApproach;
    if(data.orgMotivation) document.querySelector('[name="orgMotivation"]').value = data.orgMotivation;
  } 
  else if (type === 'Consortium') {
    if(data.consortiumName) document.querySelector('[name="consortiumName"]').value = data.consortiumName;
    if(data.consortiumContactPerson) document.querySelector('[name="consortiumContactPerson"]').value = data.consortiumContactPerson;
    if(data.consortiumContactEmail) document.querySelector('[name="consortiumContactEmail"]').value = data.consortiumContactEmail;
    if(data.consortiumMission) document.querySelector('[name="consortiumMission"]').value = data.consortiumMission;
    if(data.consortiumValues) document.querySelector('[name="consortiumValues"]').value = data.consortiumValues;
    
    // New PoL Fields
    const exemptCheck = document.querySelector('#hasPreviousConsortiumProof');
    if (exemptCheck && data.consortiumProofOfLifeExempt) {
        exemptCheck.checked = true;
        exemptCheck.dispatchEvent(new Event('change'));
    } else if (data.consortiumProofOfLifeLink) {
        document.querySelector('[name="consortiumProofOfLifeLink"]').value = data.consortiumProofOfLifeLink;
    }

    if(data.consortiumMotivation) document.querySelector('[name="consortiumMotivation"]').value = data.consortiumMotivation;
    if(data.consortiumExperience) document.querySelector('[name="consortiumExperience"]').value = data.consortiumExperience;
    if(data.consortiumTransparencyApproach) document.querySelector('[name="consortiumTransparencyApproach"]').value = data.consortiumTransparencyApproach;
  }
}

if (applicationsList) {
  loadApplications();
}
if (formContainer) {
  renderForm(currentFormType);
}

const modalEl = document.getElementById('application-modal');
if (modalEl) {
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
      closeApplicationModal();
    }
  });
}

const successModalEl = document.getElementById('success-modal');
if (successModalEl) {
  successModalEl.addEventListener('click', (e) => {
    if (e.target === successModalEl) {
      closeSuccessModal();
    }
  });
}

// --- New Logic: Manual Edit Form ---
const btnShowEdit = document.getElementById('btn-show-edit-input');
if (btnShowEdit) {
  btnShowEdit.addEventListener('click', () => {
    const container = document.getElementById('manual-edit-container');
    container.classList.toggle('hidden');
    btnShowEdit.textContent = container.classList.contains('hidden') 
      ? 'Have an edit token?' 
      : 'Hide edit options';
  });
}

const btnLoadManual = document.getElementById('btn-load-manual-edit');
if (btnLoadManual) {
  btnLoadManual.addEventListener('click', () => {
    // const idInput = document.getElementById('manual-entry-id');
    const tokenInput = document.getElementById('manual-edit-token');
    // const entryId = idInput.value.trim();
    const token = tokenInput.value.trim();

    // NOTE: Changed alert() to showMessage()
    if (!token) {
      showMessage('Please enter your Secret Token.', 'error');
      return;
    }

    fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    .then(res => {
      if (!res.ok) throw new Error('Application not found');
      return res.json();
    })
    .then(app => {
      if (!app || !app.data) return;

      // Success finding app. Enable edit mode.
      window.isEditMode = true;
      window.editEntryId = app.entryId;
      window.editToken = token;

      // Hide manual container
      document.getElementById('manual-edit-container').classList.add('hidden');
      document.getElementById('btn-show-edit-input').classList.add('hidden'); // Hide the toggle button too

      // Show edit banner
      document.getElementById('edit-banner').classList.remove('hidden');
      
      // Disable switcher
      formSwitchButtons.forEach(btn => btn.disabled = true);

      // Setup Consortium array if needed
      if (app.applicationType === 'Consortium') {
        consortiumMembers = app.data.consortiumMembers || [];
      }

      // Render form
      switchForm(app.applicationType);
      populateForm(app.applicationType, app.data);

      showMessage('Application loaded. You can now edit.', 'success');
    })
    .catch(err => {
      console.error('Failed to load:', err);
      showMessage('Could not find application with that ID.', 'error');
    });
  });
}

// --- Handle Edit Mode Logic on Page Load (Legacy Link Support) ---
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('application-form')) return;

  const params = new URLSearchParams(window.location.search);
  const entryId = params.get('entryId');
  const token = params.get('token');

  if (!entryId || !token) return;

  // Hide the manual button if using link
  if (btnShowEdit) btnShowEdit.classList.add('hidden');

  const banner = document.getElementById('edit-banner');
  if (banner) banner.classList.remove('hidden');

  window.isEditMode = true;
  window.editEntryId = entryId;
  window.editToken = token;

  fetch(`/api/applications/${entryId}`)
    .then(res => {
      if (!res.ok) throw new Error('Application not found');
      return res.json();
    })
    .then(app => {
      if (!app || !app.data) return;

      if (app.applicationType === 'Consortium') {
        consortiumMembers = app.data.consortiumMembers || [];
      }

      switchForm(app.applicationType);
      populateForm(app.applicationType, app.data);
    })
    .catch(err => {
      console.error('Failed to load application for editing:', err);
      showMessage('Failed to load your application for editing. The link may be invalid.', 'error');
    });
});

// --- ELECTION CLOCK LOGIC ---
function initElectionClock() {
  const clockEl = document.getElementById('election-clock');
  if (!clockEl) return;

  // Update every second
  setInterval(updateClock, 1000);
  updateClock(); // Initial call

  function updateClock() {
    const now = new Date().getTime();
    const distance = REGISTRATION_DEADLINE - now;

    if (distance < 0) {
      clockEl.textContent = "REGISTRATION IS CLOSED";
      clockEl.style.backgroundColor = "#dc2626"; // Red for closed
      return;
    }

    // Time calculations
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    clockEl.textContent = `Time remaining to register: ${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
}

// Initialize clock on load
if (document.getElementById('election-clock')) {
  initElectionClock();
}
