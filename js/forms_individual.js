/*
  forms_individual.js
  -------------------
  Specific form logic for Individual candidates.
  
  FIX: Implements conditional mandatory check for proofOfLifeLink.
*/

import { isValidEmail, isValidUrl, FORM_SCHEMA, userId } from './utils.js'; 
import { showMessage } from './ui.js';
import { setupMultiStepNav, submitToServer, renderDynamicForm } from './forms_utils.js';

export function renderIndividualForm(formContainer, initialData = {}) {
  // Use the new dynamic renderer
  const steps = renderDynamicForm(formContainer, 'Individual', initialData);
  
  steps.forEach((s) => formContainer.appendChild(s));
  setupMultiStepNav(formContainer, steps, validateIndividualStep, handleSubmitIndividual);
}

function validateIndividualStep(stepIndex, formContainer) {
    const schema = FORM_SCHEMA['Individual']?.steps[stepIndex];
    if (!schema || !schema.fields) { return true; } // Skip validation if schema step is missing

    const formData = new FormData(formContainer);
    let allValid = true;

    for (const field of schema.fields) {
        const value = formData.get(field.id)?.trim() || '';
        const inputEl = formContainer.querySelector(`[name="${field.id}"]`);
        
        if (!inputEl) continue;

        // --- CONDITIONAL MANDATORY & URL VALIDATION FOR POoL LINK ---
        if (field.id === 'proofOfLifeLink') {
            // Check the state of the exemption checkbox from the form data (must check in Step 1)
            const previousApplicantChecked = formData.get('previousApplicant');
            
            // 1. CONDITIONAL REQUIRED CHECK
            if (!previousApplicantChecked && !value) {
                 showMessage('Proof of Life link is mandatory if you have not registered in a previous election.', 'error');
                 allValid = false;
                 continue;
            }
            
            // 2. URL FORMAT CHECK (only if a value is present)
            if (value && !isValidUrl(value)) {
                 showMessage('Invalid video URL format for Proof of Life link.', 'error');
                 allValid = false;
                 continue;
            }
        } 
        // --- END PoL LOGIC ---
        
        // 1. Basic Required Check (for all other non-PoL, non-checkbox fields)
        else if (field.required && field.type !== 'checkbox' && !value) {
            showMessage(`${field.label} is required.`, 'error');
            allValid = false;
            continue;
        } 
        
        // 2. Standard URL/Email Validation (applies only if value is present)
        else if (field.type === 'email' && value && !isValidEmail(value)) {
            showMessage(`Invalid format for ${field.label}.`, 'error');
            allValid = false;
            continue;
        }
        else if (field.type === 'url' && field.id !== 'proofOfLifeLink' && value && !isValidUrl(value)) {
            showMessage(`Invalid URL format for ${field.label}.`, 'error');
            allValid = false;
            continue;
        }
    }

    return allValid;
}

function handleSubmitIndividual(e, formContainer) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = Object.fromEntries(formData.entries());
  
  // Check the new exemption flag state
  const isExempt = !!data.previousApplicant;

  // Map form data to final application structure
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
      
      // --- UPDATED PoL FIELDS ---
      previousApplicant: isExempt, // New flag: did they check the box?
      // Only store the link if they are NOT exempt
      proofOfLifeLink: isExempt ? '' : (data.proofOfLifeLink || ''), 
      
      motivation: data.motivation,
      experience: data.experience,
      transparencyApproach: data.transparencyApproach,
    },
  };
  submitToServer(application, 'Individual');
}