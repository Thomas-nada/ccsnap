/*
  forms_consortium.js
  -------------------
  Specific form logic for Consortium candidates.
  
  FIX: Implements conditional mandatory check for consortiumProofOfLifeLink.
*/

import { createEl, createFormGroup, createTextareaGroup, isValidEmail, isValidUrl, FORM_SCHEMA, userId } from './utils.js'; 
import { showMessage } from './ui.js';
import { setupMultiStepNav, submitToServer, renderDynamicForm } from './forms_utils.js';

// Shared State for Consortium Members
let consortiumMembers = [];

export function resetConsortiumMembers() {
    consortiumMembers = [];
}

export function setConsortiumMembers(members) {
    consortiumMembers = members || [];
}

function renderMemberCard(member, index) {
    // Member card creation is complex and remains here
    const card = createEl('div', { class: 'member-card' });
    const header = createEl('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;' }, [createEl('span', { style: 'font-weight:600;' }, [`Member ${index + 1}`])]);
    
    if (consortiumMembers.length > 1) {
        const removeBtn = createEl('button', { type: 'button', class: 'btn secondary', style: 'padding:0.25rem 0.5rem; font-size:0.75rem;' }, ['Remove']);
        removeBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            consortiumMembers.splice(index, 1); 
            renderMembers(); 
        });
        header.appendChild(removeBtn);
    }
    card.appendChild(header);
    
    // Field definitions manually here
    card.appendChild(createFormGroup({ label: 'Name', name: `mName${index}`, value: member.name, required: true, onInput: e => member.name = e.target.value }));
    card.appendChild(createFormGroup({ label: 'Region', name: `mRep${index}`, value: member.geographicRep, onInput: e => member.geographicRep = e.target.value }));
    card.appendChild(createTextareaGroup({ label: 'Biography', name: `mBio${index}`, value: member.biography, required: true, rows: 2, onInput: e => member.biography = e.target.value }));
    card.appendChild(createFormGroup({ label: 'Conflict of Interest', name: `mCon${index}`, value: member.conflictOfInterest, onInput: e => member.conflictOfInterest = e.target.value }));
    card.appendChild(createFormGroup({ label: 'Stake ID', name: `mStake${index}`, value: member.stakeId, onInput: e => member.stakeId = e.target.value }));
    card.appendChild(createFormGroup({ label: 'DRep ID', name: `mDRep${index}`, value: member.DRepId, onInput: e => member.DRepId = e.target.value }));
    card.appendChild(createFormGroup({ label: 'Social', name: `mSoc${index}`, value: member.socialProfile, onInput: e => member.socialProfile = e.target.value }));
    
    return card;
}

function renderMembers() {
    const membersContainer = document.getElementById('members-container');
    
    if (!membersContainer) return;
    membersContainer.innerHTML = ''; 

    if (consortiumMembers.length === 0) {
        consortiumMembers.push({ name: '', geographicRep: '', biography: '', conflictOfInterest: '', stakeId: '', DRepId: '', socialProfile: '' });
    }

    consortiumMembers.forEach((member, index) => {
      membersContainer.appendChild(renderMemberCard(member, index));
    });
}


export function renderConsortiumForm(formContainer, initialData = {}) {
  // Use the new dynamic renderer for standard fields
  const steps = renderDynamicForm(formContainer, 'Consortium', initialData);
  
  // Attach the members step content management
  const memberStep = steps.find(s => s.querySelector('#members-container'));
  
  if (memberStep) {
    // Initial render setup for the members step
    if (initialData.consortiumMembers) setConsortiumMembers(initialData.consortiumMembers);
    renderMembers();
    const addBtn = memberStep.querySelector('#btn-add-member');
    if (addBtn) {
        addBtn.addEventListener('click', () => { 
            consortiumMembers.push({ name: '', geographicRep: '', biography: '', conflictOfInterest: '', stakeId: '', DRepId: '', socialProfile: '' }); 
            renderMembers(); 
        });
    }
  }
  
  steps.forEach((s) => formContainer.appendChild(s));
  setupMultiStepNav(formContainer, steps, validateConsortiumStep, handleSubmitConsortium);
}

function validateConsortiumStep(stepIndex, formContainer) {
    const schema = FORM_SCHEMA['Consortium']?.steps[stepIndex];
    if (!schema) { return true; }

    const formData = new FormData(formContainer);
    let allValid = true;
    
    // Handle standard fields using schema
    if (schema.fields) {
        for (const field of schema.fields) {
            const value = formData.get(field.id)?.trim() || '';
            
            // --- CONDITIONAL MANDATORY & URL VALIDATION FOR CONSORTIUM PoL LINK ---
            if (field.id === 'consortiumProofOfLifeLink') {
                // Check the state of the exemption checkbox from the form data
                const previousApplicantChecked = formData.get('previousApplicant');
                
                // 1. CONDITIONAL REQUIRED CHECK
                if (!previousApplicantChecked && !value) {
                     showMessage('Proof of Life link is mandatory if your consortium has not registered in a previous election.', 'error');
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
    }
    
    // Handle custom members step validation
    if (schema.type === 'custom_members_list') {
        if (consortiumMembers.length === 0) { showMessage('Add at least one member to the consortium.', 'error'); return false; }
        for (let m of consortiumMembers) { 
            // Name and Biography are mandatory for all members
            if (!m.name || !m.name.trim() || !m.biography || !m.biography.trim()) { 
                showMessage('Member name and biography are required for all members.', 'error'); 
                allValid = false; 
            } 
        }
    }

    return allValid;
}

function handleSubmitConsortium(e, formContainer) {
  e.preventDefault();
  const formData = new FormData(formContainer);
  const data = Object.fromEntries(formData.entries());

  const isExempt = !!data.previousApplicant;

  const application = {
    applicationType: 'Consortium',
    submittedAt: Date.now(),
    userId: userId, 
    data: {
      // Map all standard fields from formData
      consortiumName: data.consortiumName,
      consortiumContactPerson: data.consortiumContactPerson,
      consortiumContactEmail: data.consortiumContactEmail,
      consortiumMission: data.consortiumMission || '',
      consortiumValues: data.consortiumValues || '',
      consortiumMotivation: data.consortiumMotivation,
      consortiumExperience: data.consortiumExperience,
      consortiumTransparencyApproach: data.consortiumTransparencyApproach,
      
      // --- UPDATED PoL FIELDS ---
      previousApplicant: isExempt, // New flag: did they check the box?
      consortiumProofOfLifeLink: isExempt ? '' : (data.consortiumProofOfLifeLink || ''), 
      
      // Pass the member array state
      consortiumMembers: consortiumMembers.map(m => ({
          name: m.name,
          geographicRep: m.geographicRep || '',
          biography: m.biography,
          conflictOfInterest: m.conflictOfInterest || '',
          stakeId: m.stakeId || '',
          DRepId: m.DRepId || '',
          socialProfile: m.socialProfile || ''
      })),
    },
  };
  submitToServer(application, 'Consortium');
}