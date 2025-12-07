# Screenshot to Calendar Event

Turn screenshots of events (from social media, email, texts, etc.) into Google Calendar events using Claude's vision AI.

## How It Works

1. **Share a screenshot** from your iPhone via iOS Shortcut
2. **Claude Vision AI** extracts event details (title, date, time, location)
3. **Review & edit** the parsed event in a mobile-friendly web form
4. **Add to Google Calendar** with one tap

## Setup Guide

### Step 1: Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. **Create a new project:**
   - Click the project dropdown at the top
   - Click "New Project"
   - Name it something like "Screenshot Events"
   - Click "Create"

3. **Enable the Calendar API:**
   - In your new project, go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click on it and click "Enable"

4. **Create OAuth credentials:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen:
     - Choose "External" user type
     - Fill in app name (e.g., "Screenshot Events")
     - Add your email as developer contact
     - Skip scopes for now
     - Add your email as a test user
     - Save
   - Back in Credentials, create "OAuth client ID"
   - Application type: "Desktop app" (or "Web application")
   - Name it anything
   - Click "Create"
   - **Save the Client ID and Client Secret** - you'll need these!

### Step 2: Create Your "Events" Calendar

1. Go to [Google Calendar](https://calendar.google.com/)
2. On the left sidebar, click "+" next to "Other calendars"
3. Click "Create new calendar"
4. Name it "Events I'm Interested In" (or whatever you prefer)
5. Click "Create calendar"
6. After creation, click on your new calendar in the sidebar
7. Go to "Settings and sharing"
8. Scroll down to find "Calendar ID" (looks like `abc123@group.calendar.google.com`)
9. **Save this Calendar ID** - you'll need it!

### Step 3: Local Setup

```bash
# Clone/navigate to the project
cd screenshot_event

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
```

Edit `.env` with your credentials:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
DEFAULT_TIMEZONE=America/New_York
```

### Step 4: Get Google Refresh Token

Run the helper script to complete OAuth and get your refresh token:

```bash
node scripts/get-google-token.js
```

This will:
1. Give you a URL to visit
2. You'll sign in and authorize the app
3. Copy the code back to the terminal
4. It will output your `GOOGLE_REFRESH_TOKEN`

Add the refresh token to your `.env` file.

### Step 5: Deploy to Vercel

```bash
# Login to Vercel (if not already)
npx vercel login

# Deploy
npx vercel

# For production
npx vercel --prod
```

After deploying, add your environment variables in Vercel:
1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Settings > Environment Variables
3. Add all variables from your `.env` file:
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
   - `GOOGLE_CALENDAR_ID`
   - `DEFAULT_TIMEZONE`

### Step 6: Create iOS Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Add these actions:

**Action 1: Receive input**
- "Receive **Images** from **Share Sheet**"

**Action 2: Base64 Encode**
- "Base64 Encode **Shortcut Input**"

**Action 3: URL Encode**
- "URL Encode **Base64 Encoded**"

**Action 4: Open URL**
- URL: `https://screenshot-event-app.vercel.app/confirm.html?image=data:image/png;base64,[URL Encoded]`

**Shortcut Settings:**
- Name: "Add Event from Screenshot"
- Show in Share Sheet: ON
- Share Sheet Types: Images

### Usage

1. Take or view a screenshot of an event
2. Tap Share → "Add Event from Screenshot"
3. Review the parsed event details
4. Edit if needed
5. Tap "Add to Calendar"

## Alternative: Direct Web Access

You can also go directly to `https://your-app.vercel.app/confirm.html` and upload a screenshot from the web interface.

## Troubleshooting

### "Google Calendar authentication failed"
- Re-run `node scripts/get-google-token.js` to get a fresh refresh token
- Make sure all Google credentials are correctly set in Vercel

### "Could not identify event details"
- The screenshot may not have clear event information
- Try a screenshot with visible date, time, and event name
- You can still manually fill in the form

### iOS Shortcut not working
- Make sure "Show in Share Sheet" is enabled
- Verify your Vercel URL is correct
- Check that the URL encoding is working (the base64 should be URL-safe)

## Development

Run locally:
```bash
npm run dev
```

This starts the Vercel dev server at `http://localhost:3000`.

## Project Structure

```
screenshot_event/
├── api/
│   ├── parse-screenshot.js   # Claude Vision endpoint
│   └── create-event.js       # Google Calendar endpoint
├── public/
│   └── confirm.html          # Mobile-friendly confirmation page
├── scripts/
│   └── get-google-token.js   # OAuth helper script
├── package.json
├── vercel.json
└── README.md
```

## Security Notes

- Your Google refresh token provides access to your calendar - keep it secret
- The app only has access to the specific calendar you authorized
- Consider adding authentication if deploying publicly

## License

MIT
