import Anthropic from "@anthropic-ai/sdk";
import { simpleParser } from "mailparser";
import crypto from "crypto";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Allowed email senders (loaded from environment)
function getAllowedSenders() {
  return (process.env.ALLOWED_EMAIL_SENDERS || "")
    .toLowerCase()
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

// Verify webhook secret from Cloudflare
function verifyWebhookSecret(req) {
  const secret = req.headers["x-webhook-secret"];
  const expectedSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.warn("CLOUDFLARE_WEBHOOK_SECRET not configured - rejecting request");
    return false;
  }

  return secret === expectedSecret;
}

// Check if sender is in whitelist (defense in depth)
function isAllowedSender(fromAddress) {
  const allowedSenders = getAllowedSenders();
  if (allowedSenders.length === 0) {
    console.warn("No allowed senders configured");
    return false;
  }

  const from = fromAddress.toLowerCase();
  return allowedSenders.some((allowed) => from.includes(allowed));
}

// Generate a signed confirmation token
function generateConfirmationToken(eventData, secret) {
  const payload = {
    event: eventData,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}.${signature}`;
}

// Extract event details from email content (text + images combined)
async function extractEventFromEmail(textContent, images, subject) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build message content with text and all images
  const messageContent = [];

  // Add all images first (up to 5 to avoid token limits)
  const imagesToProcess = images.slice(0, 5);
  for (const img of imagesToProcess) {
    messageContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.base64,
      },
    });
  }

  // Add the text prompt
  const prompt = `Extract event details from this email. Today is ${today}.

EMAIL SUBJECT: ${subject || "(no subject)"}

EMAIL TEXT CONTENT:
${textContent || "(no text content)"}

${images.length > 0 ? `\nThe email also contains ${images.length} image(s) shown above. Please analyze both the text AND the images to find event details.` : ""}

Look for:
- Event title/name
- Date (convert relative dates like "this Saturday" to actual dates)
- Time (start time, and end time if available)
- Location/venue
- Any additional relevant details

If there are MULTIPLE events, extract the most prominent/main one, or the first one listed.

Respond with ONLY valid JSON in this exact format:
{
  "title": "Event Title",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM or null if not specified",
  "location": "Location or null if not specified",
  "description": "Any additional details"
}

If you cannot identify a specific event with date and time, respond with:
{
  "error": "Could not identify event details",
  "reason": "Brief explanation"
}`;

  messageContent.push({ type: "text", text: prompt });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: messageContent }],
  });

  const responseText = response.content.find((block) => block.type === "text");
  if (!responseText) {
    throw new Error("No response from Claude");
  }

  const jsonMatch = responseText.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  return JSON.parse(jsonMatch[0]);
}

// Send confirmation email using Gmail API
async function sendConfirmationEmail(toEmail, eventData, confirmUrl) {
  const { google } = await import("googleapis");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Format the date nicely
  const dateObj = new Date(eventData.date + "T12:00:00");
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">📅 New Event Detected</h1>
    </div>
    <div style="padding: 30px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0;">${escapeHtml(eventData.title)}</h2>

      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 10px 0; color: #374151;">
          <strong>📅 Date:</strong> ${escapeHtml(formattedDate)}
        </p>
        <p style="margin: 0 0 10px 0; color: #374151;">
          <strong>⏰ Time:</strong> ${escapeHtml(eventData.startTime)}${eventData.endTime ? ` - ${escapeHtml(eventData.endTime)}` : ""}
        </p>
        ${eventData.location ? `<p style="margin: 0 0 10px 0; color: #374151;"><strong>📍 Location:</strong> ${escapeHtml(eventData.location)}</p>` : ""}
        ${eventData.description ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">${escapeHtml(eventData.description)}</p>` : ""}
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${escapeHtml(confirmUrl)}" style="display: inline-block; background: #10b981; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          ✅ Add to Calendar
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
        This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  const emailSubject = `Confirm Event: ${eventData.title}`;

  // Create the email
  const messageParts = [
    `To: ${toEmail}`,
    `Subject: ${emailSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    emailHtml,
  ];
  const message = messageParts.join("\n");
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log(`Confirmation email sent to ${toEmail}`);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify webhook secret
  if (!verifyWebhookSecret(req)) {
    console.log("Invalid webhook secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { from, subject, rawEmail } = req.body;

    if (!rawEmail) {
      return res.status(400).json({ error: "No email content provided" });
    }

    // Defense in depth: verify sender again
    if (!isAllowedSender(from)) {
      console.log(`Sender not allowed: ${from}`);
      return res.status(403).json({ error: "Sender not in whitelist" });
    }

    console.log(`Processing email from: ${from}`);
    console.log(`Subject: ${subject}`);

    // Parse the raw email
    const parsed = await simpleParser(rawEmail);

    // Collect all images (attachments + inline/embedded)
    const images = [];

    // Get image attachments
    const allAttachments = parsed.attachments || [];
    for (const att of allAttachments) {
      if (att.contentType?.startsWith("image/")) {
        images.push({
          base64: att.content.toString("base64"),
          mediaType: att.contentType,
          filename: att.filename || "attachment",
        });
      }
    }

    console.log(`Found ${images.length} image(s) in email`);

    // Get text content
    const textContent = parsed.text || parsed.html?.replace(/<[^>]*>/g, "") || "";

    if (!textContent.trim() && images.length === 0) {
      return res.status(400).json({ error: "No content found in email" });
    }

    // Process email with combined text + images
    console.log("Processing email with text + images combined");
    const eventData = await extractEventFromEmail(textContent, images, subject);

    // Check if Claude found an event
    if (eventData.error) {
      console.log(`Could not extract event: ${eventData.error}`);
      return res.status(200).json({
        success: false,
        message: "Could not identify event in email",
        details: eventData,
      });
    }

    // Validate required fields
    if (!eventData.title || !eventData.date || !eventData.startTime) {
      return res.status(200).json({
        success: false,
        message: "Missing required event fields",
        extracted: eventData,
      });
    }

    console.log("Extracted event:", eventData);

    // Generate confirmation token
    const secret = process.env.APP_SECRET_KEY;
    if (!secret) {
      throw new Error("APP_SECRET_KEY not configured");
    }
    const token = generateConfirmationToken(eventData, secret);

    // Build confirmation URL
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://screenshotevent.vercel.app";
    const confirmUrl = `${baseUrl}/api/confirm-event?token=${encodeURIComponent(token)}`;

    // Extract sender's email address
    const senderEmail = from.match(/<([^>]+)>/)?.[1] || from;

    // Send confirmation email
    await sendConfirmationEmail(senderEmail, eventData, confirmUrl);

    return res.status(200).json({
      success: true,
      message: "Confirmation email sent",
      eventData: eventData,
      sentTo: senderEmail,
    });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return res.status(500).json({
      error: "Failed to process email",
      details: error.message,
    });
  }
}
