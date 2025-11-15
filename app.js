/* ----------------------------------------------------
   Field Builders
---------------------------------------------------- */

function field(label, name, type="text", help="", required=false) {
  return `
    <label>${label}${required ? " *" : ""}</label>
    <input type="${type}" name="${name}" ${required ? "required" : ""} />
    ${help ? `<small>${help}</small>` : ""}
  `;
}

function textarea(label, name, help="", required=false) {
  return `
    <label>${label}${required ? " *" : ""}</label>
    <textarea name="${name}" rows="4" ${required ? "required" : ""}></textarea>
    ${help ? `<small>${help}</small>` : ""}
  `;
}

function polOptOut(text, name) {
  return `<label class="checkbox-row"><input type="checkbox" name="${name}" /> ${text}</label>`;
}

/* ----------------------------------------------------
   Dynamic Form Builder
---------------------------------------------------- */

function updateForm() {
  const type = document.getElementById("type").value;
  const container = document.getElementById("dynamicFields");
  container.innerHTML = "";

  /* ---------- Individual ---------- */
  if (type === "individual") {
    container.innerHTML = `
      <div class="section">
        ${field("Full Name or Alias", "fullName", "text", "You may use an alias.", true)}
        ${field("Contact Email", "email", "email", "Used for communication.", true)}
        ${field("Geographic Representation (optional)", "geo")}
        ${textarea("Biography", "bio", "Tell us about yourself.", true)}
        ${textarea("Conflict of Interest (optional)", "conflict")}
        ${field("Stake ID (optional)", "stakeId")}
        ${field("DRep ID (optional)", "drepId")}
        ${field("Social / X Profile (optional)", "social")}
        ${field("Proof-of-Life Video Link", "pol", "text", "A video verifying identity.")}
        ${polOptOut("I applied previously and opt out of providing a Proof-of-Life video", "pol_optout")}
        ${textarea("Motivation for Serving", "motivation", "Why do you want to join?", true)}
        ${textarea("Relevant Governance or Constitutional Experience", "experience", "Your background.", true)}
        ${textarea("Communication & Transparency Approach", "communication", "How will you communicate?", true)}
      </div>
    `;
  }

  /* ---------- Company / Organisation ---------- */
  if (type === "company") {
    container.innerHTML = `
      <div class="section">
        ${field("Company / Organisation Name", "orgName", "text", "Legal or recognised name.", true)}
        ${field("Primary Contact Person", "contact", "text", "Main person responsible.", true)}
        ${field("Primary Contact Email", "contactEmail", "email", "Used to reach your organisation.", true)}
        ${textarea("Organization Description", "orgDesc", "Describe mission & purpose.", true)}
        ${textarea("Conflict of Interest (optional)", "conflict")}
        ${field("Proof-of-Life Video Upload (link)", "pol", "text", "Used for legitimacy verification.")}
        ${polOptOut("We applied previously and opt out of providing a Proof-of-Life video", "pol_optout_org")}
        ${textarea("Governance or Blockchain Experience", "govExp", "Relevant expertise.", true)}
        ${textarea("Communication & Transparency Approach", "comm", "How will you communicate?", true)}
        ${textarea("Why the Organization Wishes to Serve", "why", "Explain your motivation.", true)}
      </div>
    `;
  }

  /* ---------- Consortium ---------- */
  if (type === "consortium") {
    container.innerHTML = `
      <div class="section">
        ${field("Consortium Name", "consortiumName", "text", "Official name.", true)}
        ${field("Consortium Contact Person", "consortiumContact", "text", "Representative.", true)}
        ${field("Consortium Contact Email", "consortiumEmail", "email", "Used to communicate.", true)}
        ${textarea("Consortium Mission / Purpose (optional)", "mission")}
        ${textarea("Consortium Values (optional)", "values")}
        <h3>Members</h3>
        <div id="members"></div>
        <button type="button" onclick="addMember()">Add Member</button>
      </div>
    `;
  }
}

/* ----------------------------------------------------
   Add Consortium Member
---------------------------------------------------- */

function addMember() {
  const container = document.getElementById("members");
  const i = container.children.length + 1;

  const block = document.createElement("div");
  block.className = "member-block";

  block.innerHTML = `
    <h4>Member ${i}</h4>

    ${field("Name", `member_${i}_name`, "text", "", true)}
    ${field("Geographical Representation (optional)", `member_${i}_geo`)}
    ${textarea("Biography", `member_${i}_bio`, "", true)}
    ${textarea("Conflict of Interest (optional)", `member_${i}_conflict`)}
    ${field("Stake ID (optional)", `member_${i}_stakeId`)}
    ${field("DRep ID (optional)", `member_${i}_drepId`)}
    ${field("Social / X Profile (optional)", `member_${i}_social`)}
    ${field("Proof-of-Life Video Link", `member_${i}_pol`, "text", "A video verifying identity.")}
    ${polOptOut("Member applied previously and opts out of providing a Proof-of-Life video", `member_${i}_pol_optout`)}
  `;

  container.appendChild(block);
}

/* ----------------------------------------------------
   Submit to Google Sheets
---------------------------------------------------- */

const GOOGLE_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbz-k2SUaIh9szCFOQNtvK0k9i8XuH3Z-KyKqYCjIA2sxsO9fJIv3SjkjHjvHCdtgE5H/exec";

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const type = document.getElementById("type").value;
  const formData = new FormData(e.target);
  let dataObj = {};

  for (const [key, value] of formData.entries()) {
    dataObj[key] = value;
  }

  const payload = {
    type,
    data: dataObj
  };

  try {
    const res = await fetch(GOOGLE_WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });

    const json = await res.json();

    alert("Your application has been submitted successfully!");

    e.target.reset();
    document.getElementById("dynamicFields").innerHTML = "";

  } catch (err) {
    console.error(err);
    alert("There was an error submitting your form.");
  }
});

/* ----------------------------------------------------
   Initialize
---------------------------------------------------- */

document.getElementById("type").addEventListener("change", updateForm);
