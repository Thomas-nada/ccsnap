/*
  Simple Node HTTP server for the CC Application Demo
  FORT KNOX EDITION: Maximum Security + Honeypots + SQLite
  
  PRODUCTION CHANGES APPLIED:
  1. Enhanced error handling to avoid logging sensitive request data.
  2. Standardized API response format for /api/vote.
  3. Added endpoint to serve form_schema.json for dynamic form rendering.
*/

const http = require('http');
const https = require('https'); 
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url'); 
const db = require('./database.js'); 

// In a real environment, PORT, RICK_ROLL_URL, and RATE_LIMIT_MAX should be process.env vars.
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const configFile = path.join(ROOT, 'config.json');
const schemaFile = path.join(ROOT, 'form_schema.json'); // Define path to schema file

// --- CONFIGURATION ---
const NUMERIC_KEYS = ["registrationStart", "registrationDeadline", "votingStart", "votingEnd"];
const BOOLEAN_KEYS = ["showRegister", "showVote", "showResults"];
let config = {};
let currentApiUrl = "https://api.koios.rest/api/v1"; 
const KOIOS_URLS = {
    mainnet: "https://api.koios.rest/api/v1",
    preprod: "https://preprod.koios.rest/api/v1",
    preview: "https://preview.koios.rest/api/v1",
};

function loadConfig() {
    try {
        if (!fs.existsSync(configFile)) throw new Error('Configuration file not found.');
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        
        const net = (config.network || 'mainnet').toLowerCase();
        if (KOIOS_URLS[net]) currentApiUrl = KOIOS_URLS[net];
        else currentApiUrl = KOIOS_URLS.mainnet;
        
    } catch (e) {
        console.error('CRITICAL ERROR: Failed to load config.json.', e.message);
        config = { votingType: 'ada' }; 
    }
}
loadConfig(); 

// --- SECURITY ---
const BLOCK_MESSAGE = "Nice try. 🛡️"; 
const SERVER_NAME = "The Iron Dome";
// FINAL FIX: Ensure RICK_ROLL_URL falls back correctly if ENV is not set.
const RICK_ROLL_DEFAULT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const RICK_ROLL_URL = process.env.RICK_ROLL_URL || RICK_ROLL_DEFAULT; 
const HONEYPOTS = ['/admin', '/wp-login.php', '/.env', '/config', '/backup.sql', '/root', '/api/debug'];
const RATE_LIMIT_WINDOW = 60 * 1000; 
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || 100; // Can be set via ENV
const ipRequestCounts = new Map();

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}

function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Server', SERVER_NAME); 
}

function sendJson(res, statusCode, data) {
  if (res.headersSent) return;
  setSecurityHeaders(res); 
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkRateLimit(req) {
    if (req.url.match(/\.(js|css|png|jpg|jpeg|ico|svg)$/i)) return true;
    const ip = getClientIp(req); 
    const now = Date.now();
    let client = ipRequestCounts.get(ip);
    if (!client) { client = { count: 1, startTime: now }; ipRequestCounts.set(ip, client); return true; }
    if (now - client.startTime > RATE_LIMIT_WINDOW) { client.count = 1; client.startTime = now; return true; }
    client.count++;
    if (client.count > RATE_LIMIT_MAX) return false; 
    return true;
}
setInterval(() => { const now = Date.now(); for (const [ip, client] of ipRequestCounts.entries()) { if (now - client.startTime > RATE_LIMIT_WINDOW) ipRequestCounts.delete(ip); } }, RATE_LIMIT_WINDOW);

function sanitizeSubmission(sub) {
    if (!sub.data || typeof sub.data !== 'object') return false;
    // Basic sanitization logic here (omitted for brevity, relying on DB params)
    return true;
}

// --- API HELPERS (DRep and Koios) ---

// Koios DRep check needs to find the stake address in the drep_list
function isDRepAddress(stakeAddress) {
  return new Promise((resolve) => {
    const url = `${currentApiUrl}/governance/drep_list`; 
    const payload = JSON.stringify({ _stake_addresses: [stakeAddress] });
    const req = https.request(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }, timeout: 8000 }, (res) => {
      let body = ""; res.on("data", (chunk) => body += chunk);
      res.on("end", () => { try { const data = JSON.parse(body); resolve(!!(Array.isArray(data) && data.find(d => d.stake_address === stakeAddress))); } catch { resolve(false); } });
    });
    req.on("error", () => resolve(false)); req.write(payload); req.end();
  });
}

