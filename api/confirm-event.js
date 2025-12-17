import crypto from "crypto";

// Verify the confirmation token
function verifyToken(token, secret) {
  try {
    const [data, signature] = token.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex");

    if (signature !== expectedSignature) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8"));

    // Check expiration (24 hours)
    if (Date.now() > decoded.exp) {
      return null;
    }

    return decoded.event;
  } catch (e) {
    return null;
  }
}

// Create Google Calendar event
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

  const startDateTime = `${eventData.date}T${eventData.startTime}:00`;
  let endDateTime;

  if (eventData.endTime) {
    endDateTime = `${eventData.date}T${eventData.endTime}:00`;
  } else {
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

export default async function handler(req, res) {
  // Only accept GET requests (from email link clicks)
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).send(renderHTML("Error", "No confirmation token provided.", false));
  }

  const secret = process.env.APP_SECRET_KEY;
  if (!secret) {
    return res.status(500).send(renderHTML("Error", "Server configuration error.", false));
  }

  const eventData = verifyToken(token, secret);

  if (!eventData) {
    return res.status(400).send(renderHTML("Invalid or Expired", "This confirmation link is invalid or has expired (24 hour limit).", false));
  }

  try {
    const createdEvent = await createCalendarEvent(eventData);

    const successMessage = `
      <strong>"${eventData.title}"</strong> has been added to your calendar!
      <br><br>
      📅 ${eventData.date}<br>
      ⏰ ${eventData.startTime}${eventData.endTime ? ` - ${eventData.endTime}` : ""}<br>
      ${eventData.location ? `📍 ${eventData.location}` : ""}
    `;

    return res.status(200).send(renderHTML("Event Created! ✅", successMessage, true, createdEvent.htmlLink));
  } catch (error) {
    console.error("Error creating event:", error);
    return res.status(500).send(renderHTML("Error", `Failed to create event: ${error.message}`, false));
  }
}

function renderHTML(title, message, success, calendarLink = null) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: ${success ? "#10b981" : "#ef4444"};
      margin: 0 0 20px 0;
    }
    p {
      color: #374151;
      line-height: 1.6;
      margin: 0;
    }
    .btn {
      display: inline-block;
      background: #4f46e5;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 20px;
      font-weight: 600;
    }
    .btn:hover {
      background: #4338ca;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "🎉" : "❌"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${calendarLink ? `<a href="${calendarLink}" class="btn">View in Calendar</a>` : ""}
  </div>
</body>
</html>`;
}
