/*
  Express Server for the CC Application Demo
  -----------------------------------------
*/

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const submissionsDir = path.join(ROOT, 'submissions');

// --- CONFIGURATION ---
// Deadline: November 25, 2025, 12:00 UTC
const REGISTRATION_DEADLINE = new Date('2025-11-25T12:00:00Z').getTime();

// Helper to synchronously assign entry IDs and create tokens if missing
function ensureEntryIdsSync() {
  try {
    if (!fs.existsSync(submissionsDir)) {
      fs.mkdirSync(submissionsDir, { recursive: true });
    }
    
    const files = fs.readdirSync(submissionsDir);
    const presentIds = new Set();
    
    // First pass: Collect existing IDs
    files.forEach((fname) => {
      if (!fname.endsWith('.json')) return;
      const fpath = path.join(submissionsDir, fname);
      try {
        const raw = fs.readFileSync(fpath, 'utf8');
        const sub = JSON.parse(raw);
        if (sub.entryId) presentIds.add(sub.entryId);
      } catch (_) {}
    });

    // Second pass: Assign missing IDs or tokens
    files.forEach((fname) => {
      if (!fname.endsWith('.json')) return;
      const fpath = path.join(submissionsDir, fname);
      try {
        const raw = fs.readFileSync(fpath, 'utf8');
        let sub = JSON.parse(raw);
        let changed = false;

        // Ensure entryId exists
        if (!sub.entryId) {
          let newId;
          do {
            newId = Math.floor(10000000 + Math.random() * 90000000).toString();
          } while (presentIds.has(newId));
          sub.entryId = newId;
          presentIds.add(newId);
          changed = true;
        }

        // Ensure editToken exists
        if (!sub.editToken) {
          sub.editToken = crypto.randomBytes(16).toString('hex');
          changed = true;
        }

        if (changed) {
          fs.writeFileSync(fpath, JSON.stringify(sub, null, 2), 'utf8');
        }
      } catch (e) {
        console.error(`Error processing file ${fname}:`, e.message);
      }
    });
    console.log('Submission files verified and updated with entry IDs/tokens.');
  } catch (err) {
    console.error('Error during file initialization:', err);
  }
}

// Initial ID assignment on server start
ensureEntryIdsSync();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(bodyParser.json());

// --- API ENDPOINTS (No changes needed) ---

// 1. Submit/Update Application
app.post('/api/submit', (req, res) => {
  const application = req.body;
  const now = Date.now();

  if (now > REGISTRATION_DEADLINE && !application.editToken) {
    return res.status(403).json({ error: 'Registration is closed for new submissions.' });
  }

  try {
    if (application.editToken && application.entryId) {
      const { entryId, editToken } = application;
      const filePath = path.join(submissionsDir, `${entryId}.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Entry not found for update.' });
      }

      const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (existingData.editToken !== editToken) {
        return res.status(401).json({ error: 'Invalid token for entry update.' });
      }

      const updatedApplication = {
        ...application,
        entryId: existingData.entryId,
        editToken: existingData.editToken,
        submittedAt: existingData.submittedAt, 
        updatedAt: now
      };
      
      fs.writeFileSync(filePath, JSON.stringify(updatedApplication, null, 2), 'utf8');
      console.log(`Updated entry: ${entryId}`);
      return res.status(200).json({ entryId, editToken: existingData.editToken });

    } else {
      if (now > REGISTRATION_DEADLINE) {
        return res.status(403).json({ error: 'Registration is closed for new submissions.' });
      }

      let newId;
      const files = fs.readdirSync(submissionsDir);
      const presentIds = new Set();
      files.forEach(fname => {
        if (fname.endsWith('.json')) {
            try {
                const sub = JSON.parse(fs.readFileSync(path.join(submissionsDir, fname), 'utf8'));
                if (sub.entryId) presentIds.add(sub.entryId);
            } catch (_) {}
        }
      });
      
      do {
        newId = Math.floor(10000000 + Math.random() * 90000000).toString();
      } while (presentIds.has(newId));

      const newEditToken = crypto.randomBytes(16).toString('hex');
      const newApplication = {
        ...application,
        entryId: newId,
        editToken: newEditToken,
        submittedAt: now
      };
      
      const filePath = path.join(submissionsDir, `${newId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(newApplication, null, 2), 'utf8');
      console.log(`New entry created: ${newId}`);
      return res.status(201).json({ entryId: newId, editToken: newEditToken });
    }

  } catch (error) {
    console.error('API submission error:', error);
    return res.status(500).json({ error: 'Failed to process submission.' });
  }
});

// 2. Lookup Application by Token (for Editing)
app.post('/api/lookup', (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Token is required.' });
    }

    try {
        const files = fs.readdirSync(submissionsDir);
        for (const fname of files) {
            if (fname.endsWith('.json')) {
                const fpath = path.join(submissionsDir, fname);
                const sub = JSON.parse(fs.readFileSync(fpath, 'utf8'));

                if (sub.editToken === token) {
                    const appData = { ...sub };
                    delete appData.editToken; 
                    return res.json(appData);
                }
            }
        }
        return res.status(404).json({ error: 'Application not found or token is invalid.' });
    } catch (error) {
        console.error('API lookup error:', error);
        return res.status(500).json({ error: 'Failed to lookup application.' });
    }
});


