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
const votesDir = path.join(ROOT, 'votes');
const votesFile = path.join(votesDir, 'votes.json'); 
const configFile = path.join(ROOT, 'config.json');

// --- CONFIGURATION STATE & PERSISTENCE ---

// Define the required keys and default types for validation
const CONFIG_KEYS = [
    "registrationStart", "registrationDeadline", 
    "votingStart", "votingEnd", 
    "auditStart", "snapshotEpoch"
];

let config = {};

// Function to load config from file (relies on file existing or being manually created)
function loadConfig() {
    try {
        if (!fs.existsSync(configFile)) {
             throw new Error('Configuration file not found.');
        }
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        
        // Basic sanity check to ensure all required keys are present and are numbers
        const isValid = CONFIG_KEYS.every(key => typeof config[key] === 'number');

        if (!isValid) {
            throw new Error('Config file is corrupted or missing required keys/number types.');
        }
        
        console.log('Configuration loaded from file.');
        
    } catch (e) {
        console.error('CRITICAL ERROR: Failed to load config.json. The server may not function correctly. Ensure the file exists and is valid JSON.', e);
        // Set an empty object or exit gracefully in production. For now, keep an empty object to allow server boot.
        config = {}; 
    }
}

// Function to save config to file
function saveConfig(newConfig) {
    // Validation: Check if all required keys exist and are numbers
    const isValid = CONFIG_KEYS.every(key => typeof newConfig[key] === 'number');

    if (isValid) {
        config = newConfig;
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        return true;
    }
    return false;
}
loadConfig(); // Load configuration on server start

// --- FUN CONFIG ---
const BLOCK_MESSAGE = "Nice try. 🛡️"; 
const SERVER_NAME = "The Iron Dome";
const RICK_ROLL_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

// --- TRAP CONFIG --
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

// Ensure directories exist
try { if (!fs.existsSync(submissionsDir)) fs.mkdirSync(submissionsDir, { recursive: true }); } catch (e) {}
try { if (!fs.existsSync(votesDir)) fs.mkdirSync(votesDir, { recursive: true }); } catch (e) {}

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

// --- GLOBAL SAFETY NET ---
process.on('uncaughtException', (err) => {
  console.error('PREVENTED CRASH (Uncaught Exception):', err.message);
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

// --- SECURITY HELPER: STRICT HEADERS ---
function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    // Proxy allows self connection, so basic CSP is fine
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';");
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', SERVER_NAME); 
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

// --- RATE LIMITER ---
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


// --- INPUT SANITIZER ---
function sanitizeSubmission(sub) {
    const MAX_TEXT = 2000; 
    const MAX_LONG_TEXT = 5000; 
    if (!sub.data) return false;
    if (typeof sub.data !== 'object' || Array.isArray(sub.data)) return false;

    for (const key in sub.data) {
        const val = sub.data[key];
        if (key === 'consortiumMembers') {
             if (!Array.isArray(val)) sub.data[key] = []; 
        } else if (typeof val === 'object' && val !== null) {
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
    // FIXED: Date.Date() → Date.now()
    const now = Date.now();
    if (now < config.registrationStart) return sendJson(res, 403, { error: 'Not started' });
    if (now > config.registrationDeadline) return sendJson(res, 403, { error: 'Closed' });

    const { entryId, editToken } = submission;

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
                        return sendJson(res, 403, { error: 'Invalid edit token' });
                    }
                }
            } catch (e) {}
        }
        if (!fileFound) return sendJson(res, 404, { error: 'Not found' });
    });
}

// Detect whether a stake address belongs to a registered DRep
function isDRepAddress(stakeAddress) {
  return new Promise((resolve) => {
    const url = `https://api.koios.rest/api/v1/governance/drep_list`;
    const payload = JSON.stringify({ _stake_addresses: [stakeAddress] });

    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          const isDRep = Array.isArray(data) && data.find(d => d.stake_address === stakeAddress);
          resolve(!!isDRep);
        } catch {
          resolve(false);
        }
      });
    });

    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

