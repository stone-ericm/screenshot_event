# Screenshot Event

Turn screenshots of events into Google Calendar entries using Claude's vision AI.

## How it works

There are two ways to get event screenshots into the system:

**iOS Shortcut** -- Share a screenshot from any app on your phone. The shortcut base64-encodes the image, sends it to the `/api/quick-add` endpoint, and opens a confirmation page where you review the parsed details and add the event to your calendar.

**Email forwarding** -- Forward an email containing event details (text or image attachments) to a Cloudflare email worker. The worker validates the sender via SPF/DKIM and a whitelist, then posts the content to the Vercel API. Events are created in Google Calendar automatically using a stored refresh token.

## Architecture

```
iOS Shortcut                      Email
    |                               |
    | POST /api/quick-add           | Cloudflare Email Worker
    | (base64 image)                | (SPF/DKIM + sender whitelist)
    |                               |
    v                               v
Vercel Serverless API ---------------------
    |                                     |
    | /api/parse-screenshot               | /api/inbound-email
    | Claude Vision extracts              | mailparser extracts body
    | title, date, time, location         | and image attachments
    |                                     |
    v                                     v
Claude SDK (vision) ---- event JSON ---- Claude SDK (vision/text)
    |                                     |
    v                                     v
/public/confirm.html                 Auto-create via
(review, edit, pick calendar)        stored Google OAuth token
    |
    v
/api/create-event(s)
Google Calendar API
```

## Tech stack

- **Runtime**: Node.js 18+, ES modules
- **Hosting**: Vercel serverless functions
- **AI**: Anthropic Claude SDK (vision + text parsing)
- **Calendar**: Google Calendar API via `googleapis`
- **Email**: Cloudflare Email Workers, `mailparser`
- **Auth**: Google OAuth 2.0 (tokens stored client-side for shortcut flow, server-side refresh token for email flow)
- **Frontend**: Single static HTML page (`public/confirm.html`)

## Project structure

```
api/
  quick-add.js          Entry point for iOS Shortcut (receives base64 image)
  parse-screenshot.js   Sends image to Claude, returns structured event data
  inbound-email.js      Webhook handler for Cloudflare email worker
  create-event.js       Creates a single Google Calendar event
  create-events.js      Creates multiple events (multi-day support)
  calendars.js          Lists the user's Google Calendars
  upload.js             Direct image upload endpoint
  confirm-event.js      Confirms and finalizes event creation
  auth/
    google.js           Initiates Google OAuth flow
    callback.js         Handles OAuth callback, stores tokens
cloudflare/
  email-worker.js       Cloudflare Worker that receives and forwards emails
public/
  confirm.html          Mobile-friendly review and edit form
scripts/
  test-form.js          Opens confirm page with sample data
  test-upload.js        Sends a test image to the API
  get-google-token.js   Helper to obtain Google refresh token
```

## Setup

### Prerequisites

- Node.js 18+
- Vercel account
- Anthropic API key
- Google Cloud project with Calendar API enabled and OAuth credentials

### Environment variables

```
ANTHROPIC_API_KEY        Anthropic API key for Claude
GOOGLE_CLIENT_ID         Google OAuth client ID
GOOGLE_CLIENT_SECRET     Google OAuth client secret
GOOGLE_REFRESH_TOKEN     Stored refresh token (email flow only)
APP_SECRET_KEY           Shared secret for iOS Shortcut authentication
DEFAULT_TIMEZONE         e.g. America/New_York
ALLOWED_EMAIL_SENDERS    Comma-separated list of allowed sender addresses
CLOUDFLARE_WEBHOOK_SECRET  Shared secret between Cloudflare worker and Vercel
```

### Deploy

```bash
npm install
npx vercel --prod
```

Add the environment variables in Vercel project settings. Set the Google OAuth redirect URI to `https://<your-app>.vercel.app/api/auth/callback`.

### Email routing (optional)

1. Enable Cloudflare Email Routing on your domain.
2. Deploy `cloudflare/email-worker.js` as a Cloudflare Worker.
3. Set `ALLOWED_SENDERS`, `WEBHOOK_SECRET`, and `VERCEL_API_URL` as worker environment variables.
4. Create a routing rule that sends your chosen address to the worker.

### iOS Shortcut

Create a shortcut with these steps:

1. Receive images from Share Sheet
2. Convert to JPEG
3. Base64 encode
4. POST to `https://<your-app>.vercel.app/api/quick-add` with header `X-API-Key: <APP_SECRET_KEY>` and JSON body `{"image": "<base64>"}`
5. Show the response as a web page

### Local development

```bash
npm run dev           # Start Vercel dev server on localhost:3000
npm run test:form     # Open confirm page with sample data
npm run test:upload   # Send a test image to the local API
npm run ip            # Print your local IP for iPhone testing
```

## License

MIT
