# CC Snap Election Candidate Portal

This repository contains the source code for a lightweight, standalone
candidate registration and display portal designed for the **Cardano
Constitutional Committee (CC) Snap Election**.

The portal uses **Node.js** and **Express** to serve static pages and a
local REST API for collecting candidate submissions.

------------------------------------------------------------------------

## 🚀 Quick Start

### 1. Prerequisites

You must have **Node.js** installed.

### 2. Install Dependencies

Run in the project directory:

    npm install

### 3. Start the Server

    node server.js

The server runs on **http://localhost:3000**.

### 4. Access the Portal

All pages run under the `/ccsnap` base path:

**http://localhost:3000/ccsnap**

------------------------------------------------------------------------

## 🛠️ Project Structure

  -----------------------------------------------------------------------
  File                   Description
  ---------------------- ------------------------------------------------
  `server.js`            Express server, routing, and API endpoints
                         (`/api/submit`, `/api/applications`).

  `app.js`               Frontend logic: validation, multi‑step UI, API
                         communication, edit-token handling.

  `styles.css`           All styling for the portal.

  `index.html`           Overview / guide page.

  `register.html`        Multi-step registration form.

  `candidates.html`      Public list of registered candidates.

  `candidate.html`       Individual candidate detail page.
  -----------------------------------------------------------------------

### Data Storage

Submissions are stored as individual JSON files in:

    /submissions

⚠️ **This folder contains private data and must never be made public.**

It is already included in `.gitignore`.

------------------------------------------------------------------------

## 📝 Guide for Candidates & Editors

### Submitting a New Application

1.  Visit **/ccsnap/register**
2.  Choose **Individual**, **Organisation**, or **Consortium**
3.  Complete the multi-step form
4.  After submitting you will receive:
    -   **Secret Token** (required for editing)
    -   **Entry ID**

⚠️ **Candidates must save their Secret Token** --- it is the only key
for editing later.

### Editing an Existing Application

1.  Go to **/ccsnap/register**
2.  Click **"Have an edit token?"**
3.  Enter the Secret Token
4.  The form loads with saved data and becomes editable
5.  Submit changes

------------------------------------------------------------------------

## 🔧 Customization Notes

### Adjusting the Base Path

Everything runs under:

    /ccsnap

If you change this, update: - All URLs inside HTML files - All Express
routes in `server.js`

### Adjusting Election Timing (Start & Deadline)

Two constants control when registration opens and closes:

    REGISTRATION_START   = new Date('YYYY-MM-DDTHH:MM:SSZ').getTime();
    REGISTRATION_DEADLINE = new Date('YYYY-MM-DDTHH:MM:SSZ').getTime();

These must be updated **in both `server.js` and `app.js`**.

After modifying them, **restart the server**.

------------------------------------------------------------------------

## ✔️ Summary

This portal is a self-contained, secure, Node‑based tool for collecting
and displaying CC Snap Election candidates. Adjust the dates, host it
anywhere running Node.js, and keep the `/submissions` folder private.