// --- UTILITY FUNCTION FOR FETCHING POWER ---
// epochOverride: optional number; if not provided, use config.snapshotEpoch; if none, fallback to live
function fetchVotingPower(stakeAddress, action, epochOverride) {
    return new Promise((resolve) => {
		
		        // --- votingType enforcement ---
        if (config.votingType === "ada" && action === "drep_power") {
            return resolve("0"); // block DRep power in ADA-only elections
        }
        if (config.votingType === "drep" && action === "total_balance") {
            return resolve("0"); // block ADA power in DRep-only elections
        }

        const hasConfigEpoch = typeof config.snapshotEpoch === 'number' && !Number.isNaN(config.snapshotEpoch);
        const parsedOverride = (typeof epochOverride === 'number' || typeof epochOverride === 'string')
            ? Number(epochOverride)
            : null;
        const targetEpoch = Number.isFinite(parsedOverride)
            ? parsedOverride
            : (hasConfigEpoch ? config.snapshotEpoch : null);

        // --- DRep voting power (live for now, no epoch filtering) ---
        if (action === 'drep_power') {
            const listUrl = `https://api.koios.rest/api/v1/governance/drep_list`;
            const lookupPayload = JSON.stringify({ _stake_addresses: [stakeAddress] });

            const lookupReq = https.request(listUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    // FIXED: Buffer.byteByte → Buffer.byteLength
                    'Content-Length': Buffer.byteLength(lookupPayload) 
                },
                timeout: 8000
            }, (lookupRes) => {
                let lookupBody = '';
                lookupRes.on('data', chunk => lookupBody += chunk);
                lookupRes.on('end', () => {
                    if (lookupRes.statusCode !== 200) {
                        console.error(`DRep List Lookup Failed (Status ${lookupRes.statusCode}):`, lookupBody.substring(0, 80));
                        return resolve("0");
                    }
                    let drepId = null;
                    let delegatedPower = "0";
                    try {
                        const drepList = JSON.parse(lookupBody);
                        const match = drepList.find(d => d.stake_address === stakeAddress);
                        if (match) {
                            drepId = match.drep_id;
                            delegatedPower = extractDRepPower(match);
                        }
                    } catch (e) {
                        console.error("DRep Lookup Parse Error:", e, "Raw Body:", lookupBody.substring(0, 80));
                    }

                    if (!drepId) return resolve("0");

                    // If Koios already provided the delegation total, use it immediately.
                    if (delegatedPower !== "0") return resolve(delegatedPower);

                    // Fallback: aggregate delegations for the DRep to derive total voting power
                    fetchDRepDelegatedPower(drepId)
                        .then(resolve)
                        .catch((err) => {
                            console.error("DRep Delegation Aggregation Failed:", err);
                            resolve("0");
                        });
                });
            });

            lookupReq.on('error', (e) => {
                console.error("DRep Lookup Req Error:", e);
                resolve("0");
            });

            lookupReq.write(lookupPayload);
            lookupReq.end();
            return;
        }

        // --- ADA / stake voting power ---
        if (targetEpoch !== null && Number.isFinite(targetEpoch)) {
            // Use account_history snapshot at specific epoch
            const historyUrl = `https://api.koios.rest/api/v1/account_history`;
            const historyPayload = JSON.stringify({
                _stake_addresses: [stakeAddress],
                _epoch_no: targetEpoch
            });

            const historyReq = https.request(historyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(historyPayload)
                },
                timeout: 8000
            }, (historyRes) => {
                let body = '';
                historyRes.on('data', chunk => body += chunk);
                historyRes.on('end', () => {
                    if (historyRes.statusCode !== 200) {
                        console.error(`Account History Lookup Failed (Status ${historyRes.statusCode}):`, body.substring(0, 80));
                        return resolve("0");
                    }
                    try {
                        const data = JSON.parse(body);
                        const account = Array.isArray(data) && data.length > 0 ? data[0] : null;
                        const history = account && Array.isArray(account.history) ? account.history : [];
                        // Koios may return 0 or 1 record when filtered by epoch
                        const entry = history.length > 0 ? history[history.length - 1] : null;
                        const activeStake = entry ? (entry.active_stake || "0") : "0";
                        resolve(activeStake);
                    } catch (e) {
                        console.error("Account History Parse Error:", e, "Raw Body:", body.substring(0, 80));
                        resolve("0");
                    }
                });
            });

            historyReq.on('error', (e) => {
                console.error("Account History Req Error:", e);
                resolve("0");
            });

            historyReq.write(historyPayload);
            historyReq.end();
            return;
        }

        // Fallback: live balance from account_info
        const koiosUrl = `https://api.koios.rest/api/v1/account_info`;
        const koiosPayload = JSON.stringify({ _stake_addresses: [stakeAddress] });

        const proxyReq = https.request(koiosUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Content-Length': Buffer.byteLength(koiosPayload) 
            },
            timeout: 8000
        }, (proxyRes) => {
            let responseBody = '';
            proxyRes.on('data', chunk => responseBody += chunk);
            proxyRes.on('end', () => {
                if (proxyRes.statusCode !== 200) {
                    console.error(`ADA Balance Lookup Failed (Status ${proxyRes.statusCode}):`, responseBody.substring(0, 80));
                    return resolve("0");
                }

                try {
                    const koiosData = JSON.parse(responseBody);
                    const accountData = Array.isArray(koiosData) && koiosData.length > 0 ? koiosData[0] : null;
                    const balance = accountData ? (accountData.total_balance || "0") : "0";
                    resolve(balance);
                } catch (e) { 
                    console.error("ADA Balance Processing Error:", e, "Raw Body:", responseBody.substring(0, 80)); 
                    resolve("0"); 
                }
            });
        });

        proxyReq.on('error', (e) => {
            console.error("ADA Balance Lookup Failed:", e);
            resolve("0");
        });

        proxyReq.write(koiosPayload);
        proxyReq.end();
    });
}

