import Anthropic from "@anthropic-ai/sdk";
import { simpleParser } from "mailparser";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    console.warn("CLOUDFLARE_WEBHOOK_SECRET not configured - skipping verification");
    return true;
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

// Extract event details from text using Claude
async function extractEventFromText(text, subject) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract event details from this email. Today is ${today}.

EMAIL SUBJECT: ${subject}

EMAIL BODY:
${text}

Look for:
- Event title/name
- Date (convert relative dates to actual dates)
- Time (start time, and end time if available)
- Location/venue
- Any additional relevant details

Respond with ONLY valid JSON in this exact format:
{
  "title": "Event Title",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM or null if not specified",
  "location": "Location or null if not specified",
  "description": "Any additional details"
}

If you cannot identify an event, respond with:
{
  "error": "Could not identify event details",
  "reason": "Brief explanation"
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent) {
    throw new Error("No response from Claude");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  return JSON.parse(jsonMatch[0]);
}

// Extract event details from image using Claude
async function extractEventFromImage(base64Image, mediaType, subject) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Extract event details from this image. Today is ${today}.
${subject ? `Email subject for context: ${subject}` : ""}

Look for:
- Event title/name
- Date (convert relative dates to actual dates)
- Time (start time, and end time if available)
- Location/venue
- Any additional relevant details

Respond with ONLY valid JSON:
{
  "title": "Event Title",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM or null",
  "location": "Location or null",
  "description": "Details"
}`,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent) {
    throw new Error("No response from Claude");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  return JSON.parse(jsonMatch[0]);
}

// Create Google Calendar event using refresh token
async function createCalendarEvent(eventData) {
  const { google } = await import("googleapis");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const timezone = process.env.DEFAULT_TIMEZONE || "America/New_York";
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  // Build start and end datetime
  const startDateTime = `${eventData.date}T${eventData.startTime}:00`;
  let endDateTime;

  if (eventData.endTime) {
    endDateTime = `${eventData.date}T${eventData.endTime}:00`;
  } else {
    // Default to 1 hour duration
    const [hours, minutes] = eventData.startTime.split(":").map(Number);
    const endHours = (hours + 1) % 24;
    endDateTime = `${eventData.date}T${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  }

  const event = {
    summary: eventData.title,
    location: eventData.location || undefined,
    description: eventData.description || undefined,
    start: { dateTime: startDateTime, timeZone: timezone },
    end: { dateTime: endDateTime, timeZone: timezone },
  };

  const response = await calendar.events.insert({
    calendarId: calendarId,
    resource: event,
  });

  return response.data;
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

    let eventData = null;

    // Check for image attachments first
    const imageAttachments = (parsed.attachments || []).filter((att) =>
      att.contentType?.startsWith("image/")
    );

    if (imageAttachments.length > 0) {
      // Process the first image attachment
      const image = imageAttachments[0];
      const base64Image = image.content.toString("base64");
      const mediaType = image.contentType || "image/png";

      console.log(`Processing image attachment: ${image.filename || "unnamed"}`);
      eventData = await extractEventFromImage(base64Image, mediaType, subject);
    } else {
      // Fall back to text content
      const textContent = parsed.text || parsed.html?.replace(/<[^>]*>/g, "") || "";

      if (!textContent.trim()) {
        return res.status(400).json({ error: "No content found in email" });
      }

      console.log("Processing email text content");
      eventData = await extractEventFromText(textContent, subject);
    }

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

    // Create the calendar event
    const createdEvent = await createCalendarEvent(eventData);

    console.log(`Event created: ${createdEvent.id}`);

    return res.status(200).json({
      success: true,
      message: `Event "${eventData.title}" created`,
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      eventData: eventData,
    });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return res.status(500).json({
      error: "Failed to process email",
      details: error.message,
    });
  }
}
