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
│   ├── calendars.js         # List user's Google Calendars
│   ├── create-event.js      # Create single calendar event
│   ├── create-events.js     # Create multiple calendar events
│   └── auth/
│       ├── google.js        # OAuth initiation
│       └── callback.js      # OAuth callback handler
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

---

## Security Notes

- `APP_SECRET_KEY` authenticates iOS Shortcut requests - keep it secret
- Google OAuth tokens are stored in the browser's localStorage
- Each user signs in with their own Google account
- The app only accesses calendars the user authorizes

---

## License

MIT
