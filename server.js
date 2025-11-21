/*
  Simple Node HTTP server for the CC Application Demo
  FORT KNOX EDITION: Maximum Security + Honeypots + Attitude
*/

const http = require('http');
const https = require('https'); 
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url'); 

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const submissionsDir = path.join(ROOT, 'submissions');

// --- CONFIGURATION ---
const REGISTRATION_START = new Date('2025-11-16T21:53:00Z').getTime();
const REGISTRATION_DEADLINE = new Date('2025-11-24T12:00:00Z').getTime();

// --- FUN CONFIG ---
const BLOCK_MESSAGE = "Nice try. 🛡️"; 
const SERVER_NAME = "The Iron Dome";
const RICK_ROLL_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

// --- TRAP CONFIG (The Honeypot) ---
const HONEYPOTS = [
    '/admin', '/wp-login.php', '/.env', '/config', '/backup.sql', 
    '/phpmyadmin', '/console', '/root', '/api/debug'
];

// --- SECURITY CONFIG ---
const RATE_LIMIT_WINDOW = 60 * 1000; 
const RATE_LIMIT_MAX = 100; 
const ipRequestCounts = new Map();

// --- WEBHOOK CONFIGURATION ---
const ALERT_WEBHOOK_URL = ""; 

// --- SECURITY HELPER: INCIDENT REPORTER ---
function sendSecurityAlert(type, ip, details) {
    if (!ALERT_WEBHOOK_URL) return;
    
    const payload = JSON.stringify({
        content: `🚨 **Security Alert: ${type}**`,
        embeds: [{
            title: "Attack Blocked",
            color: 15158332, 
            fields: [
                { name: "Attacker IP", value: ip || "Unknown", inline: true },
                { name: "Time", value: new Date().toISOString(), inline: true },
                { name: "Details", value: `\`\`\`${details.substring(0, 1000)}\`\`\`` }
            ]
        }]
    });
    
    try {
        const url = new URL(ALERT_WEBHOOK_URL);
        const req = https.request({
            hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        });
        req.on('error', (e) => console.error('Webhook failed:', e.message));
        req.write(payload);
        req.end();
    } catch(e) { console.error("Webhook Error", e); }
}

// --- 1. GLOBAL SAFETY NET ---
process.on('uncaughtException', (err) => {
  console.error('PREVENTED CRASH (Uncaught Exception):', err.message);
  sendSecurityAlert('Uncaught Exception', 'Internal', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('PREVENTED CRASH (Unhandled Rejection):', reason);
});

// --- VALIDATION HELPERS ---
function isValidEmail(email) {
  if (!email || typeof email !== 'string' || email.trim() === '') return true; 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

function isValidUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') return true; 
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try { new URL(url); return true; } catch (_) { return false; }
  }
  return false;
}

// Ensure directory exists
try { if (!fs.existsSync(submissionsDir)) fs.mkdirSync(submissionsDir, { recursive: true }); } catch (e) {}


// --- SECURITY HELPER: STRICT HEADERS ---
function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';");
    
    // FUN HEADERS
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', SERVER_NAME); 
    res.setHeader('X-Server-Mood', 'Invincible');
    res.setHeader('X-Traps', 'Deployed');
}

function sendJson(res, statusCode, data) {
  if (res.headersSent) return;
  setSecurityHeaders(res); 
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000', 
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

// --- SECURITY HELPER: RATE LIMITER ---
function checkRateLimit(req) {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let client = ipRequestCounts.get(ip);
    if (!client) {
        client = { count: 1, startTime: now };
        ipRequestCounts.set(ip, client);
        return true;
    }
    if (now - client.startTime > RATE_LIMIT_WINDOW) {
        client.count = 1;
        client.startTime = now;
        return true;
    }
    client.count++;
    if (client.count > RATE_LIMIT_MAX) {
        if (client.count === RATE_LIMIT_MAX + 1) sendSecurityAlert('Rate Limit Exceeded', ip, `User exceeded ${RATE_LIMIT_MAX} reqs/min`);
        return false; 
    }
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, client] of ipRequestCounts.entries()) {
        if (now - client.startTime > RATE_LIMIT_WINDOW) ipRequestCounts.delete(ip);
    }
}, RATE_LIMIT_WINDOW);


// --- SECURITY HELPER: INPUT SANITIZER ---
function sanitizeSubmission(sub) {
    const MAX_TEXT = 2000; 
    const MAX_LONG_TEXT = 5000; 
    if (!sub.data) return false;
    
    // TYPE ARMOR: Ensure 'data' is actually an object
    if (typeof sub.data !== 'object' || Array.isArray(sub.data)) return false;

    for (const key in sub.data) {
        const val = sub.data[key];
        // TYPE ARMOR: If they send an array/object where a string belongs, kill it.
        // We only expect strings, booleans, or specific arrays (members)
        if (key === 'consortiumMembers') {
             if (!Array.isArray(val)) sub.data[key] = []; // Enforce array
        } else if (typeof val === 'object' && val !== null) {
             // If they send { "email": { "foo": "bar" } }, sanitize it to empty string
             sub.data[key] = "";
        } else if (typeof val === 'string') {
            if (key.includes('Motivation') || key.includes('Biography') || key.includes('Experience')) {
                if (val.length > MAX_LONG_TEXT) sub.data[key] = val.substring(0, MAX_LONG_TEXT);
            } else {
                if (val.length > MAX_TEXT) sub.data[key] = val.substring(0, MAX_TEXT);
            }
        }
    }
    return true;
}


