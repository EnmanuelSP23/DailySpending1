# Daily Spending

Spending tracker backed by Google Sheets, deployed on Netlify.

## Development Environment Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A Google Cloud project with Sheets API enabled
- A Google Cloud service account with access to your spreadsheet

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Google Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a service account and generate a JSON key
3. Base64-encode the credentials file:

   **Windows (PowerShell):**
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\credentials.json")) | Set-Content credentials_b64.txt
   ```

   **macOS/Linux:**
   ```bash
   base64 -i credentials.json > credentials_b64.txt
   ```

4. Set the environment variable:

   ```
   GOOGLE_CREDENTIALS_B64=<base64-encoded-credentials>
   SPREADSHEET_ID=<your-spreadsheet-id>  # optional, auto-creates if omitted
   ```

### 3. Start Development Server

```bash
npm start
```

This runs a local Express server at `http://localhost:8888`.

## Deployment Setup

### Prerequisites

- A [Netlify](https://www.netlify.com/) account
- Netlify CLI logged in (`netlify login`)

### 1. Create a Netlify Site

```bash
netlify init
```

Follow the prompts to link your repo to a new Netlify site.

### 2. Set Environment Variables

In the Netlify dashboard or via CLI:

```bash
netlify env:set GOOGLE_CREDENTIALS_B64 "your-base64-credentials"
netlify env:set SPREADSHEET_ID "your-spreadsheet-id"
```

### 3. Deploy

**Manual deploy:**
```bash
netlify deploy --prod
```

**Automatic deploy:** Push to your connected Git repository. Netlify will auto-build and deploy.

## Project Structure

```
├── public/              # Static frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── netlify/
│   └── functions/
│       ├── records.js   # API endpoint (GET/POST)
│       └── goog.js      # Google Sheets/Drive API wrapper
├── netlify.toml         # Netlify build config
├── server.js            # Local dev server (Express)
└── package.json
```

## API

- `GET /api/records` — Fetch all spending records
- `POST /api/records` — Add a new record (JSON body: `amount`, `date`, `description`)
