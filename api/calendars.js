// Fetch user's calendar list
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get access token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const accessToken = authHeader.substring(7);

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Calendar list error:', error);

      // Check if token expired
      if (response.status === 401) {
        return res.status(401).json({ error: 'token_expired', message: 'Access token expired' });
      }

      return res.status(response.status).json({ error: error.error?.message || 'Failed to fetch calendars' });
    }

    const data = await response.json();

    // Return simplified calendar list
    const calendars = (data.items || [])
      .filter(cal => cal.accessRole === 'owner' || cal.accessRole === 'writer')
      .map(cal => ({
        id: cal.id,
        name: cal.summary,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
      }))
      .sort((a, b) => {
        // Primary first, then alphabetical
        if (a.primary) return -1;
        if (b.primary) return 1;
        return a.name.localeCompare(b.name);
      });

    return res.status(200).json({ calendars });
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return res.status(500).json({ error: 'Failed to fetch calendars' });
  }
}
