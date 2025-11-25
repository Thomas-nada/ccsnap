const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const args = process.argv.slice(2);
const dbPath = path.join(__dirname, 'election.db');

if (!args.length) {
    console.log("Usage: node manage_data.js [command] [value]");
    console.log("\nCommands:");
    console.log("  reset_votes      -> Deletes all records from the 'votes' table.");
    console.log("  reset_candidates -> Deletes all records from the 'applications' table (Candidate submissions).");
    console.log("  reset_all        -> Deletes all votes AND all candidate applications.");
    console.log("  delete_candidate [ID] -> Deletes a single candidate by Entry ID (e.g., 76947714).");
    console.log("  delete_vote [Signer]  -> Deletes a single vote by Signer Stake Address.");
    process.exit(0);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Could not connect to database:", err.message);
        process.exit(1);
    }
});

const command = args[0].toLowerCase();
const value = args[1]; // Value for targeted commands

// Helper for simple DELETE operations (for reset commands)
function runSimpleCommand(sql, successMsg) {
    db.run(sql, function(err) {
        db.close();
        if (err) {
            console.error("❌ SQL Error:", err.message);
            process.exit(1);
        }
        console.log(`✅ Success: ${successMsg}`);
    });
}

// Helper for targeted DELETE operations
function runTargetedCommand(sql, params, type) {
    db.run(sql, params, function(err) {
        db.close();
        if (err) {
            console.error("❌ SQL Error:", err.message);
            process.exit(1);
        }
        if (this.changes > 0) {
            console.log(`✅ Success: Deleted 1 ${type} entry matching '${params[0]}'.`);
        } else {
            console.warn(`⚠️  Warning: No ${type} entry found matching '${params[0]}'.`);
        }
    });
}

switch (command) {
    case 'reset_votes':
        runSimpleCommand("DELETE FROM votes", "All votes have been cleared.");
        break;
    
    case 'reset_candidates':
        runSimpleCommand("DELETE FROM applications", "All candidate applications have been cleared.");
        break;

    case 'delete_candidate':
        if (!value) { console.error("❌ Error: Entry ID is required for delete_candidate."); db.close(); process.exit(1); }
        runTargetedCommand("DELETE FROM applications WHERE entryId = ?", [value], "candidate");
        break;

    case 'delete_vote':
        if (!value) { console.error("❌ Error: Signer address is required for delete_vote."); db.close(); process.exit(1); }
        runTargetedCommand("DELETE FROM votes WHERE signer = ?", [value], "vote");
        break;

    case 'reset_all':
        db.serialize(() => {
            db.run("DELETE FROM votes", (err) => {
                if (err) { console.error("❌ Error clearing votes:", err.message); db.close(); return; }
                console.log("✅ Votes cleared.");
            });
            db.run("DELETE FROM applications", (err) => {
                if (err) { console.error("❌ Error clearing applications:", err.message); db.close(); return; }
                console.log("✅ Applications cleared.");
                db.close();
            });
        });
        break;

    default:
        console.error(`❌ Unknown command: ${command}`);
        db.close();
}