/**
 * Cloudflare Email Worker for waiter12.com
 * 
 * This worker receives emails at events@waiter12.com and forwards
 * valid emails to your Vercel API for processing.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to Cloudflare Dashboard > waiter12.com > Email > Email Routing
 * 2. Enable Email Routing and add required DNS records
 * 3. Go to Email Workers and create a new worker
 * 4. Paste this code and deploy
 * 5. Create a route: events@waiter12.com -> this worker
 * 6. Set environment variables in worker settings:
 *    - ALLOWED_SENDERS: stone11375@gmail.com,stone.ericm@gmail.com
 *    - WEBHOOK_SECRET: (generate a random string)
 *    - VERCEL_API_URL: https://your-app.vercel.app/api/inbound-email
 */

export default {
  async email(message, env, ctx) {
    const LOG_PREFIX = '[EmailWorker]';
    
    try {
      // ============================================
      // SECURITY CHECK 1: Whitelist check (primary security)
      // ============================================
      const fromAddress = message.from.toLowerCase();
      const allowedSenders = (env.ALLOWED_SENDERS || '')
        .toLowerCase()
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);
      
      if (allowedSenders.length === 0) {
        console.log(`${LOG_PREFIX} ERROR: No allowed senders configured`);
        return;
      }
      
      const isAllowed = allowedSenders.some(allowed => 
        fromAddress.includes(allowed)
      );
      
      if (!isAllowed) {
        console.log(`${LOG_PREFIX} Sender not in whitelist: ${fromAddress}`);
        return; // Silently drop
      }
      
      // ============================================
      // ALL CHECKS PASSED - Process the email
      // ============================================
      console.log(`${LOG_PREFIX} Email accepted from: ${fromAddress}`);
      console.log(`${LOG_PREFIX} Subject: ${message.subject}`);
      
      // Read the raw email content
      const rawEmail = await new Response(message.raw).text();
      
      // Prepare payload for Vercel
      const payload = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        headers: Object.fromEntries(message.headers),
        rawEmail: rawEmail,
        timestamp: new Date().toISOString(),
      };
      
      // Forward to Vercel API
      const vercelUrl = env.VERCEL_API_URL || 'https://screenshot-event.vercel.app/api/inbound-email';
      const webhookSecret = env.WEBHOOK_SECRET || '';
      
      const response = await fetch(vercelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookSecret,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`${LOG_PREFIX} Vercel API error: ${response.status} - ${errorText}`);
        
        // Don't throw - we've accepted the email, just log the error
        // The email will be lost but won't bounce back to sender
      } else {
        const result = await response.json();
        console.log(`${LOG_PREFIX} Vercel API response:`, result);
      }
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error processing email:`, error);
      // Don't throw - silently fail to avoid bouncing emails
    }
  }
};