function handleEditSubmission(res, submission) {
    const now = Date.now();
    if (now < REGISTRATION_START) return sendJson(res, 403, { error: 'Not started' });
    if (now > REGISTRATION_DEADLINE) return sendJson(res, 403, { error: 'Closed' });

    const { entryId, editToken } = submission;

    // TYPE ARMOR: Ensure entryId and editToken are STRINGS
    if (typeof entryId !== 'string' || typeof editToken !== 'string') {
        return sendJson(res, 400, { error: 'Invalid credential format' });
    }

    fs.readdir(submissionsDir, (err, files) => {
        if (err) return sendJson(res, 500, { error: 'Storage error' });
        let fileFound = false;
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(submissionsDir, file);
            try {
                const storedSub = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (storedSub.entryId === entryId) {
                    fileFound = true;
                    if (storedSub.editToken === editToken) {
                        submission.editToken = storedSub.editToken; 
                        fs.writeFileSync(filePath, JSON.stringify(submission, null, 2));
                        return sendJson(res, 200, { status: 'ok' });
                    } else {
                        sendSecurityAlert('Invalid Edit Token', 'Unknown', `Attempted edit on ${entryId}`);
                        return sendJson(res, 403, { error: 'Invalid edit token' });
                    }
                }
            } catch (e) {}
        }
        if (!fileFound) return sendJson(res, 404, { error: 'Not found' });
    });
}


