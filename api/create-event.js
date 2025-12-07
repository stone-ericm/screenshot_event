// Create a single calendar event using user's OAuth token

// HTML response template for iOS web view
function htmlResponse(success, message) {
  const bgColor = success ? '#d1fae5' : '#fee2e2';
  const textColor = success ? '#065f46' : '#991b1b';
  const icon = success ? '✅' : '❌';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Event Created' : 'Error'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 400px;
      width: 100%;
      overflow: hidden;
      text-align: center;
    }
    .status {
      background: ${bgColor};
      color: ${textColor};
      padding: 30px 20px;
    }
    .icon { font-size: 48px; margin-bottom: 10px; }
    .message { font-size: 18px; font-weight: 600; line-height: 1.4; }
    .details { padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status">
      <div class="icon">${icon}</div>
      <div class="message">${message}</div>
    </div>
    <div class="details">
      ${success ? 'The event has been added to your Google Calendar.' : 'Please try again.'}
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const isGet = req.method === 'GET';
  const data = isGet ? req.query : req.body;

  // Get access token - from Authorization header or from query/body
  let accessToken = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
  } else if (data?.accessToken) {
    accessToken = data.accessToken;
  }

  if (!accessToken) {
    if (isGet) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(401).send(htmlResponse(false, 'Not signed in. Please sign in with Google first.'));
    }
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    const { title, date, startTime, endTime, location, description, calendarId } = data;

    if (!title || !date || !startTime) {
      if (isGet) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send(htmlResponse(false, 'Missing required fields: title, date, and start time'));
      }
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const timezone = process.env.DEFAULT_TIMEZONE || 'America/New_York';
    const targetCalendarId = calendarId || 'primary';

    // Build start and end datetime
    const startDateTime = `${date}T${startTime}:00`;
    let endDateTime;

    if (endTime) {
      endDateTime = `${date}T${endTime}:00`;
    } else {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHours = (hours + 1) % 24;
      endDateTime = `${date}T${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }

    const event = {
      summary: title,
      location: location || undefined,
      description: description || undefined,
      start: { dateTime: startDateTime, timeZone: timezone },
      end: { dateTime: endDateTime, timeZone: timezone },
    };

    // Use Google Calendar API directly with access token
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Calendar API error:', error);
      
      if (response.status === 401) {
        if (isGet) {
          res.setHeader('Content-Type', 'text/html');
          return res.status(401).send(htmlResponse(false, 'Session expired. Please sign in again.'));
        }
        return res.status(401).json({ error: 'token_expired' });
      }
      
      throw new Error(error.error?.message || 'Failed to create event');
    }

    const createdEvent = await response.json();

    if (isGet) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(htmlResponse(true, `Event "${title}" created!`));
    }
    
    return res.status(200).json({
      success: true,
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      message: `Event "${title}" created successfully`,
    });
  } catch (error) {
    console.error('Error creating event:', error);

    if (isGet) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(500).send(htmlResponse(false, 'Failed to create event: ' + error.message));
    }

    return res.status(500).json({
      error: 'Failed to create calendar event',
      details: error.message,
    });
  }
}