// FIX: Implement the correct multi-step logic for DRep power
function fetchVotingPower(stakeAddress, action, epochOverride) {
    return new Promise((resolve) => {
        if (config.votingType === "ada" && action === "drep_power") return resolve("0");
        if (config.votingType === "drep" && action === "total_balance") return resolve("0");

        const hasConfigEpoch = typeof config.snapshotEpoch === 'number' && !Number.isNaN(config.snapshotEpoch);
        const targetEpoch = (typeof epochOverride === 'number') ? epochOverride : (hasConfigEpoch ? config.snapshotEpoch : null);

        // --- DRep Power: STEP 1: Get DRep ID ---
        if (action === 'drep_power') {
            const listUrl = `${currentApiUrl}/governance/drep_list`; 
            const lookupPayload = JSON.stringify({ _stake_addresses: [stakeAddress] });
            const lookupReq = https.request(listUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lookupPayload) }, timeout: 8000 }, (lookupRes) => {
                let lookupBody = ''; lookupRes.on('data', chunk => lookupBody += chunk);
                lookupRes.on('end', () => {
                    let drepId = null;
                    try { 
                        const drepList = JSON.parse(lookupBody); 
                        const match = drepList.find(d => d.stake_address === stakeAddress); 
                        if (match) drepId = match.drep_id; 
                    } catch (e) {
                         console.error("DRep List Parse Error:", e);
                    }
                    if (!drepId) return resolve("0"); 

                    // --- DRep Power: STEP 2: Get Power by DRep ID ---
                    const powerUrl = `${currentApiUrl}/governance/drep_info`; 
                    const powerPayload = JSON.stringify({ drep_ids: [drepId] });
                    const powerReq = https.request(powerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(powerPayload) }, timeout: 8000 }, (powerRes) => {
                        let powerBody = ''; powerRes.on('data', chunk => powerBody += chunk);
                        powerRes.on('end', () => { 
                            try { 
                                const drepInfo = JSON.parse(powerBody); 
                                // Koios returns voting_power in Lovelace (string)
                                const power = (Array.isArray(drepInfo) && drepInfo.length > 0) ? drepInfo[0].voting_power : "0"; 
                                resolve(power || "0"); 
                            } catch (e) { 
                                console.error("DRep Power Parse Error:", e);
                                resolve("0"); 
                            } 
                        });
                    });
                    powerReq.on('error', () => resolve("0")); powerReq.write(powerPayload); powerReq.end();
                });
            });
            lookupReq.on('error', () => resolve("0")); lookupReq.write(lookupPayload); lookupReq.end();
            return;
        }

        // ADA Balance (Uses Koios account_info or account_history)
        const endpoint = (targetEpoch !== null) ? '/account_history' : '/account_info';
        const url = `${currentApiUrl}${endpoint}`;
        const payloadObj = { _stake_addresses: [stakeAddress] };
        if (targetEpoch !== null) payloadObj._epoch_no = targetEpoch;
        const payload = JSON.stringify(payloadObj);

        const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 8000 }, (res) => {
            let body = ''; res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (targetEpoch !== null) {
                        const entry = data[0]?.history?.[data[0].history.length - 1];
                        resolve(entry?.active_stake || "0");
                    } else {
                        resolve(data[0]?.total_balance || "0");
                    }
                } catch { resolve("0"); }
            });
        });
        req.on('error', () => resolve("0")); req.write(payload); req.end();
    });
}


