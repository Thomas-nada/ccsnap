# CC Snap Election Candidate Portal

This repository contains the source code for a lightweight, standalone
candidate registration and display portal designed for the Cardano
Constitutional Committee (CC) Snap Election.

The application is built using **Node.js** and the **Express**
framework, serving static HTML files and a local REST API for candidate
submissions.

## 🚀 Quick Start

### 1. Prerequisites

You must have **Node.js** installed on your system.

### 2. Installation

``` bash
npm install
```

### 3. Running the Server

``` bash
node server.js
```

### 4. Accessing the Portal

Open in your browser:

    http://localhost:3000/ccsnap

## 🛠️ Project Structure & Data Management

### Application Files

  -----------------------------------------------------------------------
  File                   Description
  ---------------------- ------------------------------------------------
  server.js              Backend Express server with API routes and
                         /ccsnap routing

  app.js                 Frontend logic for forms, validation, API calls

  styles.css             Stylesheet

  index.html             Main guide page

  register.html          Candidate registration form

  candidates.html        Candidate list

  candidate.html         Candidate detail page
  -----------------------------------------------------------------------

### Data Storage & Security

  Directory      Contents                   Security
  -------------- -------------------------- ---------------------
  /submissions   JSON files per applicant   Must remain private

## 📝 Guide for Candidates and Editors

### Submitting a New Application

1.  Visit `/ccsnap/register`
2.  Select applicant type
3.  Complete all steps
4.  Submit
5.  Copy and save your **Secret Token** and **Entry ID**

### Editing an Existing Application

1.  Visit `/ccsnap/register`
2.  Click **"Have an edit token?"**
3.  Enter token
4.  Edit form
5.  Press Update

## 🔗 Customization Notes

### Base Path

App runs under:

    /ccsnap

### Registration Deadline

Update in **both** server.js and app.js:

``` js
const REGISTRATION_DEADLINE = new Date('2025-11-25T12:00:00Z').getTime();
```
