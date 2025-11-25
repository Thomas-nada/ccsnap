/*
  forms_org.js
  ------------
  Specific form logic for Organisation candidates.
  
  FIX: Implements conditional mandatory check for orgProofOfLifeLink.
*/

import { isValidEmail, isValidUrl, FORM_SCHEMA, userId } from './utils.js'; 
import { showMessage } from './ui.js';
import { setupMultiStepNav, submitToServer, renderDynamicForm } from './forms_utils.js';

export function renderOrganizationForm(formContainer, initialData = {}) {
  // Use the new dynamic renderer
  const steps = renderDynamicForm(formContainer, 'Organization', initialData);
  
  steps.forEach((s) => formContainer.appendChild(s));
  setupMultiStepNav(formContainer, steps, validateOrganizationStep, handleSubmitOrganisation);
}

function validateOrganizationStep(stepIndex, formContainer) {
    const schema = FORM_SCHEMA['Organization']?.steps[stepIndex];
    if (!schema || !schema.fields) { return true; }

    const formData = new FormData(formContainer);
    let allValid = true;
    
    for (const field of schema.fields) {
        const value = formData.get(field.id)?.trim() || '';
        
        // --- CONDITIONAL MANDATORY & URL VALIDATION FOR ORG PoL LINK ---
        if (field.id === 'orgProofOfLifeLink') {
            const previousApplicantChecked = formData.get('previousApplicant');

            // 1. CONDITIONAL REQUIRED CHECK
            if (!previousApplicantChecked && !value) {
                 showMessage('Proof of Life link is mandatory if your organisation has not registered in a previous election.', 'error');
                 allValid = false;
                 continue;
            }

            // 2. URL FORMAT CHECK (only if a value is present)
            if (value && !isValidUrl(value)) {
                 showMessage('Invalid video URL.', 'error');
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
    }

    return allValid;
}

function handleSubmitOrganisation(e, formContainer) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = Object.fromEntries(formData.entries());
  
  const isExempt = !!data.previousApplicant;

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

      // --- UPDATED PoL FIELDS ---
      previousApplicant: isExempt, // New flag: did they check the box?
      orgProofOfLifeLink: isExempt ? '' : (data.orgProofOfLifeLink || ''), 
      
      orgExperience: data.orgExperience,
      orgTransparencyApproach: data.orgTransparencyApproach,
      orgMotivation: data.orgMotivation,
    },
  };
  submitToServer(application, 'Organisation');
}