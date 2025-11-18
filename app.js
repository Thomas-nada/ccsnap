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
const REGISTRATION_DEADLINE = new Date('2025-11-24T12:00:00Z').getTime();
// Registration Start Time: Sunday, November 16, 2025, 21:53:00 UTC
const REGISTRATION_START = new Date('2025-11-16T21:53:00Z').getTime();

function getUserId() {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

const userId = getUserId();

// ---------- Validation Helpers ----------

/**
 * Validates an email address.
 * A simple regex for basic email format checking.
 * Allows empty strings, as fields might be optional.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (email.trim() === '') return true; // Allow empty for optional fields
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

/**
 * Validates a URL.
 * Must start with http:// or https://
 * Allows empty strings, as fields might be optional.
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (url.trim() === '') return true; // Allow empty for optional fields
  // Simple check for http:// or https://
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      // Use URL constructor for a more robust check
      new URL(url);
      return true;
    } catch (_) {
      return false; // Invalid URL structure
    }
  }
  return false; // Doesn't start with http:// or https://
}


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
let allApplications = []; // --- NEW: To store all candidates for filtering
let currentFilter = 'All'; // --- NEW: To track the active filter

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
        <p>The deadline for candidate submissions has passed (Nov 24, 2025).</p>
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
  messagesDiv.innerHTML = ''; // Clear previous messages first
  messagesDiv.appendChild(el);
  
  // --- THIS IS THE FIX ---
  // Scroll the message into view so the user sees it
  messagesDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  setTimeout(() => {
    if (el.parentNode === messagesDiv) {
      messagesDiv.removeChild(el);
    }
  }, 6000);
}

// -------- Individual Form --------
function renderIndividualForm() {
  const form = formContainer;
  const steps = [];
  
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Full Name or Alias', name: 'fullName', type: 'text', required: true, placeholder: 'Satoshi Nakamoto' }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'email', type: 'email', required: true, placeholder: 'your@email.com', helper: 'This email will be made public on your candidate profile.' }));
  step0.appendChild(createFormGroup({ label: 'Geographic Representation', name: 'geographicRep', type: 'text', required: false, placeholder: 'Europe, Asia, etc.', helper: 'Optional – your region or area represented.' }));
  steps.push(step0);

  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Biography', name: 'biography', required: true, maxLength: BIO_LIMIT, rows: 4, helper: `Tell us about yourself (max ${BIO_LIMIT} characters).` }));
  step1.appendChild(createFormGroup({ label: 'Conflict of Interest (if any)', name: 'conflictOfInterest', type: 'text', required: false, placeholder: 'Describe any conflicts of interest' }));
  step1.appendChild(createFormGroup({ label: 'Stake ID (if any)', name: 'stakeId', type: 'text', required: false, placeholder: 'Optional stake key or account' }));
  step1.appendChild(createFormGroup({ label: 'DRep ID (if any)', name: 'DRepId', type: 'text', required: false, placeholder: 'Optional DRep identifier' }));
  step1.appendChild(createFormGroup({ label: 'Social Profile Link (if any)', name: 'socialProfile', type: 'url', required: false, placeholder: 'https://x.com/yourhandle', helper: 'Must start with http:// or https://' }));
  steps.push(step1);

  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const proofGroup = createEl('div', { class: 'form-group' });
  const proofLabel = createEl('label', { for: 'proofOfLifeLink' }, ['Proof‑of‑Life Video Link ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]);
  proofGroup.appendChild(proofLabel);
  const proofInput = createEl('input', { type: 'url', id: 'proofOfLifeLink', name: 'proofOfLifeLink', placeholder: 'Public video URL (e.g. https://yourhost.com/video' });
  proofGroup.appendChild(proofInput);
  proofGroup.appendChild(createEl('div', { class: 'helper-text' }, ['Must start with http:// or https://'])); // Helper text for URL
  
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

  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem; display: flex; justify-content: space-between; align-items: center;' });
  const navLeft = createEl('div');
  const navRight = createEl('div');

  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-right:0.5rem;' }, ['Previous']);
  navRight.appendChild(prevBtn);

  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  navRight.appendChild(nextBtn);
  
  if (window.isEditMode) {
    const deleteBtn = createEl('button', { type: 'button', class: 'btn', style: 'background: #dc2626; border-color: #dc2626; font-weight: 500;' }, ['Delete Submission']);
    deleteBtn.addEventListener('click', openDeleteModal);
    navLeft.appendChild(deleteBtn);
  }

  nav.appendChild(navLeft);
  nav.appendChild(navRight);
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
      if (!isValidEmail(emailInput.value)) {
        showMessage('Please enter a valid email address.', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      const bioInput = formContainer.querySelector('[name="biography"]');
      const socialInput = formContainer.querySelector('[name="socialProfile"]');
      if (!bioInput.value.trim()) {
        showMessage('Please provide your biography.', 'error');
        return false;
      }
      if (socialInput.value.trim() && !isValidUrl(socialInput.value)) {
        showMessage('Please enter a valid social profile URL (starting with http:// or https://).', 'error');
        return false;
      }
      return true;
    }
    if (stepIndex === 2) {
      const proofCheckbox = formContainer.querySelector('#hasPreviousIndividualProof');
      const proofUrlInput = formContainer.querySelector('#proofOfLifeLink');
      if (!proofCheckbox.checked && !proofUrlInput.value.trim()) {
        showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
        return false;
      }
      if (!proofCheckbox.checked && proofUrlInput.value.trim() && !isValidUrl(proofUrlInput.value)) {
        showMessage('Please enter a valid Proof-of-Life URL (starting with http:// or https://).', 'error');
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

  // --- Final Validation ---
  if (!data.fullName || !data.email || !data.biography || !data.motivation || !data.experience || !data.transparencyApproach) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  if (!data.hasPreviousIndividualProof && !data.proofOfLifeLink) {
    showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
    return;
  }
  if (!isValidEmail(data.email)) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }
  if (data.socialProfile && !isValidUrl(data.socialProfile)) {
    showMessage('Please enter a valid social profile URL (starting with http:// or https://).', 'error');
    return;
  }
  if (!data.hasPreviousIndividualProof && data.proofOfLifeLink && !isValidUrl(data.proofOfLifeLink)) {
    showMessage('Please enter a valid Proof-of-Life URL (starting with http:// or https://).', 'error');
    return;
  }
  // --- End Validation ---
  
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

  if (window.isEditMode) {
    application.entryId = window.editEntryId;
    application.editToken = window.editToken;
  }

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(application),
  })
    .then(async (res) => { // Make async to parse error JSON
      if (!res.ok) {
        let errorMsg = 'Submission failed';
        if (res.status === 403) errorMsg = 'Registration Closed';
        if (res.status === 400) {
            const errData = await res.json();
            errorMsg = errData.error || 'Invalid data submitted.';
        }
        throw new Error(errorMsg);
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
        // Do nothing, success modal is shown
      }
    })
    .catch((err) => {
      console.error(err);
      showMessage(err.message, 'error'); // Show specific error from server
    });
}

// -------- Organisation Form --------
function renderOrganizationForm() {
  const form = formContainer;
  const steps = [];
  
  const step0 = createEl('div', { class: 'form-step', dataset: { step: 0 } });
  step0.appendChild(createFormGroup({ label: 'Organisation Name', name: 'orgName', type: 'text', required: true, placeholder: 'Cardano Association' }));
  step0.appendChild(createFormGroup({ label: 'Contact Person', name: 'contactPerson', type: 'text', required: true, placeholder: 'Jane Doe' }));
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'contactEmail', type: 'email', required: true, placeholder: 'contact@organisation.com', helper: 'This email will be made public on the candidate profile.' }));
  steps.push(step0);
  
  const step1 = createEl('div', { class: 'form-step', dataset: { step: 1 } });
  step1.appendChild(createTextareaGroup({ label: 'Organisation Description', name: 'orgDescription', required: true, maxLength: BIO_LIMIT, rows: 4, helper: `Describe your organisation (max ${BIO_LIMIT} characters).` }));
  step1.appendChild(createFormGroup({ label: 'Conflict of Interest (if any)', name: 'orgConflictOfInterest', type: 'text', required: false, placeholder: 'Describe any conflicts of interest' }));
  steps.push(step1);
  
  const step2 = createEl('div', { class: 'form-step', dataset: { step: 2 } });
  const orgProofGroup = createEl('div', { class: 'form-group' });
  orgProofGroup.appendChild(createEl('label', { for: 'orgProofOfLifeLink' }, ['Proof‑of‑Life Video Link ', createEl('span', { style: 'color:#dc2626;' }, ['*'])]));
  const orgProofInput = createEl('input', { type: 'url', id: 'orgProofOfLifeLink', name: 'orgProofOfLifeLink', placeholder: 'Public video URL (e.g. https://yourhost.com/video' });
  orgProofGroup.appendChild(orgProofInput);
  orgProofGroup.appendChild(createEl('div', { class: 'helper-text' }, ['Must start with http:// or https://'])); // Helper text for URL

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
  
  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem; display: flex; justify-content: space-between; align-items: center;' });
  const navLeft = createEl('div');
  const navRight = createEl('div');

  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-right:0.5rem;' }, ['Previous']);
  navRight.appendChild(prevBtn);

  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  navRight.appendChild(nextBtn);
  
  if (window.isEditMode) {
    const deleteBtn = createEl('button', { type: 'button', class: 'btn', style: 'background: #dc2626; border-color: #dc2626; font-weight: 500;' }, ['Delete Submission']);
    deleteBtn.addEventListener('click', openDeleteModal);
    navLeft.appendChild(deleteBtn);
  }
  
  nav.appendChild(navLeft);
  nav.appendChild(navRight);
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
      if (!isValidEmail(email.value)) {
        showMessage('Please enter a valid contact email address.', 'error');
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
      const proofUrlInput = formContainer.querySelector('#orgProofOfLifeLink');
      if (!proofCheckbox.checked && (!proofUrlInput || !proofUrlInput.value.trim())) {
        showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
        return false;
      }
      if (!proofCheckbox.checked && proofUrlInput.value.trim() && !isValidUrl(proofUrlInput.value)) {
        showMessage('Please enter a valid Proof-of-Life URL (starting with http:// or https://).', 'error');
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
  
  // --- Final Validation ---
  if (!data.orgName || !data.contactPerson || !data.contactEmail || !data.orgDescription || !data.orgExperience || !data.orgTransparencyApproach || !data.orgMotivation) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  if (!data.hasPreviousOrgProof && !data.orgProofOfLifeLink) {
    showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
    return;
  }
  if (!isValidEmail(data.contactEmail)) {
    showMessage('Please enter a valid contact email address.', 'error');
    return;
  }
  if (!data.hasPreviousOrgProof && data.orgProofOfLifeLink && !isValidUrl(data.orgProofOfLifeLink)) {
    showMessage('Please enter a valid Proof-of-Life URL (starting with http:// or https://).', 'error');
    return;
  }
  // --- End Validation ---

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
    .then(async (res) => { // Make async to parse error JSON
      if (!res.ok) {
        let errorMsg = 'Submission failed';
        if (res.status === 403) errorMsg = 'Registration Closed';
        if (res.status === 400) {
            const errData = await res.json();
            errorMsg = errData.error || 'Invalid data submitted.';
        }
        throw new Error(errorMsg);
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
        // Do nothing, success modal is shown
      }
    })
    .catch((err) => {
      console.error(err);
      showMessage(err.message, 'error'); // Show specific error from server
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
  step0.appendChild(createFormGroup({ label: 'Contact Email', name: 'consortiumContactEmail', type: 'email', required: true, placeholder: 'consortium@example.com', helper: 'This email will be made public on the candidate profile.' }));
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
  const consProofInput = createEl('input', { type: 'url', id: 'consortiumProofOfLifeLink', name: 'consortiumProofOfLifeLink', placeholder: 'Public video URL (e.g. https://yourhost.com/video' });
  consProofGroup.appendChild(consProofInput);
  consProofGroup.appendChild(createEl('div', { class: 'helper-text' }, ['Must start with http:// or https://'])); // Helper text for URL
  
  // Exemption Group
  const consExemptionDiv = createEl('div', { class: 'form-group' });
  const consCheckbox = createEl('input', { type: 'checkbox', id: 'hasPreviousConsortiumProof', name: 'hasPreviousConsortiumProof' });
  const consLabel = createEl('label', { for: 'hasPreviousConsortiumProof', class: 'helper-text', style: 'display:inline-block; margin-left:0.25rem;' }, ['Consortium is exempt from PoL (i.e., at least 50% of members participated in the previous CC election).']);
  consExemptionDiv.appendChild(consCheckbox);
  consExemptionDiv.appendChild(consLabel);

  // Disclaimer
  const disclaimer = createEl('div', { class: 'helper-text', style: 'margin-top: 1rem; padding: 0.5rem; background-color: var(--surface-alt); border-radius: 6px; border: 1px solid var(--border); font-style: italic;' }, [
    'Disclaimer: The Contact Person provides this video (or claims exemption) on behalf of the entire consortium and vouches for the identity of all members.'
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
  
  const nav = createEl('div', { class: 'step-nav', style: 'margin-top:1rem; display: flex; justify-content: space-between; align-items: center;' });
  const navLeft = createEl('div');
  const navRight = createEl('div');

  const prevBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'margin-right:0.5rem;' }, ['Previous']);
  navRight.appendChild(prevBtn);

  const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
  navRight.appendChild(nextBtn);
  
  if (window.isEditMode) {
    const deleteBtn = createEl('button', { type: 'button', class: 'btn', style: 'background: #dc2626; border-color: #dc2626; font-weight: 500;' }, ['Delete Submission']);
    deleteBtn.addEventListener('click', openDeleteModal);
    navLeft.appendChild(deleteBtn);
  }
  
  nav.appendChild(navLeft);
  nav.appendChild(navRight);
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
      if (!isValidEmail(email.value)) {
        showMessage('Please enter a valid contact email address.', 'error');
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
        const proofUrlInput = formContainer.querySelector('#consortiumProofOfLifeLink');
        if (!proofCheckbox.checked && (!proofUrlInput || !proofUrlInput.value.trim())) {
          showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
          return false;
        }
        if (!proofCheckbox.checked && proofUrlInput.value.trim() && !isValidUrl(proofUrlInput.value)) {
            showMessage('Please enter a valid Proof-of-Life URL (starting with http:// or https://).', 'error');
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
        if (m.socialProfile.trim() && !isValidUrl(m.socialProfile)) {
          showMessage(`Member ${i + 1}: Please enter a valid social profile URL (starting with http:// or https://).`, 'error');
          return false;
        }
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
    DRepId: '',
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
  card.appendChild(createFormGroup({ label: 'DRep ID (if any)', name: `memberDRepId${index}`, type: 'text', required: false, placeholder: 'DRep ID', value: member.DRepId, onInput: (e) => { consortiumMembers[index].DRepId = e.target.value; } }));
  card.appendChild(createFormGroup({ label: 'Social Profile Link (if any)', name: `memberSocialProfile${index}`, type: 'url', required: false, placeholder: 'https://', value: member.socialProfile, helper: 'Must start with http:// or https://', onInput: (e) => { consortiumMembers[index].socialProfile = e.target.value; } }));
  
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

  // --- Final Validation ---
  if (!data.consortiumName || !data.consortiumContactPerson || !data.consortiumContactEmail || !data.consortiumMotivation || !data.consortiumExperience || !data.consortiumTransparencyApproach) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  if (!data.hasPreviousConsortiumProof && !data.consortiumProofOfLifeLink) {
    showMessage('Please provide a proof‑of‑life link or select the exemption.', 'error');
    return;
  }
  if (!isValidEmail(data.consortiumContactEmail)) {
    showMessage('Please enter a valid contact email address.', 'error');
    return;
  }
  if (!data.hasPreviousConsortiumProof && data.consortiumProofOfLifeLink && !isValidUrl(data.consortiumProofOfLifeLink)) {
    showMessage('Please enter a valid Proof-of-Life URL (starting with http:// or https://).', 'error');
    return;
  }

  if (consortiumMembers.length === 0) {
    showMessage('Please add at least one consortium member.', 'error');
    return;
  }
  
  const membersData = [];
  for (let i = 0; i < consortiumMembers.length; i++) {
    const m = consortiumMembers[i];
    if (m.socialProfile.trim() && !isValidUrl(m.socialProfile)) {
        showMessage(`Member ${i + 1}: Please enter a valid social profile URL (starting with http:// or https://).`, 'error');
        return;
    }
    membersData.push({
      name: m.name.trim(),
      geographicRep: m.geographicRep.trim(),
      biography: m.biography.trim(),
      conflictOfInterest: m.conflictOfInterest.trim(),
      stakeId: m.stakeId.trim(),
      DRepId: m.DRepId.trim(),
      socialProfile: m.socialProfile.trim(),
    });
  }
  // --- End Validation ---

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
    .then(async (res) => { // Make async to parse error JSON
      if (!res.ok) {
        let errorMsg = 'Submission failed';
        if (res.status === 403) errorMsg = 'Registration Closed';
        if (res.status === 400) {
            const errData = await res.json();
            errorMsg = errData.error || 'Invalid data submitted.';
        }
        throw new Error(errorMsg);
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
        // Do nothing, success modal is shown
      }
    })
    .catch((err) => {
      console.error(err);
      showMessage(err.message, 'error'); // Show specific error from server
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

  // Prefill value for textarea
  if (value) {
    textareaEl.value = value;
  }

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
      allApplications = apps; // --- NEW: Store all apps
      renderFilteredApplications(); // --- NEW: Call filter render
    })
    .catch((err) => {
      console.error(err);
      allApplications = [];
      renderFilteredApplications(); // Render empty state
      showMessage('Could not load applications from the server.', 'error');
    });
}

// --- NEW: Filter and Search Logic ---
function renderFilteredApplications() {
  if (!applicationsList) return; // Only run on candidates page

  const searchInput = document.getElementById('search-input');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

  const filteredApps = allApplications.filter(app => {
    // 1. Filter by Type
    const typeMatch = currentFilter === 'All' || app.applicationType === currentFilter;
    if (!typeMatch) return false;

    // 2. Filter by Search Term
    if (searchTerm === '') return true; // No search term, show all
    
    let appName = '';
    if (app.applicationType === 'Individual') {
      appName = app.data.fullName || '';
    } else if (app.applicationType === 'Organization') {
      appName = app.data.orgName || '';
    } else if (app.applicationType === 'Consortium') {
      appName = app.data.consortiumName || '';
    }
    return appName.toLowerCase().includes(searchTerm);
  });

  renderApplicationsList(filteredApps);
}


function renderApplicationsList(apps) {
  if (!applicationsList) return; // Guard clause
  applicationsList.innerHTML = '';
  if (!apps || apps.length === 0) {
    // Show a "no results" message if searching/filtering
    if (allApplications.length > 0) {
        applicationsList.appendChild(createEl('p', {}, ['No candidates match your criteria.']));
    } else {
        applicationsList.appendChild(createEl('p', {}, ['No candidates submitted yet.']));
    }
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
    // Updated click handler to navigate to the candidate detail page
    card.addEventListener('click', () => {
      window.location.href = `/ccsnap/candidates/${entryId}`;
    });
    card.appendChild(createEl('div', { class: 'candidate-name' }, [applicantName]));
    card.appendChild(createEl('div', { class: 'candidate-type' }, [typeLabel]));
    card.appendChild(createEl('div', { class: 'candidate-id' }, ['#' + entryId]));
    applicationsList.appendChild(card);
  });
}

function buildApplicationDetails(app) {
  // Main container with new card style
  const container = createEl('div', { class: 'candidate-detail-card' }); 
  
  // Helper to format a key into a readable label
  function formatKey(key) {
      const formatted = key
          .replace(/([A-Z])/g, ' $1') // Add space before caps
          .replace(/^./, (s) => s.toUpperCase()) // Capitalize first letter
          .replace(/Org /g, 'Organisation ') // Specific replacements
          .replace(/Rep /g, 'Representation ')
          .replace(/D Rep/g, 'DRep');
      return formatted;
  }

  // Helper to safely create and append detail elements
  function addDetail(parent, label, value) {
      if (value === undefined || value === null || value === '') return; // Skip empty
      
      let displayValue = value;
      if (typeof value === 'boolean') {
          displayValue = value ? 'Yes' : 'No';
      } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          // If it's a URL, make it a clickable link
          displayValue = createEl('a', { href: value, target: '_blank', rel: 'noopener noreferrer' }, [value]);
      } else if (typeof value === 'string' && value.includes('@') && !value.includes(' ') && isValidEmail(value)) {
          // If it's an email, make it a mailto link
          displayValue = createEl('a', { href: 'mailto:' + value }, [value]);
      } else if (typeof value === 'string' && value.includes('\n')) {
          // If it has newlines, wrap in pre to preserve formatting
          displayValue = createEl('pre', {}, [value]);
      }

      const detailEl = createEl('div', { class: 'detail' });
      detailEl.appendChild(createEl('span', {}, [label + ':']));
      
      if (typeof displayValue === 'object') {
          detailEl.appendChild(displayValue); // Append link or pre element
      } else {
          detailEl.appendChild(document.createTextNode(' ' + displayValue));
      }
      parent.appendChild(detailEl);
  }

  // --- 1. Top Grid for Metadata ---
  const grid = createEl('div', { class: 'detail-grid' });
  addDetail(grid, 'Submitted At', new Date(app.submittedAt).toLocaleString());
  
  // Add fields to grid based on type
  if (app.applicationType === 'Individual') {
      addDetail(grid, 'Full Name', app.data.fullName);
      addDetail(grid, 'Contact Email', app.data.email);
      addDetail(grid, 'Geographic Representation', app.data.geographicRep);
      addDetail(grid, 'Stake ID', app.data.stakeId);
      addDetail(grid, 'DRep ID', app.data.DRepId);
      addDetail(grid, 'Social Profile', app.data.socialProfile);
      addDetail(grid, 'Proof of Life Exempt', app.data.proofOfLifeExempt);
      addDetail(grid, 'Proof of Life Link', app.data.proofOfLifeLink);
  } else if (app.applicationType === 'Organization') {
      addDetail(grid, 'Organisation Name', app.data.orgName);
      addDetail(grid, 'Contact Person', app.data.contactPerson);
      addDetail(grid, 'Contact Email', app.data.contactEmail);
      addDetail(grid, 'Proof of Life Exempt', app.data.orgProofOfLifeExempt);
      addDetail(grid, 'Proof of Life Link', app.data.orgProofOfLifeLink);
  } else if (app.applicationType === 'Consortium') {
      addDetail(grid, 'Consortium Name', app.data.consortiumName);
      addDetail(grid, 'Contact Person', app.data.consortiumContactPerson);
      addDetail(grid, 'Contact Email', app.data.consortiumContactEmail);
      addDetail(grid, 'Proof of Life Exempt', app.data.consortiumProofOfLifeExempt);
      addDetail(grid, 'Proof of Life Link', app.data.consortiumProofOfLifeLink);
  }
  container.appendChild(grid);

  // --- 2. Full-width Sections for Long Text ---
  if (app.applicationType === 'Individual') {
      addDetail(container, 'Biography', app.data.biography);
      addDetail(container, 'Conflict of Interest', app.data.conflictOfInterest);
      
      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Platform']));
      addDetail(container, 'Motivation for Serving', app.data.motivation);
      addDetail(container, 'Relevant Governance or Constitutional Experience', app.data.experience);
      addDetail(container, 'Communication & Transparency Approach', app.data.transparencyApproach);
  
  } else if (app.applicationType === 'Organization') {
      addDetail(container, 'Organisation Description', app.data.orgDescription);
      addDetail(container, 'Conflict of Interest', app.data.orgConflictOfInterest);

      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Platform']));
      addDetail(container, 'Motivation for Serving', app.data.orgMotivation);
      addDetail(container, 'Relevant Governance or Constitutional Experience', app.data.orgExperience);
      addDetail(container, 'Communication & Transparency Approach', app.data.orgTransparencyApproach);
  
  } else if (app.applicationType === 'Consortium') {
      addDetail(container, 'Mission', app.data.consortiumMission);
      addDetail(container, 'Values', app.data.consortiumValues);

      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Platform']));
      addDetail(container, 'Motivation for Serving', app.data.consortiumMotivation);
      addDetail(container, 'Relevant Governance or Constitutional Experience', app.data.consortiumExperience);
      addDetail(container, 'Communication & Transparency Approach', app.data.consortiumTransparencyApproach);
  }

  // --- 3. Consortium Members Section ---
  if (app.data.consortiumMembers && Array.isArray(app.data.consortiumMembers)) {
      container.appendChild(createEl('h4', { class: 'detail-section-header' }, ['Consortium Members']));
      
      app.data.consortiumMembers.forEach((member, idx) => {
          const memberCard = createEl('div', { class: 'member-card' });
          memberCard.appendChild(createEl('h5', {}, [`Member ${idx + 1}: ${member.name}`]));
          
          const memberGrid = createEl('div', { class: 'detail-grid', style: 'border: none; padding: 0; margin: 0; gap: 0.5rem 1.5rem;' });
          addDetail(memberGrid, 'Geographic Representation', member.geographicRep);
          addDetail(memberGrid, 'Stake ID', member.stakeId);
          addDetail(memberGrid, 'DRep ID', member.DRepId);
          addDetail(memberGrid, 'Social Profile', member.socialProfile);
          memberCard.appendChild(memberGrid);

          addDetail(memberCard, 'Biography', member.biography);
          addDetail(memberCard, 'Conflict of Interest', member.conflictOfInterest);

          container.appendChild(memberCard);
      });
  }
  
  return container;
}


function openApplicationModal(app) {
  // This function is now only used on the /candidates page as a modal
  // The logic for the /candidate.html page is separate.
  const modal = document.getElementById('application-modal');
  if (!modal) return; // Should not happen on candidates.html, but good to check

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
  
  // Create a temporary app object without sensitive fields for the modal preview
  const safeApp = JSON.parse(JSON.stringify(app)); // Deep clone
  if (safeApp.data) {
      delete safeApp.data.email;
      delete safeApp.data.contactEmail;
      delete safeApp.data.proofOfLifeLink;
      delete safeApp.data.orgProofOfLifeLink;
      delete safeApp.data.consortiumProofOfLifeLink;
  }

  // Use the new enhanced builder with the safeApp object
  content.appendChild(buildApplicationDetails(safeApp));

  // Add a "View Full Profile" button
  const entryId = app.entryId || app.id;
  const viewButton = createEl('a', { 
    href: `/ccsnap/candidates/${entryId}`, 
    class: 'btn', 
    style: 'margin-top: 1.5rem; text-decoration: none;'
  }, ['View Full Profile']);
  content.appendChild(viewButton);

  modal.classList.remove('hidden');
}

function closeApplicationModal() {
  const modal = document.getElementById('application-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
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
  
    // Add "View Submission" button
    const viewButton = createEl('a', { 
        href: `/ccsnap/candidates/${entryId}`, 
        class: 'btn', 
        style: 'margin-top: 1rem; text-decoration: none; background: #065f46; border-color: #065f46;'
    }, ['View Your Submission']);
    content.appendChild(viewButton);
  }
  
  modal.classList.remove('hidden');
}

function closeSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// --- Delete Modal Logic ---
const deleteModal = document.getElementById('delete-modal');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');
const btnDeleteCancelTop = document.getElementById('btn-delete-cancel-top');

function openDeleteModal() {
  if (deleteModal) {
    deleteModal.classList.remove('hidden');
  }
}

function closeDeleteModal() {
  if (deleteModal) {
    deleteModal.classList.add('hidden');
  }
}

function handleDeleteSubmission() {
  if (!window.isEditMode || !window.editEntryId || !window.editToken) {
    showMessage('Error: Not in edit mode or missing credentials.', 'error');
    return;
  }

  fetch('/api/delete', {
    method: 'POST', // Using POST for consistency, to send JSON body
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entryId: window.editEntryId,
      editToken: window.editToken,
    }),
  })
  .then(async (res) => {
      if (!res.ok) {
        let errorMsg = 'Deletion failed. Please try again.';
        if (res.status === 403) errorMsg = 'Deletion failed: Registration is closed or token is invalid.';
        if (res.status === 404) errorMsg = 'Deletion failed: Submission not found.';
        try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      return res.json();
  })
  .then(data => {
      showMessage('Submission successfully deleted.', 'success');
      closeDeleteModal();
      // Redirect to candidates page
      setTimeout(() => {
          window.location.href = '/ccsnap/candidates';
      }, 1500);
  })
  .catch(err => {
      console.error(err);
      showMessage(err.message, 'error');
      closeDeleteModal();
  });
}

if (deleteModal) {
  btnDeleteConfirm.addEventListener('click', handleDeleteSubmission);
  btnDeleteCancel.addEventListener('click', closeDeleteModal);
  btnDeleteCancelTop.addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });
}
// --- End Delete Modal Logic ---

function populateForm(type, data) {
  // Helper to trigger input event for char counters
  function setValueAndTriggerInput(selector, value) {
      const el = document.querySelector(selector);
      if (el) {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
      }
  }

  if (type === 'Individual') {
    if(data.fullName) document.querySelector('[name="fullName"]').value = data.fullName;
    if(data.email) document.querySelector('[name="email"]').value = data.email;
    if(data.geographicRep) document.querySelector('[name="geographicRep"]').value = data.geographicRep;
    if(data.biography) setValueAndTriggerInput('[name="biography"]', data.biography);
    if(data.conflictOfInterest) document.querySelector('[name="conflictOfInterest"]').value = data.conflictOfInterest;
    if(data.stakeId) document.querySelector('[name="stakeId"]').value = data.stakeId;
    if(data.DRepId) document.querySelector('[name="DRepId"]').value = data.DRepId;
    if(data.socialProfile) document.querySelector('[name="socialProfile"]').value = data.socialProfile;
    
    const exemptCheck = document.querySelector('#hasPreviousIndividualProof');
    if (exemptCheck && data.proofOfLifeExempt) {
      exemptCheck.checked = true;
      // Trigger change event to update UI state (hiding the input)
      exemptCheck.dispatchEvent(new Event('change'));
    } else if (data.proofOfLifeLink) {
      document.querySelector('[name="proofOfLifeLink"]').value = data.proofOfLifeLink;
    }
    
    if(data.motivation) setValueAndTriggerInput('[name="motivation"]', data.motivation);
    if(data.experience) setValueAndTriggerInput('[name="experience"]', data.experience);
    if(data.transparencyApproach) setValueAndTriggerInput('[name="transparencyApproach"]', data.transparencyApproach);
  } 
  else if (type === 'Organization') {
    if(data.orgName) document.querySelector('[name="orgName"]').value = data.orgName;
    if(data.contactPerson) document.querySelector('[name="contactPerson"]').value = data.contactPerson;
    if(data.contactEmail) document.querySelector('[name="contactEmail"]').value = data.contactEmail;
    if(data.orgDescription) setValueAndTriggerInput('[name="orgDescription"]', data.orgDescription);
    if(data.orgConflictOfInterest) document.querySelector('[name="orgConflictOfInterest"]').value = data.orgConflictOfInterest;
    
    const exemptCheck = document.querySelector('#hasPreviousOrgProof');
    if (exemptCheck && data.orgProofOfLifeExempt) {
      exemptCheck.checked = true;
      exemptCheck.dispatchEvent(new Event('change'));
    } else if (data.orgProofOfLifeLink) {
      document.querySelector('[name="orgProofOfLifeLink"]').value = data.orgProofOfLifeLink;
    }
    
    if(data.orgExperience) setValueAndTriggerInput('[name="orgExperience"]', data.orgExperience);
    if(data.orgTransparencyApproach) setValueAndTriggerInput('[name="orgTransparencyApproach"]', data.orgTransparencyApproach);
    if(data.orgMotivation) setValueAndTriggerInput('[name="orgMotivation"]', data.orgMotivation);
  } 
  else if (type === 'Consortium') {
    if(data.consortiumName) document.querySelector('[name="consortiumName"]').value = data.consortiumName;
    if(data.consortiumContactPerson) document.querySelector('[name="consortiumContactPerson"]').value = data.consortiumContactPerson;
    if(data.consortiumContactEmail) document.querySelector('[name="consortiumContactEmail"]').value = data.consortiumContactEmail;
    if(data.consortiumMission) setValueAndTriggerInput('[name="consortiumMission"]', data.consortiumMission);
    if(data.consortiumValues) setValueAndTriggerInput('[name="consortiumValues"]', data.consortiumValues);
    
    // New PoL Fields
    const exemptCheck = document.querySelector('#hasPreviousConsortiumProof');
    if (exemptCheck && data.consortiumProofOfLifeExempt) {
        exemptCheck.checked = true;
        exemptCheck.dispatchEvent(new Event('change'));
    } else if (data.consortiumProofOfLifeLink) {
        document.querySelector('[name="consortiumProofOfLifeLink"]').value = data.consortiumProofOfLifeLink;
    }

    if(data.consortiumMotivation) setValueAndTriggerInput('[name="consortiumMotivation"]', data.consortiumMotivation);
    if(data.consortiumExperience) setValueAndTriggerInput('[name="consortiumExperience"]', data.consortiumExperience);
    if(data.consortiumTransparencyApproach) setValueAndTriggerInput('[name="consortiumTransparencyApproach"]', data.consortiumTransparencyApproach);
    
    // Members are populated by setting the global consortiumMembers array
    // which is done *before* renderForm/switchForm is called in the edit logic
  }
}

if (applicationsList) {
  // --- NEW: Event listeners for filters ---
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderFilteredApplications);
  }

  const filterButtonsContainer = document.querySelector('.filter-buttons');
  if (filterButtonsContainer) {
    filterButtonsContainer.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        // Remove 'active' from all buttons
        filterButtonsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        // Add 'active' to clicked button
        e.target.classList.add('active');
        // Update filter state and re-render
        currentFilter = e.target.dataset.filter;
        renderFilteredApplications();
      }
    });
  }

  // Load applications
  loadApplications();
}
if (formContainer) {
  // Check for edit mode *before* initial render
  const params = new URLSearchParams(window.location.search);
  const entryId = params.get('entryId');
  const token = params.get('token');

  if (entryId && token) {
    // We are in edit mode from URL, load data first
    window.isEditMode = true;
    window.editEntryId = entryId;
    window.editToken = token;

    // Hide the manual button if using link
    if (btnShowEdit) btnShowEdit.classList.add('hidden');

    const banner = document.getElementById('edit-banner');
    if (banner) banner.classList.remove('hidden');
    
    // Disable switcher
    if (formSwitchButtons) formSwitchButtons.forEach(btn => btn.disabled = true);

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
        renderForm(currentFormType); // Render default form
      });
  } else {
    // Not in edit mode from URL, render default form
    renderForm(currentFormType);
  }
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
      showMessage('Could not find application with that Token.', 'error');
    });
  });
}

// --- Handle Edit Mode Logic on Page Load (Legacy Link Support) ---
// This logic is now moved up to run *before* the initial renderForm call.
/*
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('application-form')) return;
  // ... This is now handled above ...
});
*/

// --- ELECTION CLOCK LOGIC ---
function initElectionClock() {
  const clockEl = document.getElementById('election-clock');
  if (!clockEl) return;

  // Update every second
  setInterval(updateClock, 1000);
  updateClock(); // Initial call

  function updateClock() {
    const now = new Date().getTime();
    
    // Check start time
    if (now < REGISTRATION_START) {
        const distanceToStart = REGISTRATION_START - now;
        const days = Math.floor(distanceToStart / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distanceToStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distanceToStart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distanceToStart % (1000 * 60)) / 1000);
        clockEl.textContent = `Registration opens in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        clockEl.style.backgroundColor = "#065f46"; // Green for upcoming
        return;
    }

    // Check deadline
    const distanceToDeadline = REGISTRATION_DEADLINE - now;
    if (distanceToDeadline < 0) {
      clockEl.textContent = "REGISTRATION IS CLOSED";
      clockEl.style.backgroundColor = "#dc2626"; // Red for closed
      return;
    }

    // Time calculations for deadline
    const days = Math.floor(distanceToDeadline / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distanceToDeadline % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distanceToDeadline % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distanceToDeadline % (1000 * 60)) / 1000);

    clockEl.textContent = `Time remaining to register: ${days}d ${hours}h ${minutes}m ${seconds}s`;
    clockEl.style.backgroundColor = "var(--primary-dark)"; // Default blue
  }
}

// Initialize clock on load
if (document.getElementById('election-clock')) {
  initElectionClock();
}
