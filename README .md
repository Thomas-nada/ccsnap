# **🛡️ CC Snap Election Portal**

The **CC Snap Election Portal** is a dedicated, secure web application designed to manage transparent, auditable elections for the Cardano Constitutional Committee (CC) Snap Election. It utilizes on-chain Cardano credentials for identity and voting power verification.

It is built on Node.js and SQLite, offering a robust, self-contained solution with comprehensive support for candidate registration, multi-candidate voting, and auditable results.

## **✨ Key Features**

* **CC-Specific Application Flow:** Supports multi-part applications tailored for Individuals, Organisations, and Consortiums.  
  * Features a conditional **Proof-of-Life (PoL)** check based on previous CC election participation.  
  * Candidates receive a secure **Secret Token** to edit their submission.  
* **Flexible Voting Modes:** Configurable via config.json to support voting power based on:  
  * **ADA Balance** (votingType: 'ada').  
  * **DRep Delegated Power** (votingType: 'drep').  
* **Multi-Candidate Voting (Stacked Power):** Voters select between minVotes and maxVotes candidates. Their full verified voting power is applied cumulatively to **each** selection.  
* **Koios Integration & Proxy:** Uses a secure, local proxy (/api/proxy/koios) to fetch real-time voting power and DRep status directly from the Cardano ledger. This proxy handles the complex multi-step lookup logic for DRep power.  
* **Auditable Results:** The results page includes an **Independent Audit** feature that queries the Koios API to verify the claimed power of submitted votes against the live ledger.  
* **Centralized Data Storage:** All applications and votes are stored in a robust SQLite database (election.db), ensuring data integrity.  
* **Feature Flags:** Allows toggling the visibility of the Registration, Voting, and Results pages using showRegister, showVote, and showResults flags in config.json.

## **🔒 Security Measures**

The portal implements several layers of defense, referred to internally as "The Iron Dome", to ensure the integrity and stability of the election process.

### **Application Security**

* **Content Security Policy (CSP):** A restrictive CSP is defined in index.html to mitigate cross-site scripting (XSS) attacks by explicitly limiting external connections and scripts.  
* **Honeypot Endpoints:** Common attack vectors like /admin and /wp-login.php are configured as honeypots, triggering a **307 Redirect** to a designated URL, logging the malicious attempt.  
* **Rate Limiting:** Protects against Denial of Service (DoS) and brute-force attacks by limiting requests to a configurable maximum per minute per IP address (RATE\_LIMIT\_MAX).  
* **Security Headers:** Standard defensive HTTP headers like X-Content-Type-Options, X-Frame-Options, and X-XSS-Protection are enforced on all API responses.  
* **Sensitive Data Removal:** Candidate editTokens and email addresses are automatically removed from public API responses to protect privacy.

### **Operational Security**

* **Environment Variable Configuration:** Critical settings (PORT, RATE\_LIMIT\_MAX, and the **mandatory** RICK\_ROLL\_URL) must be set via Environment Variables (ENV) in production to ensure they override development defaults and are kept secure.  
* **Dedicated Data Export Tool:** The export\_data.js script provides secure, standardized JSON exports of all candidate and vote data, separating the audit process from the live operational database.

---

## **🛠️ Setup and Installation**

### **Prerequisites**

* Node.js (Version 18 or higher)  
* A process manager like PM2 (recommended for production deployment)

### **1\. Install Dependencies**

Install the required Node.js packages listed in package.json.

Bash

npm install

### **2\. Configure the Portal**

Edit the config.json file to define the election parameters, voting rules, and network details.

| Key | Description | Default | Notes |
| :---- | :---- | :---- | :---- |
| votingType | 'ada' or 'drep' | "ada" | Sets the primary voting power calculation method. |
| network | 'mainnet', 'preprod', or 'preview' | "mainnet" | Target Cardano network for Koios API calls. |
| minVotingPower | Minimum Lovelace required to cast a vote. | 1 | Must be an integer (in Lovelace). |
| minVotes | Minimum candidates a voter **must** select. | 1 | Used for stacked voting. |
| maxVotes | Maximum candidates a voter **can** select. | 10 | Used for stacked voting. |
| electionName | Title displayed on the portal. | "CC Snoop Election 2025" | **Customize this title**. |
| showRegister, showVote, showResults | Feature flags to toggle page visibility. | true | Set to false to disable pages. |

### **3\. Start the Server**

For production environments, it is **mandatory** to use Environment Variables (ENV) to override critical settings in config.json for security.

**Recommended Production Start (using ENV):**

Bash

\# Set secure, non-default values for production

export PORT=8080

export RATE\_LIMIT\_MAX=500

export RICK\_ROLL\_URL="https://your-internal-security-redirect.com" \# MANDATORY: Change this honeypot URL\!

\# Use PM2 to manage the process

pm2 start server.js \--name "cc-snap-portal"

**Development Start:**

Bash

node server.js

The server will initialize the SQLite database (election.db) on the first run.

---

## **💻 Management and Audit Tools**

The following scripts are provided for database maintenance and export.

### **1\. Database Management (manage\_data.js)**

Use this script to safely reset or delete specific records from the command line.

| Command | Purpose | Caution |
| :---- | :---- | :---- |
| node manage\_data.js reset\_all | Clears **all** votes and **all** candidate applications. | **Extreme Caution** |
| node manage\_data.js reset\_votes | Clears all submitted votes (retains candidate data). | High Caution |
| node manage\_data.js delete\_candidate \[ID\] | Deletes a single candidate by their entryId. | Safe |

### **2\. Data Export (export\_data.js)**

This tool creates public audit files in JSON format, which should be secured and published for external verification.

Bash

node export\_data.js

This command generates the following files in the ./exports directory:

* export\_candidates.json: Contains all public candidate data.  
* export\_votes.json: Contains all vote records, including the cryptographic payload and verified voting power.

**SECURITY NOTE:** These files contain the complete election data and must be secured immediately after generation. An automated backup policy for the election.db file is also mandatory.

