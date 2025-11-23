/*
  utils.js
  --------
  Constants, Validation, and DOM Helpers (Client-Safe)
*/
// The blakejs require statement and crypto functions are REMOVED to ensure browser compatibility.

export const BIO_LIMIT = 500;
export const MOTIVATION_LIMIT = 1000;
export const STORAGE_KEY = 'ccApplications';
export const USER_ID_KEY = 'ccUserId';

// --- CONFIGURATION CONSTANT (SET THIS LOCALLY) ---
// Note: This needs to be set in your client-side files for this logic to work.
export const VOTING_MODE = 'ADA_BALANCE'; 
// export const VOTING_MODE = 'ADA_BALANCE'; 
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
            REGISTRATION_START = config.registrationStart;
            REGISTRATION_DEADLINE = config.registrationDeadline;
            VOTING_START = config.votingStart;
            VOTING_END = config.votingEnd;
            SNAPSHOT_EPOCH = config.snapshotEpoch;
            console.log("Config loaded:", config);
        }
    } catch (e) {
        console.warn("Failed to load remote config, using defaults.");
    }
}

// --- User Identity ---
export function getUserId() {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    uid = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
}

export const userId = getUserId();

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

// --- CLIENT-SAFE CRYPTO HELPERS (Only minimal browser-safe utils remain) ---

/**
 * Converts a string to a hex string. (Used for payload serialization)
 * @param {string} str - The input string.
 * @returns {string} The hex representation.
 */
export function stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        // Pads to 2 digits to ensure proper hex representation
        hex += '' + str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
}

// getHash function removed entirely.

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