import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key
  const apiKey = req.headers['x-api-key'] || req.body?.apiKey;
  if (apiKey !== process.env.APP_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized - invalid API key' });
  }

  try {
    const { image, mediaType = 'image/png' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this screenshot and extract event details. Look for:
- Event title/name
- Date (convert relative dates like "tomorrow" or "next Friday" to actual dates based on today being ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
- Time (start time, and end time if available)
- Location/venue (if mentioned)
- Any additional relevant details

Respond with ONLY valid JSON in this exact format:
{
  "title": "Event Title",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM or null if not specified",
  "location": "Location or null if not specified",
  "description": "Any additional details extracted from the screenshot",
  "confidence": "high/medium/low based on how clear the event details were"
}

If you cannot identify an event in the image, respond with:
{
  "error": "Could not identify event details",
  "rawText": "Any text you could extract from the image"
}`,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent) {
      return res.status(500).json({ error: 'No response from Claude' });
    }

    // Parse the JSON response
    let eventData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        eventData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      return res.status(500).json({
        error: 'Failed to parse event data',
        rawResponse: textContent.text,
      });
    }

    return res.status(200).json(eventData);
  } catch (error) {
    console.error('Error parsing screenshot:', error);
    return res.status(500).json({
      error: 'Failed to process screenshot',
      details: error.message,
    });
  }
}