// Attempt to pluck a delegation power field off a Koios DRep record
function extractDRepPower(record) {
    const powerKeys = [
        'total_voting_power',
        'voting_power',
        'active_voting_power',
        'active_vote_power'
    ];

    for (const key of powerKeys) {
        if (record && record[key] !== undefined && record[key] !== null) {
            const num = Number(record[key]);
            if (!Number.isNaN(num) && num >= 0) return num.toString();
        }
    }
    return "0";
}

// Sum the delegation amounts for a DRep using Koios delegator listing
function fetchDRepDelegatedPower(drepId) {
    return new Promise((resolve) => {
        const powerUrl = `https://api.koios.rest/api/v1/governance/drep_delegators`;
        const powerPayload = JSON.stringify({ drep_ids: [drepId] });

        const powerReq = https.request(powerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(powerPayload)
            },
            timeout: 8000
        }, (powerRes) => {
            let powerBody = '';
            powerRes.on('data', chunk => powerBody += chunk);
            powerRes.on('end', () => {
                if (powerRes.statusCode !== 200) {
                    console.error(`DRep Delegator Lookup Failed (Status ${powerRes.statusCode}):`, powerBody.substring(0, 80));
                    return resolve("0");
                }

                try {
                    const delegators = JSON.parse(powerBody);
                    if (!Array.isArray(delegators) || delegators.length === 0) return resolve("0");

                    const total = delegators.reduce((sum, delegator) => {
                        const powerKeys = ['amount', 'voting_power', 'delegated_amount', 'delegated_voting_power'];
                        for (const key of powerKeys) {
                            const value = Number(delegator[key]);
                            if (!Number.isNaN(value) && value > 0) {
                                return sum + value;
                            }
                        }
                        return sum;
                    }, 0);

                    return resolve(total.toString());
                } catch (e) {
                    console.error("DRep Delegation Parse Error:", e, "Raw Body:", powerBody.substring(0, 80));
                    return resolve("0");
                }
            });
        });

        powerReq.on('error', (e) => {
            console.error("DRep Delegation Req Error:", e);
            resolve("0");
        });

        powerReq.write(powerPayload);
        powerReq.end();
    });
}


