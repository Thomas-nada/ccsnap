import { showMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    document.getElementById('btn-save-config').addEventListener('click', saveConfig);
});

// Helper to format Date for input[type="datetime-local"]
const toInputString = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Failed to load config');
        const config = await res.json();

        document.getElementById('reg-start').value = toInputString(config.registrationStart);
        document.getElementById('reg-end').value = toInputString(config.registrationDeadline);
        document.getElementById('vote-start').value = toInputString(config.votingStart);
        document.getElementById('vote-end').value = toInputString(config.votingEnd);
        document.getElementById('audit-start').value = toInputString(config.auditStart);
        document.getElementById('snapshot-epoch').value = config.snapshotEpoch;

    } catch (e) {
        console.error(e);
        showMessage("Could not load current configuration.", 'error');
    }
}

async function saveConfig() {
    console.log("Saving configuration...");
    
    const config = {
        registrationStart: new Date(document.getElementById('reg-start').value).getTime(),
        registrationDeadline: new Date(document.getElementById('reg-end').value).getTime(),
        votingStart: new Date(document.getElementById('vote-start').value).getTime(),
        votingEnd: new Date(document.getElementById('vote-end').value).getTime(),
        auditStart: new Date(document.getElementById('audit-start').value).getTime(),
        snapshotEpoch: parseInt(document.getElementById('snapshot-epoch').value)
    };

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (res.ok) {
            console.log("Config saved to server.");
            showMessage('Configuration saved successfully!', 'success');
        } else {
            throw new Error('Save failed');
        }
    } catch (e) {
        console.error(e);
        showMessage('Failed to save configuration.', 'error');
    }
}