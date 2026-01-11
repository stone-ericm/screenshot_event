import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// Function to load and wrap Vercel API handlers
async function loadHandler(handlerPath) {
  const handler = await import(handlerPath);
  return handler.default;
}

// Wrapper to convert Vercel handler to Express middleware
function wrapVercelHandler(handlerPath) {
  return async (req, res) => {
    try {
      const handler = await loadHandler(handlerPath);
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  };
}

// API Routes
app.post('/api/quick-add', wrapVercelHandler('./api/quick-add.js'));
app.get('/api/quick-add', wrapVercelHandler('./api/quick-add.js'));

app.post('/api/parse-screenshot', wrapVercelHandler('./api/parse-screenshot.js'));

app.post('/api/upload', wrapVercelHandler('./api/upload.js'));

app.get('/api/calendars', wrapVercelHandler('./api/calendars.js'));

app.post('/api/create-event', wrapVercelHandler('./api/create-event.js'));

app.post('/api/create-events', wrapVercelHandler('./api/create-events.js'));

app.get('/api/confirm-event', wrapVercelHandler('./api/confirm-event.js'));

app.get('/api/auth/google', wrapVercelHandler('./api/auth/google.js'));

app.get('/api/auth/callback', wrapVercelHandler('./api/auth/callback.js'));

app.post('/api/inbound-email', wrapVercelHandler('./api/inbound-email.js'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Screenshot Event Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Tailscale: http://100.123.251.27:${PORT}`);
  console.log(`mDNS: http://pi5.local:${PORT}`);
});