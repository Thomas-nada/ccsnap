/*
  forms_utils.js
  --------------
  Shared helpers for form processing, navigation, and submission.

  UPDATED: Implemented UNIVERSAL STEP SKIPPER based on 'previousApplicant' checkbox.
  REMOVED: Old Proof-of-Life field hiding logic.
*/

import { createEl, userId, isValidEmail, isValidUrl, FORM_SCHEMA } from './utils.js';
import { showMessage, openSuccessModal } from './ui.js';

// --- Core Dynamic Rendering Logic ---

function createFormField(field, initialData = {}, onInput = null) {
    const value = initialData[field.id] || '';

    if (field.type === 'textarea') {
        return createEl('div', { class: 'form-group' }, [
            createLabel(field),
            createTextareaEl(field, value, onInput),
            field.helper ? createEl('div', { class: 'helper-text' }, [field.helper]) : null
        ]);
    }

    if (field.type === 'checkbox') {
        const checkboxEl = createEl('input', { 
            type: 'checkbox', 
            id: field.id, 
            name: field.id,
            onInput: onInput
        });
        // Check if stored value is explicitly true (boolean true or string 'true' or 'on')
        const storedValue = initialData[field.id];
        if (storedValue === true || storedValue === 'true' || storedValue === 'on') {
             checkboxEl.checked = true;
        }

        const labelEl = createEl(
            'label',
            { for: field.id, style: 'display:inline-flex; align-items:center; font-weight: 500;' },
            [checkboxEl, document.createTextNode(field.label)]
        );
        
        // Removed old PoL-specific wrapper/toggle logic
        return createEl('div', { class: 'form-group checkbox-group', id: `${field.id}-wrapper` }, [labelEl]);
    }

    // text/url/etc fields
    return createEl('div', { class: 'form-group link-group', id: `${field.id}-group` }, [
        createLabel(field),
        createInputEl(field, value, onInput),
        field.helper ? createEl('div', { class: 'helper-text' }, [field.helper]) : null
    ]);
}

function createInputEl(field, value, onInput) {
    return createEl('input', {
        type: field.type || 'text',
        id: field.id,
        name: field.id,
        placeholder: field.placeholder || '',
        required: field.required || false,
        value: value,
        onInput: onInput 
    });
}

function createTextareaEl(field, value, onInput) {
    const textarea = createEl('textarea', {
        id: field.id,
        name: field.id,
        rows: field.rows || 3,
        required: field.required || false,
        maxLength: field.maxLength || null,
        onInput: onInput
    });
    textarea.value = value;
    return textarea;
}

function createLabel(field) {
    const children = [field.label];
    if (field.required) {
        children.push(createEl('span', { style: 'color:#dc2626;' }, [' *']));
    }
    return createEl('label', { for: field.id }, children);
}

// ------------------------------------------------------------------
// Dynamic Form Rendering
// ------------------------------------------------------------------

export function renderDynamicForm(formContainer, type, initialData = {}) {
    const formSchema = FORM_SCHEMA[type];
    const steps = [];

    if (!formSchema) {
        console.error(`Schema not found for type: ${type}`);
        return [];
    }

    formSchema.steps.forEach((step, stepIndex) => {
        const stepEl = createEl('div', { class: 'form-step', dataset: { step: stepIndex, stepType: step.id } }); // Added stepType for custom logic

        if (step.type === 'custom_members_list') {
            stepEl.innerHTML = `
                <h3 style="margin-bottom:0.5rem;">${step.name}</h3>
                <div id="members-container"></div>
                <button type="button" class="btn secondary" id="btn-add-member" style="margin-top:0.5rem;">Add Member</button>
            `;
        } else {
            if (step.fields.length > 0) {
                stepEl.appendChild(createEl('h3', { style: 'margin-bottom:1.25rem;' }, [step.name]));
            }

            step.fields.forEach(field => {
                stepEl.appendChild(createFormField(field, initialData));
            });
        }

        steps.push(stepEl);
    });

    return steps;
}

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------

export function setupMultiStepNav(form, steps, validator, submitHandler) {
    const nav = createEl('div', {
        class: 'step-nav',
        style: 'margin-top:1rem; display:flex; justify-content:space-between;'
    });
    const nextBtn = createEl('button', { type: 'button', class: 'btn' }, ['Next']);
    const prevBtn = createEl('button', {
        type: 'button',
        class: 'btn secondary',
        style: 'display:none; margin-right:0.5rem;'
    }, ['Previous']);
  
    let current = 0;
    const showStep = (i) => {
        steps.forEach((s, idx) => s.style.display = idx === i ? '' : 'none');
        prevBtn.style.display = i === 0 ? 'none' : '';
        nextBtn.textContent = i === steps.length - 1
            ? (window.isEditMode ? 'Update' : 'Submit')
            : 'Next';
    };
  
    prevBtn.addEventListener('click', () => { 
        if (current > 0) { 
            current--; 
            showStep(current); 
        } 
    });
    
    nextBtn.addEventListener('click', () => {
        // 1. Run standard validation for the current step
        if (!validator(current, form)) return;
        
        let nextStepIndex = current + 1;
        const formData = new FormData(form);

        // --- UNIVERSAL STEP SKIPPER LOGIC ---
        // Assumption: Step 1 (index 0) holds the 'previousApplicant' checkbox 
        // and Step 2 (index 1) is the Proof-of-Life link step.
        if (current === 0) { 
            // The field ID is consistent across all forms: 'previousApplicant'
            const previousApplicantChecked = formData.get('previousApplicant'); 

            // If the user checked the exemption AND the next logical step is index 1 (the PoL step)
            if (previousApplicantChecked && nextStepIndex === 1) {
                if (steps.length > 2) {
                    console.log("Skipping Proof-of-Life step due to previous applicant exemption.");
                    nextStepIndex = 2; // Jump directly to Step 3 (index 2)
                }
            }
        }
        // --- END UNIVERSAL STEP SKIPPER LOGIC ---

        // 2. Perform navigation
        if (nextStepIndex < steps.length) { 
            current = nextStepIndex; 
            showStep(current); 
        } else { 
            form.requestSubmit(); 
        }
    });
  
    form.onsubmit = (e) => submitHandler(e, form);
  
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    form.appendChild(nav);
    showStep(0);
}

// ------------------------------------------------------------------
// Submission
// ------------------------------------------------------------------

export function submitToServer(application, typeLabel) {
    if (window.isEditMode) {
        application.entryId = window.editEntryId;
        application.editToken = window.editToken;
    }

    application.userId = userId;

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

// ------------------------------------------------------------------
// Populate Form
// ------------------------------------------------------------------

export function populateForm(formContainer, type, data) {
    const inputs = formContainer.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
        if (!data.hasOwnProperty(input.name)) return;

        if (input.type !== 'checkbox' && input.type !== 'file') {
            input.value = data[input.name];
        } else if (input.type === 'checkbox') {
            // Check if stored value is explicitly true (boolean true or string 'true' or 'on')
            const storedValue = data[input.name];
            if (storedValue === true || storedValue === 'true' || storedValue === 'on') {
                input.checked = true;
                input.dispatchEvent(new Event('change'));
            }
        }
    });
}