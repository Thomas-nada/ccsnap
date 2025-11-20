/*
  Simple Node HTTP server for the CC Application Demo
  SECURED against malformed requests and scanners
  Wrapped with Global Error Handling for Stability
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url'); // Import URL for validation

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const submissionsDir = path.join(ROOT, 'submissions');

// --- CONFIGURATION ---
// Registration Start Time: Sunday, November 16, 2025, 21:53:00 UTC (Set to 5 minutes from 21:48 UTC)
const REGISTRATION_START = new Date('2025-11-16T21:53:00Z').getTime();
// Registration Deadline: November 25, 2025, 12:00 UTC
const REGISTRATION_DEADLINE = new Date('2025-11-24T12:00:00Z').getTime();

// --- 1. GLOBAL SAFETY NET (Prevents crashing on unexpected errors) ---
// This acts as a "Try/Catch" for the whole server process. 
// If an error slips through, this catches it, logs it, and prevents the server from dying.
process.on('uncaughtException', (err) => {
  console.error('------------------------------------------------');
  console.error('PREVENTED CRASH (Uncaught Exception):');
  console.error(err);
  console.error('------------------------------------------------');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PREVENTED CRASH (Unhandled Rejection):', reason);
});

// --- VALIDATION HELPERS ---
function isValidEmail(email) {
  if (!email || email.trim() === '') return true; // Allow empty
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

function isValidUrl(url) {
  if (!url || url.trim() === '') return true; // Allow empty
  // Must start with http:// or https://
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      new URL(url); // Check if it's a valid URL structure
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}

// Helper to synchronously assign entry IDs
function ensureEntryIdsSync() {
  // Wrapped in try-catch just in case FS fails on startup
  try {
    if (!fs.existsSync(submissionsDir)) {
        fs.mkdirSync(submissionsDir, { recursive: true });
    }
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

// Ensure directory exists safely
try {
    if (!fs.existsSync(submissionsDir)) {
        fs.mkdirSync(submissionsDir, { recursive: true });
    }
} catch (e) {
    console.error("Error creating submission dir:", e);
}

ensureEntryIdsSync();

function sendJson(res, statusCode, data) {
  try {
    // Prevent "headers already sent" crashes
    if (res.headersSent) return;
    
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  } catch (e) {
      console.error("Error sending JSON:", e.message);
  }
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
  // --- 2. REQUEST HANDLER WRAPPER ---
  // This catches malformed URLs (like %) and other synchronous logic errors
  try {
      
    // Catch scanner disconnects specifically
    req.on('error', (err) => console.error('Req error:', err.message));
    res.on('error', (err) => console.error('Res error:', err.message));

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    // --- 3. SAFE URL DECODING (IMPROVED) ---
    // Uses colleague's logic: Split query string FIRST, then decode.
    // This prevents crashes from malformed characters inside the query string.
    const rawUrl = req.url || '/';
    let reqPath;

    try {
        // Safely decode and strip query string
        reqPath = decodeURIComponent(rawUrl.split('?')[0]);
    } catch (e) {
        console.warn('Malformed request URL, ignoring:', rawUrl, e.message);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Bad Request');
    }

    // API: Submit
    if (reqPath === '/api/submit' && req.method === 'POST') {
        const now = Date.now();
        // 1. Check Start time and Deadline FIRST
        if (now < REGISTRATION_START) {
            return sendJson(res, 403, { error: 'Registration has not started yet.' });
        }
        if (now > REGISTRATION_DEADLINE) {
        return sendJson(res, 403, { error: 'Registration is closed for new submissions.' });
        }

        let body = '';
        req.on('data', (chunk) => { 
            body += chunk; 
            // Safety: Kill giant requests
            if(body.length > 1e6) req.destroy();
        });
        req.on('end', () => {
        try {
            const submission = JSON.parse(body);
            if (!submission || !submission.applicationType || !submission.submittedAt || !submission.data) {
            return sendJson(res, 400, { error: 'Invalid submission format' });
            }

            // --- START SERVER-SIDE VALIDATION ---
            const data = submission.data;
            let validationError = null;

            if (submission.applicationType === 'Individual') {
                if (!isValidEmail(data.email)) validationError = 'Invalid contact email format.';
                if (!isValidUrl(data.socialProfile)) validationError = 'Invalid social profile URL. Must start with http:// or https://';
                if (!data.proofOfLifeExempt && data.proofOfLifeLink && !isValidUrl(data.proofOfLifeLink)) validationError = 'Invalid Proof-of-Life URL. Must start with http:// or https://';
            } 
            else if (submission.applicationType === 'Organization') {
                if (!isValidEmail(data.contactEmail)) validationError = 'Invalid contact email format.';
                if (!data.orgProofOfLifeExempt && data.orgProofOfLifeLink && !isValidUrl(data.orgProofOfLifeLink)) validationError = 'Invalid Proof-of-Life URL. Must start with http:// or https://';
            }
            else if (submission.applicationType === 'Consortium') {
                if (!isValidEmail(data.consortiumContactEmail)) validationError = 'Invalid contact email format.';
                if (!data.consortiumProofOfLifeExempt && data.consortiumProofOfLifeLink && !isValidUrl(data.consortiumProofOfLifeLink)) validationError = 'Invalid Proof-of-Life URL. Must start with http:// or https://';
                
                if (data.consortiumMembers && Array.isArray(data.consortiumMembers)) {
                    for (const member of data.consortiumMembers) {
                        if (!isValidUrl(member.socialProfile)) {
                            validationError = `Invalid social profile URL for member ${member.name || ''}. Must start with http:// or https://`;
                            break;
                        }
                    }
                }
            }

            if (validationError) {
                return sendJson(res, 400, { error: validationError });
            }
            // --- END SERVER-SIDE VALIDATION ---

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

    // API: DELETE SUBMISSION
    if (reqPath === '/api/delete' && req.method === 'POST') {
        const now = Date.now();
        // 1. Check Start time and Deadline
        if (now < REGISTRATION_START) {
            return sendJson(res, 403, { error: 'Deletion is not allowed before registration starts.' });
        }
        if (now > REGISTRATION_DEADLINE) {
        return sendJson(res, 403, { error: 'Registration is closed. Deletion is not allowed.' });
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
        try {
            const { entryId, editToken } = JSON.parse(body);
            if (!entryId || !editToken) {
            return sendJson(res, 400, { error: 'Entry ID and Token are required.' });
            }

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
                    // Valid token, proceed with deletion
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                        console.error('Failed to delete file:', unlinkErr);
        
                        return sendJson(res, 500, { error: 'Failed to delete submission file.' });
                        }
                        return sendJson(res, 200, { status: 'ok', message: 'Submission deleted' });
                    });
                    return; // Exit loop after starting delete
                    } else {
                    return sendJson(res, 403, { error: 'Invalid edit token' });
                    }
                }
                } catch (readErr) {
                console.error('Error reading submission file:', readErr);
                }
            }
            if (!fileFound) return sendJson(res, 404, { error: 'Submission not found' });
            });

        } catch (err) {
            sendJson(res, 400, { error: 'Invalid JSON payload' });
        }
        });
        return;
    }


    // API: LOOKUP BY TOKEN
    if (reqPath === '/api/lookup' && req.method === 'POST') {
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
    if (reqPath === '/api/applications' && req.method === 'GET') {
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
    if (reqPath.startsWith('/api/applications/') && req.method === 'GET') {
        const urlParts = reqPath.split('?')[0].split('/');
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
                // On the *detail* page, we DO show the PoL link AND email.
                // No fields are deleted here.
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
    
    // PATH TRAVERSAL PROTECTION
    // Normalize the path to resolve '..' and '.' 
    // And ensure the request is actually decoding to a valid string
    if (reqPath.endsWith('/')) reqPath = reqPath.slice(0, -1);
    
    let subPath = null;
    let filePath;
    
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

    // Security Check: Ensure filePath is still inside ROOT (Traversal Check)
    if (filePath && !filePath.startsWith(ROOT)) {
        console.warn(`Blocked traversal attempt: ${filePath}`);
        res.writeHead(403);
        return res.end('Forbidden');
    }

    if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Log error but don't expose details to client
            // console.error(`Error reading file ${filePath}:`, err.code);
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

  } catch (mainError) {
      // This catches any synchronous error inside the request loop
      console.error("CRITICAL REQUEST ERROR:", mainError);
      try {
          res.writeHead(500);
          res.end("Server Error");
      } catch (e) {
          // Connection probably closed already
      }
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
