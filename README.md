# Screenshot to Calendar Event

Turn screenshots of events (from social media, email, texts, etc.) into Google Calendar events using Claude's vision AI.

## How It Works

1. **Share a screenshot** from your iPhone via iOS Shortcut
2. **Claude Vision AI** extracts event details (title, date, time, location)
3. **Sign in with Google** (first time only) to authorize calendar access
4. **Review & edit** the parsed event in a mobile-friendly web form
5. **Add to any Google Calendar** with one tap

## Quick Start (iOS Shortcut)

### Prerequisites
- Your deployed app URL (e.g., `https://screenshot-event-app.vercel.app`)
- Your `APP_SECRET_KEY` from the `.env` file

### Create the iOS Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Add these actions in order:

**Action 1: Receive Images**
- Add "Receive **Apps and Images** from **Share Sheet**"
- Set "If there's no input: **Ask For Photos**"

**Action 2: Convert to JPEG**
- Add "Convert **Shortcut Input** to **JPEG**"

**Action 3: Base64 Encode**
- Add "Encode **Converted Image** with **base64**"

**Action 4: Get Contents of URL (API Call)**
- Add "Get contents of URL"
- URL: `https://YOUR-APP.vercel.app/api/quick-add`
- Method: **POST**
- Headers:
  - `Content-Type`: `application/json`
  - `X-API-Key`: `YOUR_APP_SECRET_KEY`
- Request Body: **JSON**
  - Add field `image` with value **Base64 Encoded** (the variable from step 3)

**Action 5: Show Web View**
- Add "Show web view at **Contents of URL**"

**Shortcut Settings:**
- Name: "Add Event" (or whatever you prefer)
- Show in Share Sheet: **ON**
- Share Sheet Types: **Images**

### Usage

1. Take or view a screenshot of an event
2. Tap Share → "Add Event"
3. Sign in with Google (first time only)
4. Review the parsed event details
5. Select which calendar to add to
6. Tap "Add to Calendar"

---

## Email-to-Calendar Setup

Forward emails with event details to `events@waiter12.com` and they'll automatically be added to your Google Calendar!

### How It Works

1. Forward an email containing event info to `events@waiter12.com`
2. Cloudflare Email Worker validates the sender (SPF/DKIM + whitelist)
3. Email is parsed and sent to Claude for event extraction
4. Event is automatically created in Google Calendar

### Prerequisites

- Cloudflare account with `waiter12.com` domain
- Vercel deployment with environment variables configured

### Step 1: Configure Environment Variables

Add these to your Vercel environment variables:

```env
# Email Processing
ALLOWED_EMAIL_SENDERS=stone11375@gmail.com,stone.ericm@gmail.com
CLOUDFLARE_WEBHOOK_SECRET=your-secret-here
```

Generate a webhook secret:
```bash
openssl rand -hex 32
```

### Step 2: Enable Cloudflare Email Routing

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select `waiter12.com`
3. Go to **Email** > **Email Routing**
4. Click **Enable Email Routing**
5. Add the required DNS records when prompted (MX, TXT)

### Step 3: Create the Email Worker

1. In Cloudflare Dashboard, go to **Workers & Pages**
2. Click **Create Application** > **Create Worker**
3. Name it `email-event-worker`
4. Replace the code with contents of `cloudflare/email-worker.js`
5. Click **Save and Deploy**

### Step 4: Configure Worker Environment Variables

In your worker settings (Settings > Variables):

| Variable | Value |
|----------|-------|
| `ALLOWED_SENDERS` | `stone11375@gmail.com,stone.ericm@gmail.com` |
| `WEBHOOK_SECRET` | Same as `CLOUDFLARE_WEBHOOK_SECRET` in Vercel |
| `VERCEL_API_URL` | `https://your-app.vercel.app/api/inbound-email` |

### Step 5: Create Email Route

1. Go back to **Email** > **Email Routing**
2. Click **Routing Rules** > **Create Address**
3. Custom address: `events`
4. Action: **Send to a Worker**
5. Destination: Select your `email-event-worker`
6. Save

### Usage

Simply forward any email with event details to `events@waiter12.com`:

- **Text emails**: Event details will be extracted from the email body
- **Image attachments**: Screenshot images will be processed with Claude Vision

**Example forwarded email:**
```
Subject: Holiday Party

Hey! Don't forget about the holiday party:
- Date: December 20, 2024
- Time: 7:00 PM - 11:00 PM
- Location: 123 Main St, New York
```

This will automatically create a calendar event!

### Security Features

- **SPF Verification**: Validates sender's mail server
- **DKIM Verification**: Validates email signature
- **Sender Whitelist**: Only processes emails from allowed addresses
- **Webhook Secret**: Secures the Vercel API endpoint

Non-whitelisted or spoofed emails are silently dropped.

---

## Full Setup Guide

### Step 1: Clone and Install

```bash
git clone https://github.com/your-username/screenshot_event.git
cd screenshot_event
npm install
```

### Step 2: Create Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Anthropic API Key (for Claude Vision)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# App Secret Key (generate a random string for API authentication)
APP_SECRET_KEY=your-random-secret-key-here

