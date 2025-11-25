const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'election.db');
// Define the output folder
const exportDir = path.join(__dirname, 'exports');

console.log(`📂 Connecting to database at: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error("❌ Database file does not exist! Run the server first.");
    process.exit(1);
}

// Create exports folder if it doesn't exist
if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
    console.log(`✅ Created export directory: ${exportDir}`);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error("❌ Could not open database:", err.message);
        process.exit(1);
    }
    console.log("✅ Connected to election.db");
});

db.serialize(() => {
    // 1. Export Candidates
    db.all("SELECT * FROM applications", [], (err, rows) => {
        if (err) {
            console.error("❌ Error reading applications table:", err.message);
            return;
        }
        
        if (rows.length === 0) {
            console.warn("⚠️  No candidates found in the database.");
        } else {
            const candidates = rows.map(row => {
                try {
                    const parsed = JSON.parse(row.data);
                    // Remove highly sensitive internal IDs/tokens for the public export
                    delete row.editToken; 
                    delete row.userId;

                    return {
                        entryId: row.entryId,
                        submittedAt: new Date(row.submittedAt).toISOString(),
                        type: row.type,
                        ...parsed
                    };
                } catch (e) {
                    console.error(`❌ Error parsing JSON for candidate ${row.entryId}:`, e);
                    return row;
                }
            });

            const filePath = path.join(exportDir, 'export_candidates.json');
            fs.writeFileSync(filePath, JSON.stringify(candidates, null, 2));
            console.log(`📄 Exported ${candidates.length} candidates to 'exports/export_candidates.json'`);
        }
    });

    // 2. Export Votes
    db.all("SELECT fullPayload FROM votes", [], (err, rows) => {
        if (err) {
             console.log("ℹ️  Votes table query failed:", err.message);
             return;
        }
        
        if (rows.length === 0) {
             console.log("ℹ️  No votes found.");
        } else {
            const votes = rows.map(row => {
                try {
                    const fullVote = JSON.parse(row.fullPayload);
                    // Extract data from the new fullPayload structure
                    const payload = fullVote.payload;
                    const votedCandidates = Array.isArray(payload.votedCandidates) ? payload.votedCandidates : 
                                            // Fallback for old single-vote format
                                            (payload.candidateId ? [{ candidateId: payload.candidateId, candidateName: payload.candidateName }] : []);

                    // Return non-sensitive, audit-required data
                    return {
                        signer: fullVote.signer_bech32 || fullVote.signer, // Prefer Bech32 for export
                        votingPower: payload.votingPower,
                        timestamp: new Date(payload.timestamp).toISOString(),
                        votedCandidates: votedCandidates, // Now an array
                        originalPayload: fullVote // Keep the full original payload for deep audit
                    };
                } catch (e) {
                    console.error(`❌ Error parsing JSON for vote record:`, e);
                    return { error: 'Parse Failed' };
                }
            });

            const filePath = path.join(exportDir, 'export_votes.json');
            fs.writeFileSync(filePath, JSON.stringify(votes, null, 2));
            console.log(`🗳️  Exported ${votes.length} votes to 'exports/export_votes.json'`);
        }
    });
});

db.close((err) => {
    if (err) console.error(err.message);
});