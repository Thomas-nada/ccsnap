/*
  database.js
  -----------
  SQLite3 Storage Engine.
  Replaces the file-system JSON storage with a robust relational database.
  Handles atomic writes, locking, and efficient querying.
*/

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create (or open) the database file
const dbPath = path.join(__dirname, 'election.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Could not connect to database:', err.message);
    else console.log('Connected to SQLite database.');
});

// Initialize Tables
db.serialize(() => {
    // Votes Table: Stores one vote per stake address (signer is Primary Key)
    // NOTE: candidateId and candidateName are kept for legacy compatibility but will now store placeholders.
    // The actual vote data (array of candidates) is stored in fullPayload.
    db.run(`CREATE TABLE IF NOT EXISTS votes (
        signer TEXT PRIMARY KEY,
        candidateId TEXT, 
        candidateName TEXT,
        votingPower INTEGER,
        timestamp INTEGER,
        fullPayload TEXT
    )`);

    // Applications Table: Stores candidate registrations
    db.run(`CREATE TABLE IF NOT EXISTS applications (
        entryId TEXT PRIMARY KEY,
        editToken TEXT,
        type TEXT,
        userId TEXT,
        submittedAt INTEGER,
        data TEXT
    )`);
});

// --- Helper: Wrap SQLite callback in Promise ---
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// --- PUBLIC API ---

module.exports = {
    // --- VOTES ---
    saveVote: async (vote) => {
        // Upsert: Insert or Replace if signer already exists
        const sql = `INSERT OR REPLACE INTO votes (signer, candidateId, candidateName, votingPower, timestamp, fullPayload) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
        
        // Use placeholders for single fields. All critical data is in fullPayload.
        const firstCandidateName = vote.payload.votedCandidates[0]?.candidateName || 'Multiple Candidates';
        const firstCandidateId = vote.payload.votedCandidates[0]?.candidateId || 'MULTI';

        // We store the full raw JSON payload just in case we need to audit signatures later
        await run(sql, [
            vote.signer, 
            firstCandidateId, 
            firstCandidateName, 
            vote.payload.votingPower, 
            vote.payload.timestamp, 
            JSON.stringify(vote)
        ]);
    },

    getAllVotes: async () => {
        const rows = await all("SELECT fullPayload FROM votes");
        // Convert back to the JSON format the frontend expects
        return rows.map(row => JSON.parse(row.fullPayload));
    },

    // --- APPLICATIONS ---
    saveApplication: async (app) => {
        // Note: app.data is an object, we stringify it for storage
        const sql = `INSERT OR REPLACE INTO applications (entryId, editToken, type, userId, submittedAt, data) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
        await run(sql, [
            app.entryId, 
            app.editToken, 
            app.applicationType, 
            app.userId, 
            app.submittedAt, 
            JSON.stringify(app.data)
        ]);
    },

    getApplication: async (entryId) => {
        const row = await get("SELECT * FROM applications WHERE entryId = ?", [entryId]);
        if (!row) return null;
        return {
            entryId: row.entryId,
            editToken: row.editToken,
            applicationType: row.type,
            userId: row.userId,
            submittedAt: row.submittedAt,
            data: JSON.parse(row.data)
        };
    },

    getApplicationByToken: async (token) => {
        const row = await get("SELECT * FROM applications WHERE editToken = ?", [token]);
        if (!row) return null;
        return {
            entryId: row.entryId,
            editToken: row.editToken,
            applicationType: row.type,
            userId: row.userId,
            submittedAt: row.submittedAt,
            data: JSON.parse(row.data)
        };
    },

    getAllApplications: async () => {
        const rows = await all("SELECT * FROM applications");
        return rows.map(row => ({
            entryId: row.entryId,
            // Don't return editToken in public list!
            applicationType: row.type,
            userId: row.userId,
            submittedAt: row.submittedAt,
            data: JSON.parse(row.data)
        }));
    },

    deleteApplication: async (entryId, editToken) => {
        const result = await run("DELETE FROM applications WHERE entryId = ? AND editToken = ?", [entryId, editToken]);
        return result.changes > 0; // Returns true if a row was deleted
    }
};