# Default timezone for events
DEFAULT_TIMEZONE=America/New_York
```

### Step 3: Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. **Create a new project** or select an existing one

3. **Enable the Google Calendar API:**
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. **Configure OAuth Consent Screen:**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" user type
   - Fill in app name (e.g., "Screenshot Events")
   - Add your email as developer contact
   - Add scope: `https://www.googleapis.com/auth/calendar`
   - Add your email as a test user
   - Save

5. **Create OAuth Credentials:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Web application**
   - Name: anything you want
   - Authorized redirect URIs: 
     - `https://YOUR-APP.vercel.app/api/auth/callback`
     - `http://localhost:3000/api/auth/callback` (for local testing)
   - Click "Create"
   - **Save the Client ID and Client Secret**

### Step 4: Deploy to Vercel

```bash
# Login to Vercel
npx vercel login

# Deploy to production
npx vercel --prod
```

After deploying, add environment variables in Vercel:
1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Settings > Environment Variables
3. Add all variables from your `.env` file

### Step 5: Create the iOS Shortcut

See the [Quick Start](#quick-start-ios-shortcut) section above.

---

## Development

### Run Locally

```bash
npm run dev
```

This starts the Vercel dev server at `http://localhost:3000`.

### Testing Scripts

**Test the confirmation form with sample data:**
```bash
# Single event (opens production URL)
npm run test:form

# Multiple events
npm run test:form:multi

# Use localhost (requires npm run dev)
npm run test:form -- --local
```

**Test uploading an image to the API:**
```bash
# Test with a real screenshot (requires npm run dev)
npm run test:upload -- /path/to/screenshot.jpg
```

**Get your local IP for iPhone testing:**
```bash
npm run ip
```

### Local Network Testing (iPhone → Mac)

To test the iOS Shortcut against your local dev server:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Get your Mac's local IP:**
   ```bash
   npm run ip
   # Example output: 192.168.1.100
   ```

3. **Duplicate your iOS Shortcut** and modify:
   - Change URL from `https://your-app.vercel.app/api/quick-add`
   - To: `http://YOUR_IP:3000/api/quick-add`

4. **Make sure your iPhone is on the same WiFi network as your Mac**

5. **Test!** The API will automatically use your local IP for redirect URLs.

---

## Project Structure

```
screenshot_event/
├── api/
│   ├── quick-add.js         # Main API - receives image, returns confirm URL
│   ├── parse-screenshot.js  # Claude Vision parsing
│   ├── inbound-email.js     # Email webhook handler (from Cloudflare)
│   ├── calendars.js         # List user's Google Calendars
│   ├── create-event.js      # Create single calendar event
│   ├── create-events.js     # Create multiple calendar events
│   └── auth/
│       ├── google.js        # OAuth initiation
│       └── callback.js      # OAuth callback handler
├── cloudflare/
│   └── email-worker.js      # Cloudflare Email Worker script
├── public/
│   └── confirm.html         # Mobile-friendly event confirmation page
├── scripts/
│   ├── get-google-token.js  # OAuth helper (legacy)
│   ├── test-form.js         # Test confirmation form
│   └── test-upload.js       # Test image upload API
├── package.json
├── vercel.json
└── README.md
```

---

## Features

- **Multi-day event support**: If an event spans multiple days (e.g., "Dec 6-7"), it creates separate calendar entries
- **Calendar selection**: Choose which Google Calendar to add events to
- **Auto end time**: If no end time is detected, defaults to 1 hour after start
- **Edit before saving**: Review and modify all event details before adding to calendar
- **Persistent sign-in**: Stay signed in across sessions (tokens stored in browser)
- **Email-to-Calendar**: Forward emails to automatically create calendar events
- **Image attachments**: Email attachments are processed with Claude Vision
- **Secure email processing**: SPF/DKIM verification + sender whitelist

---

## Troubleshooting

### "Session expired. Please sign in again."
This is normal after Google tokens expire. Just tap "Sign in with Google" to re-authenticate.

### iOS Shortcut shows error
- Check that your `APP_SECRET_KEY` in the shortcut matches your `.env` file
- Verify your Vercel deployment URL is correct
- Make sure the API is deployed (check Vercel dashboard)

### "Could not parse event details"
- The screenshot may not have clear event information
- Try a screenshot with visible date, time, and event name
- The form allows manual editing if parsing is incomplete

### Google Sign-in not working
- Check that your OAuth redirect URI is correctly configured in Google Cloud Console
- Make sure the Calendar API is enabled
- Add your email as a test user in OAuth consent screen

### Email forwarding not creating events
- Check Cloudflare Worker logs in the dashboard for errors
- Verify your email is in `ALLOWED_EMAIL_SENDERS` (both Cloudflare and Vercel)
- Make sure the `WEBHOOK_SECRET` matches in both Cloudflare and Vercel
- Check Vercel function logs for the `/api/inbound-email` endpoint
- Ensure DNS records for email routing are properly configured

### Email events not appearing in calendar
- Verify `GOOGLE_REFRESH_TOKEN` is set and valid
- Check that the email contains clear event information (date, time, title)
- Review Vercel logs for Claude parsing errors

---

## Security Notes

- `APP_SECRET_KEY` authenticates iOS Shortcut requests - keep it secret
- Google OAuth tokens are stored in the browser's localStorage
- Each user signs in with their own Google account
- The app only accesses calendars the user authorizes

---

## License

MIT