const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';

  try {
    req.on('error', (err) => console.error('Req error:', err.message));
    res.on('error', (err) => console.error('Res error:', err.message));

    // 2. RATE LIMIT CHECK
    if (!checkRateLimit(req)) {
        res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    // 3. SAFE URL DECODING
    const rawUrl = req.url || '/';
    let reqPath;
    try {
        reqPath = decodeURIComponent(rawUrl.split('?')[0]);
    } catch (e) {
        console.warn('Malformed request URL:', rawUrl);
        sendSecurityAlert('Malformed URL Attack', ip, `Raw URL: ${rawUrl}`);
        res.writeHead(418, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    // --- 8. HONEYPOT TRAP ---
    // If they touch a trap file, redirect them to Rick Roll
    if (HONEYPOTS.some(trap => reqPath.toLowerCase().startsWith(trap))) {
        console.log(`🍯 HONEYPOT TRIGGERED by ${ip} on ${reqPath}`);
        sendSecurityAlert('Honeypot Triggered', ip, `Trap: ${reqPath}`);
        res.writeHead(307, { 'Location': RICK_ROLL_URL });
        return res.end();
    }

    // 4. STRICT METHOD CHECKING
    if (!['GET', 'POST', 'OPTIONS', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { 'Allow': 'GET, POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    if (req.method === 'OPTIONS') {
        setSecurityHeaders(res);
        res.writeHead(204, {
            'Access-Control-Allow-Origin': 'http://localhost:3000', 
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    // 5. API ROUTING
    if (reqPath === '/api/submit' && req.method === 'POST') {
        const now = Date.now();
        if (now < REGISTRATION_START) return sendJson(res, 403, { error: 'Not started' });
        if (now > REGISTRATION_DEADLINE) return sendJson(res, 403, { error: 'Closed' });

        let body = '';
        req.on('data', (chunk) => { 
            body += chunk;
            if (body.length > 1e6) { 
                req.destroy(); 
                sendSecurityAlert('Large Payload Blocked', ip, 'Body size exceeded 1MB');
            }
        });
        req.on('end', () => {
            try {
                const submission = JSON.parse(body);
                if (!sanitizeSubmission(submission)) {
                    // Sanitizer returns false if data structure is invalid/polluted
                    return sendJson(res, 400, { error: 'Invalid data structure' });
                }

                if (!submission || !submission.applicationType || !submission.data) return sendJson(res, 400, { error: 'Invalid format' });

                if (submission.entryId && submission.editToken) {
                    handleEditSubmission(res, submission);
                } else {
                    const editToken = crypto.randomBytes(16).toString('hex');
                    submission.entryId = submission.entryId || Math.floor(10000000 + Math.random() * 90000000).toString();
                    submission.editToken = editToken;
                    fs.writeFileSync(path.join(submissionsDir, `${Date.now()}.json`), JSON.stringify(submission, null, 2));
                    sendJson(res, 200, { status: 'ok', entryId: submission.entryId, editToken });
                }
            } catch (err) {
                sendJson(res, 400, { error: 'Invalid JSON' });
            }
        });
        return; 
    }
    
    // API: DELETE
    if (reqPath === '/api/delete' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; if(body.length > 1000) req.destroy(); }); 
        req.on('end', () => {
            try {
                const { entryId, editToken } = JSON.parse(body);
                // TYPE ARMOR: Check types
                if (typeof entryId !== 'string' || typeof editToken !== 'string') return sendJson(res, 400, { error: 'Invalid credentials' });
                
                 fs.readdir(submissionsDir, (err, files) => {
                    if (err) return sendJson(res, 500, { error: 'Failed' });
                    for (const file of files) {
                        if (!file.endsWith('.json')) continue;
                        try {
                            const fp = path.join(submissionsDir, file);
                            const sub = JSON.parse(fs.readFileSync(fp));
                            if (sub.entryId === entryId && sub.editToken === editToken) {
                                fs.unlinkSync(fp);
                                return sendJson(res, 200, { status: 'ok' });
                            }
                        } catch(e){}
                    }
                    sendJson(res, 404, { error: 'Not found' });
                 });
            } catch (e) { sendJson(res, 400, { error: 'Bad Request' }); }
        });
        return;
    }
    
    // API: LIST
    if (reqPath === '/api/applications' && req.method === 'GET') {
         fs.readdir(submissionsDir, (err, files) => {
            if(err) return sendJson(res, 500, {error: 'Error'});
            const apps = [];
            files.forEach(f => { 
                try {
                    const c = JSON.parse(fs.readFileSync(path.join(submissionsDir, f)));
                    if(c.data) { delete c.data.email; delete c.data.contactEmail; } 
                    apps.push(c);
                } catch(e){} 
            });
            sendJson(res, 200, apps);
         });
         return;
    }

    // API: LOOKUP
    if (reqPath === '/api/lookup' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const token = payload.token;
                
                if (typeof token !== 'string' || !token) return sendJson(res, 400, {error:'Invalid token'});

                fs.readdir(submissionsDir, (err, files) => {
                    for(const f of files) {
                        if(!f.endsWith('.json')) continue;
                        try {
                            const sub = JSON.parse(fs.readFileSync(path.join(submissionsDir, f)));
                            if(sub.editToken === token) return sendJson(res, 200, sub);
                        } catch(e){}
                    }
                    sendJson(res, 404, {error: 'Not found'});
                });
            } catch(e) { sendJson(res, 400, {error: 'Invalid JSON'}); }
        });
        return;
    }

    // API: GET ONE
    if (reqPath.startsWith('/api/applications/') && req.method === 'GET') {
        const parts = reqPath.split('/');
        const id = parts[parts.length - 1];
        fs.readdir(submissionsDir, (err, files) => {
            for(const f of files) {
                if(!f.endsWith('.json')) continue;
                try {
                    const sub = JSON.parse(fs.readFileSync(path.join(submissionsDir, f)));
                    if(sub.entryId === id) return sendJson(res, 200, sub);
                } catch(e){}
            }
            sendJson(res, 404, {error: 'Not found'});
        });
        return;
    }

    // 6. STATIC FILE SERVING
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Allow': 'GET', 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    if (reqPath.endsWith('/')) reqPath = reqPath.slice(0, -1);
    let filePath;

    if (reqPath === '/ccsnap') filePath = path.join(ROOT, 'index.html');
    else if (reqPath.startsWith('/ccsnap')) {
        let subPath = reqPath.slice('/ccsnap'.length);
        if (subPath === '/register') filePath = path.join(ROOT, 'register.html');
        else if (subPath === '/candidates') filePath = path.join(ROOT, 'candidates.html');
        else if (subPath.startsWith('/candidates/')) filePath = path.join(ROOT, 'candidate.html');
        else filePath = path.join(ROOT, subPath);
    } else {
         const ext = path.extname(reqPath);
         if (['.css','.js','.html','.png'].includes(ext) || reqPath === '/app.js' || reqPath === '/styles.css') {
            filePath = path.join(ROOT, reqPath.startsWith('/') ? reqPath.slice(1) : reqPath);
         } else if (reqPath === '' || reqPath === '/') {
           filePath = path.join(ROOT, 'index.html');
         }
    }

    // TRAVERSAL CHECK
    if (filePath && !filePath.startsWith(ROOT)) {
        sendSecurityAlert('Path Traversal Attempt', ip, `Tried to access: ${filePath}`);
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    if (!filePath) {
        res.writeHead(404);
        return res.end('Not Found');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('Not Found');
        }
        setSecurityHeaders(res);
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        if (ext === '.js') contentType = 'application/javascript';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.png') contentType = 'image/png';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });

  } catch (e) {
      console.error("CRITICAL:", e);
      sendSecurityAlert('Sync Request Error', ip, e.message);
      if(!res.headersSent) { res.writeHead(500); res.end("Server Error"); }
  }
});

// --- 7. SLOWLORIS PROTECTION ---
server.headersTimeout = 5000; 
server.requestTimeout = 10000; 
server.keepAliveTimeout = 5000; 

server.listen(PORT, () => {
  console.log(`
  🛡️  THE IRON DOME IS ACTIVE 🛡️
  --------------------------------
  Server running at http://localhost:${PORT}
  Honeypots: Armed
  Attitude: Sassy
  --------------------------------
  `);
});
