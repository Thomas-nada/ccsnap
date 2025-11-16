/*
  Simple Node HTTP server for the CC Application Demo
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const submissionsDir = path.join(ROOT, 'submissions');

// --- CONFIGURATION ---
// Registration Start Time: Sunday, November 16, 2025, 21:53:00 UTC (Set to 5 minutes from 21:48 UTC)
const REGISTRATION_START = new Date('2025-11-16T21:53:00Z').getTime();
// Registration Deadline: November 25, 2025, 12:00 UTC
const REGISTRATION_DEADLINE = new Date('2025-11-25T12:00:00Z').getTime();

// Helper to synchronously assign entry IDs
function ensureEntryIdsSync() {
  try {
    const files = fs.readdirSync(submissionsDir);
    const presentIds = new Set();
    files.forEach((fname) => {
      if (!fname.endsWith('.json')) return;
      const fpath = path.join(submissionsDir, fname);
      try {
        const raw = fs.readFileSync(fpath, 'utf8');
        const sub = JSON.parse(raw);
        if (sub.entryId) presentIds.add(sub.entryId);
      } catch (_) {}
    });
    files.forEach((fname) => {
      if (!fname.endsWith('.json')) return;
      const fpath = path.join(submissionsDir, fname);
      try {
        const raw = fs.readFileSync(fpath, 'utf8');
        const sub = JSON.parse(raw);
        if (!sub.entryId) {
          let newId;
          do {
            newId = Math.floor(10000000 + Math.random() * 90000000).toString();
          } while (presentIds.has(newId));
          presentIds.add(newId);
          sub.entryId = newId;
          fs.writeFileSync(fpath, JSON.stringify(sub, null, 2));
        }
      } catch (_) {}
    });
  } catch (err) {
    console.error('Failed to synchronise entry IDs:', err);
  }
}

fs.mkdirSync(submissionsDir, { recursive: true });
ensureEntryIdsSync();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function handleEditSubmission(res, submission) {
  const now = Date.now();
  // Enforce Start time and Deadline for Edits as well
  if (now < REGISTRATION_START) {
    return sendJson(res, 403, { error: 'Editing is not allowed before registration starts.' });
  }
  if (now > REGISTRATION_DEADLINE) {
    return sendJson(res, 403, { error: 'Registration is closed. No further edits allowed.' });
  }

  const { entryId, editToken } = submission;

  fs.readdir(submissionsDir, (err, files) => {
    if (err) return sendJson(res, 500, { error: 'Failed to load submissions' });

    let fileFound = false;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(submissionsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const storedSub = JSON.parse(content);

        if (storedSub.entryId === entryId) {
          fileFound = true;
          if (storedSub.editToken === editToken) {
            submission.editToken = storedSub.editToken;
            submission.entryId = storedSub.entryId;
            submission.submittedAt = storedSub.submittedAt; 
            submission.userId = storedSub.userId; 

            fs.writeFileSync(filePath, JSON.stringify(submission, null, 2));
            return sendJson(res, 200, { status: 'ok', message: 'Submission updated' });
          } else {
            return sendJson(res, 403, { error: 'Invalid edit token' });
          }
        }
      } catch (err) {}
    }
    if (!fileFound) return sendJson(res, 404, { error: 'Submission not found' });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // API: Submit
  if (req.url === '/api/submit' && req.method === 'POST') {
    const now = Date.now();
    // 1. Check Start time and Deadline FIRST
    if (now < REGISTRATION_START) {
        return sendJson(res, 403, { error: 'Registration has not started yet.' });
    }
    if (now > REGISTRATION_DEADLINE) {
      return sendJson(res, 403, { error: 'Registration is closed for new submissions.' });
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const submission = JSON.parse(body);
        if (!submission || !submission.applicationType || !submission.submittedAt || !submission.data) {
          return sendJson(res, 400, { error: 'Invalid submission format' });
        }

        if (submission.entryId && submission.editToken) {
          handleEditSubmission(res, submission);
        } else {
          // New Submission logic
          if (!submission.entryId) {
            submission.entryId = Math.floor(10000000 + Math.random() * 90000000).toString();
          }
          const editToken = crypto.randomBytes(16).toString('hex');
          submission.editToken = editToken;
          const timestamp = Date.now();
          const filename = path.join(submissionsDir, `${timestamp}.json`);
          
          fs.writeFile(filename, JSON.stringify(submission, null, 2), (err) => {
            if (err) {
              console.error('Failed to write submission:', err);
              return sendJson(res, 500, { error: 'Failed to store submission' });
            }
            sendJson(res, 200, { status: 'ok', entryId: submission.entryId, editToken: editToken });
          });
        }
      } catch (err) {
        sendJson(res, 400, { error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  // API: LOOKUP BY TOKEN
  if (req.url === '/api/lookup' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { token } = JSON.parse(body);
        if (!token) return sendJson(res, 400, { error: 'Token required' });

        // Check if lookup/editing is allowed
        if (Date.now() < REGISTRATION_START) {
            return sendJson(res, 403, { error: 'Editing is not allowed before registration starts.' });
        }

        fs.readdir(submissionsDir, (err, files) => {
          if (err) return sendJson(res, 500, { error: 'Storage error' });

          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
              const content = fs.readFileSync(path.join(submissionsDir, file), 'utf8');
              const sub = JSON.parse(content);
              if (sub.editToken === token) {
                return sendJson(res, 200, sub);
              }
            } catch (e) {}
          }
          sendJson(res, 404, { error: 'Invalid token or submission not found' });
        });
      } catch (e) {
        sendJson(res, 400, { error: 'Invalid request' });
      }
    });
    return;
  }

  // API: List
  if (req.url === '/api/applications' && req.method === 'GET') {
    fs.readdir(submissionsDir, (err, files) => {
      if (err) return sendJson(res, 500, { error: 'Failed to load submissions' });
      const applications = [];
      files
        .filter((file) => file.endsWith('.json'))
        .forEach((file) => {
          try {
            const content = fs.readFileSync(path.join(submissionsDir, file), 'utf8');
            const submission = JSON.parse(content);
            const { editToken, ...safeSubmission } = submission;
            // Clean up potentially sensitive fields for public list display
            if (safeSubmission.data) {
                delete safeSubmission.data.email;
                delete safeSubmission.data.contactEmail;
                delete safeSubmission.data.proofOfLifeLink;
                delete safeSubmission.data.orgProofOfLifeLink;
                delete safeSubmission.data.consortiumProofOfLifeLink;
            }
            applications.push(safeSubmission);
          } catch (err) {}
        });
      applications.sort((a, b) => b.submittedAt - a.submittedAt);
      sendJson(res, 200, applications);
    });
    return;
  }

  // API: Get One
  if (req.url.startsWith('/api/applications/') && req.method === 'GET') {
    const urlParts = req.url.split('?')[0].split('/');
    const entryId = urlParts[urlParts.length - 1];

    fs.readdir(submissionsDir, (err, files) => {
      if (err) return sendJson(res, 500, { error: 'Failed to load submissions' });
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = fs.readFileSync(path.join(submissionsDir, file), 'utf8');
          const submission = JSON.parse(content);
          if (submission.entryId === entryId || submission.id === entryId) {
             const { editToken, ...safeSubmission } = submission;
             // Clean up potentially sensitive fields for detail display
             if (safeSubmission.data) {
                delete safeSubmission.data.email;
                delete safeSubmission.data.contactEmail;
                delete safeSubmission.data.proofOfLifeLink;
                delete safeSubmission.data.orgProofOfLifeLink;
                delete safeSubmission.data.consortiumProofOfLifeLink;
            }
             return sendJson(res, 200, safeSubmission);
          }
        } catch (err) {}
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });
    return;
  }

  // --- STATIC FILE SERVING & ROUTING ---
  let reqPath = decodeURIComponent(req.url).split('?')[0];
  let filePath;

  if (reqPath.endsWith('/')) reqPath = reqPath.slice(0, -1);
  
  let subPath = null;
  
  // 1. Handle /ccsnap prefix for HTML pages (Routes)
  if (reqPath === '/ccsnap') {
    filePath = path.join(ROOT, 'index.html');
  } else if (reqPath.startsWith('/ccsnap')) {
    subPath = reqPath.slice('/ccsnap'.length);
    if (subPath === '/register') {
      filePath = path.join(ROOT, 'register.html');
    } else if (subPath === '/candidates') {
      filePath = path.join(ROOT, 'candidates.html');
    } else if (subPath.startsWith('/candidates/')) {
      filePath = path.join(ROOT, 'candidate.html');
    } else if (subPath.startsWith('/')) {
        // This handles assets requested *with* the prefix, e.g., /ccsnap/styles.css
        filePath = path.join(ROOT, subPath.slice(1));
    } else {
      filePath = path.join(ROOT, subPath);
    }
  } 
  
  // 2. Handle root assets requested without prefix (e.g., /styles.css, /app.js)
  // This is the fallback for assets linked using the root-relative path (e.g. <link href="/styles.css">)
  if (!filePath) {
      const ext = path.extname(reqPath);
      // Check for common asset extensions or assume it's a file if it looks like one
      if (ext === '.css' || ext === '.js' || ext === '.html' || ext === '.png' || reqPath === '/app.js' || reqPath === '/styles.css') {
         filePath = path.join(ROOT, reqPath.startsWith('/') ? reqPath.slice(1) : reqPath);
      } else if (reqPath === '' || reqPath === '/') {
        // Serve index.html if request is simply root /
        filePath = path.join(ROOT, 'index.html');
      }
  }

  if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
  }


  fs.readFile(filePath, (err, data) => {
    if (err) {
        console.error(`Error reading file ${filePath}:`, err.code);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
    }
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.png') contentType = 'image/png';
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