// --- MAIN SERVER LOGIC ---
const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';

  try {
    req.on('error', (err) => console.error('Req error:', err.message));
    res.on('error', (err) => console.error('Res error:', err.message));

    if (!checkRateLimit(req)) {
        res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    const rawUrl = req.url || '/';
    let reqPath;
    try {
        reqPath = decodeURIComponent(rawUrl.split('?')[0]);
    } catch (e) {
        res.writeHead(418, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    if (HONEYPOTS.some(trap => reqPath.toLowerCase().startsWith(trap))) {
        console.log(`🍯 HONEYPOT TRIGGERED by ${ip} on ${reqPath}`);
        sendSecurityAlert('Honeypot Triggered', ip, `Trap: ${reqPath}`);
        res.writeHead(307, { 'Location': RICK_ROLL_URL });
        return res.end();
    }

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

// --- CONFIG ENDPOINTS ---
    if (reqPath === '/api/config' && req.method === 'GET') {
        // Send the current configuration to the client (used by utils.js)
        return sendJson(res, 200, config);
    }

    if (reqPath === '/api/config' && req.method === 'POST') {
        // Handle saving configuration from the Admin panel
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const newConfig = JSON.parse(body);
                // Ensure all keys are present and converted to numbers before saving
                const numericConfig = {};
                CONFIG_KEYS.forEach(key => {
                    // Simple check to ensure the key exists before attempting conversion
                    if (newConfig[key] !== undefined) {
                        numericConfig[key] = Number(newConfig[key]);
                    } else {
                        // If a key is missing in the post, use the current value to prevent loss
                        numericConfig[key] = config[key];
                    }
                });

                if (saveConfig(numericConfig)) {
                    // Reload config to ensure in-memory cache is fresh
                    loadConfig(); 
                    return sendJson(res, 200, { status: 'ok', message: 'Configuration saved successfully.' });
                } else {
                    return sendJson(res, 400, { error: 'Invalid configuration payload.' });
                }
            } catch (e) {
                return sendJson(res, 400, { error: 'Invalid JSON payload.' });
            }
        });
        return;
    }
// --- END CONFIG ENDPOINTS ---


// --- API ROUTE PROXY (KOIOS LOOKUP) ---
    if ((reqPath === '/api/proxy/koios' || reqPath === '/ccsnap/api/proxy/koios') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            let clientPayload;
            
            try {
                clientPayload = JSON.parse(body);
                if (!clientPayload._stake_addresses || !Array.isArray(clientPayload._stake_addresses)) {
                    return sendJson(res, 400, { error: "Missing or invalid stake addresses" });
                }
            } catch (e) {
                return sendJson(res, 400, { error: "Invalid JSON payload" });
            }

            // We reuse the fetchVotingPower logic here, but need to handle the response wrapper
            const action = clientPayload._action || 'total_balance';

			// --- votingType enforcement for Koios proxy ---
			if (config.votingType === "ada" && action === "drep_power") {
				return sendJson(res, 403, { error: "DRep voting is disabled for this election." });
			}

			if (config.votingType === "drep" && action === "total_balance") {
				return sendJson(res, 403, { error: "Only DReps may vote in this election." });
			}

            // Optional epoch override from the client; if not given, fetchVotingPower uses config.snapshotEpoch or live
            const epochOverride = (typeof clientPayload._epoch_no === 'number' || typeof clientPayload._epoch_no === 'string')
                ? Number(clientPayload._epoch_no)
                : null;

            if (action === 'drep_power' || action === 'total_balance') {
                 // We need to resolve power for all addresses for the audit function
                 const powerPromises = clientPayload._stake_addresses.map(addr => 
                    fetchVotingPower(addr, action, epochOverride)
                 );
                 
                 Promise.all(powerPromises)
                    .then(results => {
                        const enrichedData = clientPayload._stake_addresses.map((addr, index) => {
                            const powerLovelace = results[index] || "0";
                            const powerAda = (parseInt(powerLovelace, 10) / 1_000_000).toString();
                            
                            return {
                                stake_address: addr,
                                total_balance: powerLovelace,         // Lovelace, for exact on-chain tally
                                delegated_drep_power: powerLovelace, // same numeric basis
                                voting_power_ada: powerAda           // convenience field
                            };
                        });
                        return sendJson(res, 200, enrichedData);
                    })
                    .catch(err => {
                        console.error("Proxy Promise Failed:", err);
                        sendJson(res, 500, { error: "Failed to fetch aggregated power data." });
                    });
            } else {
                sendJson(res, 400, { error: "Unknown Koios action." });
            }
        });
        return;
    }

    if (reqPath === '/api/submit' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
        req.on('end', () => {
            try {
                const submission = JSON.parse(body);
                if (!sanitizeSubmission(submission)) return sendJson(res, 400, { error: 'Invalid data' });
                if (!submission.applicationType || !submission.data) return sendJson(res, 400, { error: 'Invalid format' });

                if (submission.entryId && submission.editToken) {
                    handleEditSubmission(res, submission);
                } else {
                    const editToken = crypto.randomBytes(16).toString('hex');
                    submission.entryId = submission.entryId || Math.floor(10000000 + Math.random() * 90000000).toString();
                    submission.editToken = editToken;
                    fs.writeFileSync(path.join(submissionsDir, `${Date.now()}.json`), JSON.stringify(submission, null, 2));
                    sendJson(res, 200, { status: 'ok', entryId: submission.entryId, editToken });
                }
            } catch (err) { sendJson(res, 400, { error: 'Invalid JSON' }); }
        });
        return; 
    }
    

