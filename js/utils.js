/*
  utils.js
  --------
  Constants, Validation, and DOM Helpers (Client-Safe)
*/

export const BIO_LIMIT = 500;
export const MOTIVATION_LIMIT = 1000;
export const STORAGE_KEY = 'ccApplications';

// --- CONFIGURATION VARS (Mutable) ---
export let VOTING_MODE = 'ADA_BALANCE'; 
export let MIN_VOTING_POWER = 1; 
export let MIN_VOTES = 1; // NEW: Minimum candidates to vote for
export let MAX_VOTES = 5; // NEW: Maximum candidates to vote for
export let ELECTION_NAME = 'Constitutional Election'; // Default
export let NETWORK_NAME = 'mainnet';
export let FORM_SCHEMA = {}; // NEW: Global container for form definitions

// Feature Flags (Default to true)
export let SHOW_REGISTER = true;
export let SHOW_VOTE = true;
export let SHOW_RESULTS = true;
// --------------------------------------------------

// Default Dates (Will be overwritten by fetchConfig)
export let REGISTRATION_START = new Date('2025-11-16T21:53:00Z').getTime();
export let REGISTRATION_DEADLINE = new Date('2025-11-24T12:00:00Z').getTime();
export let VOTING_START = new Date('2025-11-02T12:00:00Z').getTime();
export let VOTING_END = new Date('2025-12-02T12:00:00Z').getTime();
export let SNAPSHOT_EPOCH = null; 

// Function to update config from server
export async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const config = await res.json();
            
            if (config.registrationStart) REGISTRATION_START = config.registrationStart;
            if (config.registrationDeadline) REGISTRATION_DEADLINE = config.registrationDeadline;
            if (config.votingStart) VOTING_START = config.votingStart;
            if (config.votingEnd) VOTING_END = config.votingEnd;
            if (config.snapshotEpoch) SNAPSHOT_EPOCH = config.snapshotEpoch;
            
            if (typeof config.minVotingPower === 'number') MIN_VOTING_POWER = config.minVotingPower;
            if (typeof config.minVotes === 'number') MIN_VOTES = config.minVotes; // NEW
            if (typeof config.maxVotes === 'number') MAX_VOTES = config.maxVotes; // NEW
            
            // --- CRITICAL: Update the Election Name ---
            if (config.electionName) ELECTION_NAME = config.electionName;
            
            if (config.network) NETWORK_NAME = config.network.toLowerCase();

            // Update Feature Flags
            if (typeof config.showRegister === 'boolean') SHOW_REGISTER = config.showRegister;
            if (typeof config.showVote === 'boolean') SHOW_VOTE = config.showVote;
            if (typeof config.showResults === 'boolean') SHOW_RESULTS = config.showResults;

            if (config.votingType === 'drep') {
                VOTING_MODE = 'DREP_POWER';
            } else {
                VOTING_MODE = 'ADA_BALANCE';
            }

            console.log(`Config loaded. Mode: ${VOTING_MODE}, Name: ${ELECTION_NAME}`);
        }
    } catch (e) {
        console.warn("Failed to load remote config, using defaults.");
    }
    
    // NEW: Load Form Schema
    try {
        const res = await fetch('/form_schema.json');
        if (res.ok) {
            // Check content type before attempting to parse
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                FORM_SCHEMA = await res.json();
                console.log('Form schema loaded successfully.');
            } else {
                // If content type is wrong (e.g., text/html from a 404/server error), log it.
                const text = await res.text();
                console.error("Failed to load form schema. Content Type Error or Server Issue. Content preview:", text.substring(0, 50));
            }
        } else {
            console.error(`Failed to fetch form schema. Status: ${res.status}`);
        }
    } catch (e) {
        // If the fetch worked but JSON parsing failed (the user's current error)
        console.error("Failed to load form schema. SyntaxError:", e);
    }
}

// --- User Identity ---
// Removed getUserId() and userId export as it's not used for core authentication/submission.
// Rely on wallet address or token for identity.
export const userId = 'CLIENT_SIDE_SUBMISSION'; // Placeholder export to prevent breaking imports

// --- Validation Helpers ---

export function isValidEmail(email) {
  if (email.trim() === '') return true; 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

export function isValidUrl(url) {
  if (url.trim() === '') return true;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  }
  return false; 
}

// --- CLIENT-SAFE CRYPTO HELPERS ---

export function stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
}

// --- DOM Helpers ---

export function createEl(tag, attrs = {}, children = []) {
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

export function createFormGroup({ label, name, type, required = false, placeholder = '', helper = '', value = '', onInput = null }) {
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

export function createTextareaGroup({ label, name, required = false, maxLength = null, rows = 3, helper = '', value = '', onInput = null }) {
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