// 3. Get All Applications (for Candidates list)
app.get('/api/applications', (req, res) => {
  try {
    const apps = [];
    const files = fs.readdirSync(submissionsDir);

    files.forEach((fname) => {
      if (!fname.endsWith('.json')) return;
      const fpath = path.join(submissionsDir, fname);
      try {
        const sub = JSON.parse(fs.readFileSync(fpath, 'utf8'));
        const safeSub = { 
            entryId: sub.entryId,
            applicationType: sub.applicationType,
            submittedAt: sub.submittedAt,
            data: sub.data
        };
        if (safeSub.data) {
            delete safeSub.data.email;
            delete safeSub.data.contactEmail;
            delete safeSub.data.proofOfLifeLink;
            delete safeSub.data.orgProofOfLifeLink;
            delete safeSub.data.consortiumProofOfLifeLink;
        }
        apps.push(safeSub);
      } catch (e) {
        console.error(`Error reading application file ${fname}:`, e.message);
      }
    });

    res.json(apps);
  } catch (error) {
    console.error('API get applications error:', error);
    res.status(500).json({ error: 'Failed to retrieve applications.' });
  }
});

// 4. Get Single Application by ID (for Candidate Detail page)
app.get('/api/applications/:id', (req, res) => {
  const entryId = req.params.id;
  const filePath = path.join(submissionsDir, `${entryId}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  try {
    const sub = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const safeSub = { 
        entryId: sub.entryId,
        applicationType: sub.applicationType,
        submittedAt: sub.submittedAt,
        data: sub.data
    };
    if (safeSub.data) {
        delete safeSub.data.email;
        delete safeSub.data.contactEmail;
        delete safeSub.data.proofOfLifeLink;
        delete safeSub.data.orgProofOfLifeLink;
        delete safeSub.data.consortiumProofOfLifeLink;
    }

    res.json(safeSub);
  } catch (error) {
    console.error(`API get application ${entryId} error:`, error);
    res.status(500).json({ error: 'Failed to retrieve application detail.' });
  }
});


// --- STATIC FILE SERVING & ROUTING ---

// 1. Serve static files (styles.css, app.js, images, etc.) from the root directory.
// This handles requests like /styles.css, /app.js
app.use(express.static(ROOT));

// 2. Explicit Fix: Ensure static files are also served correctly when prefixed with /ccsnap.
app.use('/ccsnap', express.static(ROOT));


// 3. Custom routing logic for the /ccsnap prefix (sends HTML file):
app.get('/ccsnap', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.get('/ccsnap/register', (req, res) => {
  res.sendFile(path.join(ROOT, 'register.html'));
});

app.get('/ccsnap/candidates', (req, res) => {
  res.sendFile(path.join(ROOT, 'candidates.html'));
});

// For any candidate detail page (e.g., /ccsnap/candidates/12345678), serve candidate.html
app.get('/ccsnap/candidates/:id', (req, res) => {
  res.sendFile(path.join(ROOT, 'candidate.html'));
});


// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});