if (reqPath === '/api/vote' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
        try {
            const voteData = JSON.parse(body);
            if (!voteData.payload || !voteData.signature || !voteData.signer) 
                return sendJson(res, 400, { error: 'Invalid payload' });

            const stakeAddress = voteData.signer;

            // --- votingType enforcement for /api/vote ---
            isDRepAddress(stakeAddress).then(isDRep => {

                if (config.votingType === "ada" && isDRep) {
                    return sendJson(res, 403, { error: "DReps cannot vote in ADA-holder elections." });
                }

                if (config.votingType === "drep" && !isDRep) {
                    return sendJson(res, 403, { error: "Only DReps may vote in this election." });
                }

                // ---- EXISTING VOTE SAVE LOGIC ----
                let allVotes = [];
                if (fs.existsSync(votesFile)) {
                    try { allVotes = JSON.parse(fs.readFileSync(votesFile, 'utf8')); }
                    catch (e) { allVotes = []; }
                }

                const existingIndex = allVotes.findIndex(v => v.signer === voteData.signer);
                let updated = false;

                if (existingIndex !== -1) {
                    allVotes[existingIndex] = voteData;
                    updated = true;
                } else {
                    allVotes.push(voteData);
                }

                fs.writeFileSync(votesFile, JSON.stringify(allVotes, null, 2));
                return sendJson(res, 200, { status: 'ok', updated });

            }).catch(err => {
                console.error("DRep lookup failed:", err);
                return sendJson(res, 500, { error: "Server failed during voter validation" });
            });

        } catch (e) {
            sendJson(res, 400, { error: 'Invalid JSON' });
        }
    });
    return;
}


    if (reqPath === '/api/votes' && req.method === 'GET') {
        if (fs.existsSync(votesFile)) {
            try {
                const votes = JSON.parse(fs.readFileSync(votesFile, 'utf8'));
                sendJson(res, 200, votes);
            } catch (e) { sendJson(res, 500, { error: 'Corrupt file' }); }
        } else {
            sendJson(res, 200, []);
        }
        return;
    }

    if (reqPath === '/api/delete' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; if(body.length > 1000) req.destroy(); }); 
        req.on('end', () => {
            try {
                const { entryId, editToken } = JSON.parse(body);
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

    // STATIC FILE SERVING
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Allow': 'GET, POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(BLOCK_MESSAGE);
    }

    if (reqPath.endsWith('/')) reqPath = reqPath.slice(0, -1);
    let filePath;

    if (reqPath === '/ccsnap') filePath = path.join(ROOT, 'index.html');
    else if (reqPath.startsWith('/ccsnap')) {
        let subPath = reqPath.slice('/ccsnap'.length);
        
        if (subPath === '/register') filePath = path.join(ROOT, 'register.html');
        else if (subPath === '/candidates') filePath = path.join(ROOT, 'candidates.html');
        // The /ccsnap/vote URL is now handled via the wallet-only HTML file
        else if (subPath === '/vote') filePath = path.join(ROOT, 'vote.html');     
        else if (subPath === '/results') filePath = path.join(ROOT, 'results.html'); 
        // /cli-submit route is no longer functional
        else if (subPath === '/cli-submit') { 
             res.writeHead(404);
             return res.end('Feature Removed');
        }
        else if (subPath.startsWith('/candidates/')) filePath = path.join(ROOT, 'candidate.html');
        // 2. JS, CSS, and other assets required by the app
        else if (subPath.startsWith('/js/')) filePath = path.join(ROOT, subPath); 
        else filePath = path.join(ROOT, subPath);
    } else {
         const ext = path.extname(reqPath);
         if (['.css','.js','.html','.png'].includes(ext) || reqPath === '/app.js' || reqPath === '/styles.css') {
            filePath = path.join(ROOT, reqPath.startsWith('/') ? reqPath.slice(1) : reqPath);
         } else if (reqPath === '' || reqPath === '/') {
           filePath = path.join(ROOT, 'index.html');
         }
    }

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
