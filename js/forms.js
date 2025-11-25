/*
  forms.js (Aggregator)
  ---------------------
  Central export point for form modules.
  Keeps app.js import paths clean.
*/

export { populateForm } from './forms_utils.js';
export { renderIndividualForm } from './forms_individual.js';
export { renderOrganizationForm as renderOrganisationForm } from './forms_org.js'; // FIX: Use alias for British English clarity
export { renderConsortiumForm, resetConsortiumMembers, setConsortiumMembers } from './forms_consortium.js';