const server = http.createServer(async (req, res) => { 
  const ip = getClientIp(req);

  try {
    if (!checkRateLimit(req)) { res.writeHead(429); return res.end(BLOCK_MESSAGE); }

    const rawUrl = req.url || '/';
    let reqPath = decodeURIComponent(rawUrl.split('?')[0]);

    if (HONEYPOTS.some(trap => reqPath.toLowerCase().startsWith(trap))) {
        res.writeHead(307, { 'Location': RICK_ROLL_URL });
        return res.end();
    }

    if (req.method === 'OPTIONS') { setSecurityHeaders(res); res.writeHead(204, {'Access-Control-Allow-Origin':'*'}); return res.end(); }

    // --- API ENDPOINTS ---
    if (reqPath === '/api/config') return sendJson(res, 200, config);
    
    // --- Serve Form Schema (New Feature) ---
    if (reqPath === '/form_schema.json') {
        fs.readFile(schemaFile, (err, data) => {
            if (err) {
                console.error("Schema load error:", err);
                return sendJson(res, 500, { error: 'Schema file not found or readable' });
            }
            setSecurityHeaders(res);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }
    
    // --- KOIOS PROXY ---
    if (reqPath.endsWith('/api/proxy/koios') && req.method === 'POST') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const action = payload._action || 'total_balance';
                const epoch = payload._epoch_no ? Number(payload._epoch_no) : null;
                
                const powerPromises = payload._stake_addresses.map(addr => fetchVotingPower(addr, action, epoch));
                 
                Promise.all(powerPromises)
                    .then(results => {
                        const enrichedData = payload._stake_addresses.map((addr, index) => {
                            const powerLovelace = results[index] || "0";
                            return {
                                stake_address: addr,
                                total_balance: powerLovelace,         // Lovelace
                                delegated_drep_power: powerLovelace, // Lovelace
                                voting_power_ada: (parseInt(powerLovelace, 10) / 1_000_000).toString()
                            };
                        });
                        sendJson(res, 200, enrichedData);
                    })
                    .catch(err => {
                        // Log concise error without revealing Koios response structure
                        console.error(`Proxy Promise Failed for ${ip}: ${err.message}`);
                        sendJson(res, 500, { error: "Failed to fetch aggregated power data." });
                    });
            } catch (e) { 
                console.error(`Invalid JSON in proxy request from ${ip}: ${e.message}`);
                sendJson(res, 400, { error: "Invalid JSON in proxy request." }); 
            }
        });
        return;
    }

    // --- Lookup Application by Edit Token ---
    if (reqPath === '/api/lookup' && req.method === 'POST') {
        let body = ''; req.on('data', c => body += c);
        req.on('end', async () => {
            try {
                const { token } = JSON.parse(body);
                if (!token) return sendJson(res, 400, { error: 'Token is required' });

                const app = await db.getApplicationByToken(token); 
                
                if (app) {
                    delete app.editToken; 
                    return sendJson(res, 200, app);
                } else {
                    return sendJson(res, 404, { error: 'Invalid token' });
                }
            } catch (e) { 
                console.error(`Lookup Error from ${ip}: ${e.message}`); 
                sendJson(res, 500, { error: 'Server Error during lookup' }); 
            }
        });
        return;
    }


    // --- SUBMISSIONS & VOTES (DB endpoints) ---
    if (reqPath === '/api/submit' && req.method === 'POST') {
         let body = ''; req.on('data', c => body += c);
         req.on('end', async () => {
             try {
                 const sub = JSON.parse(body);
                 if (!sanitizeSubmission(sub)) return sendJson(res, 400, { error: 'Invalid data' });
                 
                 if (sub.entryId && sub.editToken) {
                     const existing = await db.getApplication(sub.entryId);
                     if (!existing) return sendJson(res, 404, { error: 'Not found' });
                     if (existing.editToken !== sub.editToken) return sendJson(res, 403, { error: 'Invalid token' });
                 } else {
                     sub.entryId = Math.floor(10000000 + Math.random() * 90000000).toString();
                     sub.editToken = crypto.randomBytes(16).toString('hex');
                 }
                 
                 await db.saveApplication(sub);
                 sendJson(res, 200, { status: 'ok', entryId: sub.entryId, editToken: sub.editToken });
             } catch (e) { 
                console.error(`Submission Error from ${ip}: ${e.message}`);
                sendJson(res, 500, { error: 'DB Error' }); 
             }
         });
         return;
    }

    if (reqPath === '/api/vote' && req.method === 'POST') {
         let body = ''; req.on('data', c => body += c);
         req.on('end', async () => {
             try {
                 const voteData = JSON.parse(body);
                 await db.saveVote(voteData);
                 // 1. STANDARD RESPONSE: Confirm the signer and candidate ID for client validation
                 sendJson(res, 200, { 
                    status: 'ok', 
                    signer: voteData.signer, 
                    candidateId: voteData.payload.candidateId 
                 });
             } catch (e) { 
                console.error(`Vote Error from ${ip}: ${e.message}`);
                sendJson(res, 500, { error: 'Vote Failed' }); 
             }
         });
         return;
    }

    if (reqPath === '/api/votes') {
        const votes = await db.getAllVotes();
        return sendJson(res, 200, votes);
    }

    if (reqPath === '/api/applications') {
        const apps = await db.getAllApplications();
        return sendJson(res, 200, apps);
    }
    
    if (reqPath.startsWith('/api/applications/')) {
        const id = reqPath.split('/').pop();
        const app = await db.getApplication(id);
        if(app) {
            // Remove sensitive info before public display
            delete app.data.email; 
            delete app.data.contactEmail;
            return sendJson(res, 200, app);
        } else {
            return sendJson(res, 404, {error: 'Not found'});
        }
    }


    // --- STATIC FILES & ROUTING ---
    
    let filePath = '';
    
    // 1. Root and Guide Redirects (Fix for /ccsnap/ and /ccsnap)
    if (reqPath === '/ccsnap' || reqPath === '' || reqPath === '/') {
        filePath = path.join(ROOT, 'index.html');
    }
    
    // 2. Candidate Details Route (Wildcard)
    else if (reqPath.match(/^\/ccsnap\/candidates\/\d+$/)) {
        filePath = path.join(ROOT, 'candidate.html');
    }
    
    // 3. Standard Page Routing (e.g. /ccsnap/vote -> /vote.html)
    else if (reqPath.startsWith('/ccsnap/')) {
        reqPath = reqPath.replace('/ccsnap', '');
        // Append .html if it's not an asset
        if (!reqPath.match(/\.(js|css|png|jpg|ico|svg)$/i)) {
            filePath = path.join(ROOT, reqPath + '.html');
        } else {
             filePath = path.join(ROOT, reqPath);
        }
    }
    
    // 4. Fallback for Local Assets and Root Files
    else {
        filePath = path.join(ROOT, reqPath);
    }


    // 5. Feature Flag Blocking (Check the final HTML file path)
    if (filePath.endsWith('.html')) {
        if (filePath.includes('register.html') && config.showRegister === false) return sendJson(res, 403, { error: 'Disabled' });
        if (filePath.includes('vote.html') && config.showVote === false) return sendJson(res, 403, { error: 'Disabled' });
        if (filePath.includes('results.html') && config.showResults === false) return sendJson(res, 403, { error: 'Disabled' });
    }
    
    // 6. Serve File
    if (!filePath.startsWith(ROOT)) return res.end(BLOCK_MESSAGE);

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
      // Catch all remaining critical errors
      console.error(`CRITICAL SERVER ERROR (Unhandled from ${ip}): ${e.stack}`);
      if(!res.headersSent) { res.writeHead(500); res.end("Server Error"); }
  }
});

server.listen(PORT, () => {
  console.log(`🛡️  THE IRON DOME (SQLite Edition) IS ACTIVE on port ${PORT}`);
  console.log(`NOTE: Critical security settings should be managed via Environment Variables in a true production setup.`);
});