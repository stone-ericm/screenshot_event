/**
 * Helper script to obtain Google OAuth refresh token
 * Run this locally once to get your refresh token
 */

import { google } from 'googleapis';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file manually if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3333/callback';
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('');
console.log('🔐 Google OAuth Setup');
console.log('====================');
console.log('');
console.log('Opening browser for authorization...');
console.log('If it doesn\'t open automatically, visit:');
console.log('');
console.log(authUrl);
console.log('');

// Create a simple server to catch the OAuth callback
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/callback')) {
    const url = new URL(req.url, 'http://localhost:3333');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error}</h1><p>Please try again.</p>`);
      server.close();
      process.exit(1);
    }

    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('');
        console.log('✅ Success! Here is your refresh token:');
        console.log('');
        console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('');
        
        // List calendars
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const calendarList = await calendar.calendarList.list();
        
        console.log('📅 Your Google Calendars:');
        calendarList.data.items.forEach((cal, index) => {
          console.log(`${index + 1}. ${cal.summary} ${cal.primary ? '(Primary)' : ''}`);
          console.log(`   ID: ${cal.id}`);
        });
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Success!</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>✅ Authorization Successful!</h1>
              <p>You can close this window and go back to the terminal.</p>
              <p>Your refresh token has been displayed in the terminal.</p>
            </body>
          </html>
        `);
        
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
        
      } catch (err) {
        console.error('Error getting tokens:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><p>${err.message}</p>`);
        server.close();
        process.exit(1);
      }
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3333, async () => {
  console.log('Server listening on http://localhost:3333');
  console.log('Waiting for authorization...');
  
  // Try to open browser automatically
  const { exec } = await import('child_process');
  exec(`open "${authUrl}"`);
});
