# **📝 CC Snap Election Portal \- Comprehensive Operational Guide**

This guide provides a detailed walkthrough for deploying, configuring, adapting, and managing the entire **CC Snap Election Portal**. It is intended for administrators and developers.

## **1\. Initial Setup and Deployment**

### **1.1 Prerequisites**

* **Node.js:** Version 18+ \[cite: DEPLOYMENT\_GUIDE.md\]  
* **Database:** The server uses SQLite (election.db).  
* **Dependencies:** All dependencies are listed in package.json (primarily express, sqlite3, and Cardano crypto libraries).

### **1.2 Installation & Startup**

1. **Install Dependencies:** Run the following command in the project root:

npm install

2.   
3. **Run Server (Development/Testing):**

node server.js

4.   
5. **Run Server (Production \- Recommended):** Use PM2 to ensure the server runs continuously and restarts automatically.

\# Set production environment variables (see Section 1.3)

export PORT=8080

export RICK\_ROLL\_URL="\[https://your-security-redirect.com\](https://your-security-redirect.com)"

\# Start the server

pm2 start server.js \--name "cc-snap-portal"

6. 

### **1.3 Setting Production Parameters (Environment Variables)**

For maximum security and to follow best practices, critical variables are managed via Environment Variables (ENV) on the server, which **override** values set in config.json \[cite: server.js, DEPLOYMENT\_GUIDE.md\].

| Parameter | Type | Purpose |
| :---- | :---- | :---- |
| PORT | ENV | The port the Node.js HTTP server listens on (e.g., 8080). |
| RATE\_LIMIT\_MAX | ENV | Maximum requests allowed per minute per IP address (default is 100). |
| RICK\_ROLL\_URL | ENV (Mandatory) | The URL to redirect malicious traffic hitting honeypot endpoints \[cite: server.js\]. **Must be changed from the default/placeholder.** |

## **2\. Configuration and Customization (config.json)**

All election parameters, feature toggles, and voting rules are managed through config.json. **Remember to restart the server after any changes to config.json** \[cite: config.json\].

| Parameter | Type | Notes |
| :---- | :---- | :---- |
| electionName | String | The main title displayed on the dashboard (e.g., "CC Snap Election 2025") \[cite: utils.js\]. |
| network | String | Sets the Cardano network for Koios API calls ("mainnet", "preprod", or "preview") \[cite: server.js\]. |
| votingType | String | **Crucial:** Controls voting power calculation ("ada" or "drep") \[cite: utils.js\]. |
| minVotingPower | Integer (Lovelace) | The minimum power required to cast a vote \[cite: utils.js\]. |
| minVotes/maxVotes | Integer | The range of candidates a voter must/can select for a valid ballot \[cite: utils.js\]. |
| snapshotEpoch | Integer (Optional) | If set, Koios will query voting power for the balance recorded at the end of this epoch. |
| Time parameters | Integer (ms) | registrationStart, registrationDeadline, votingStart, votingEnd control the public timeline. |
| Feature flags | Boolean | showRegister, showVote, showResults toggle public page visibility \[cite: server.js, utils.js\]. |

## **3\. Adapting and Managing Forms**

The candidate application forms are rendered dynamically on the client-side based on the structure defined in form\_schema.json \[cite: form\_schema.json\].

### **3.1 Modifying Fields and Steps**

To change the fields required for an Individual, Organisation, or Consortium, directly edit form\_schema.json:

1. **Locate the Entity:** Navigate to the main object for the type you wish to edit (e.g., "Individual").  
2. **Find the Step:** Locate the relevant step object within the "steps" array.  
3. **Edit/Add Fields:** Modify the objects in the "fields" array.

{

  "id": "newFieldId",

  "label": "New Required Field",

  "type": "text" | "email" | "url" | "textarea" | "checkbox", 

  "required": true, // Set validation

  "maxLength": 500, // For textarea only

  "helper": "Helpful hint for the user."

}

4. 

### **3.2 Managing Conditional Logic (PoL Exemption)**

The system uses a specific field ID ("previousApplicant") in the first step of each form to trigger the skipping of the Proof-of-Life (PoL) video step (Step 2\) \[cite: form\_schema.json, forms\_utils.js\].

* If a user checks "previousApplicant", the mandatory validation for the PoL URL field is disabled, and the form submission logic automatically clears the value of the PoL URL before saving \[cite: forms\_individual.js, forms\_org.js, forms\_consortium.js\].

### **3.3 Customizing Consortium Member Fields**

The **Consortium** form contains a special step ("Step 4: Consortium Members") with "type": "custom\_members\_list". The fields within this member card are currently hardcoded in forms\_consortium.js \[cite: forms\_consortium.js\]. To change the fields for individual consortium members, you must edit the renderMemberCard function in forms\_consortium.js.

## **4\. Data Management and Auditing**

The following tools are essential for data integrity, audit, and election management.

### **4.1 Database Management (manage\_data.js)**

Use the manage\_data.js utility via the command line to perform administrative tasks on the election.db file:

| Command | Purpose |
| :---- | :---- |
| node manage\_data.js delete\_candidate \[ENTRY\_ID\] | Removes a specific candidate using their public entry ID. |
| node manage\_data.js delete\_vote \[SIGNER\_ADDRESS\] | Removes a specific vote using the voter's full stake address. |
| node manage\_data.js reset\_votes | **Clears ALL votes**, preserving candidate data. |
| node manage\_data.js reset\_all | **Clears ALL votes AND ALL candidate submissions.** Use with extreme caution. |

### **4.2 Generating Audit Exports (export\_data.js)**

The export\_data.js script creates non-sensitive, audit-ready data exports in the ./exports folder \[cite: export\_data.js, DEPLOYMENT\_GUIDE.md\].

node export\_data.js

The generated files (export\_candidates.json and export\_votes.json) contain the cryptographic payloads necessary for independent verification.

### **4.3 On-Chain Audit Feature**

The **Results** page (/ccsnap/results) features an **Independent Audit** button. When clicked, the client-side JavaScript (audit.js) uses the secure server proxy (/api/proxy/koios) to:

1. Fetch the entire vote ledger from the database.  
2. Query the configured Cardano network via Koios for the real, current (or historical, if snapshotEpoch is set) voting power of every unique signer address \[cite: audit.js\].  
3. Compare the claimed power in the stored vote payload against the live ledger data.  
4. Calculate and display the verified tally (stacked power) and flag any ledger mismatches \[cite: audit.js\].

