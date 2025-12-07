import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Verify API key
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (apiKey !== process.env.APP_SECRET_KEY) {
    return res.status(401).send('Unauthorized');
  }

  if (req.method === 'POST') {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).send('No image provided');
      }

      // Clean up base64 data from iOS Shortcuts
      let base64Image = image;
      
      // Remove data URL prefix if present
      base64Image = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
      
      // Remove any whitespace, newlines, or carriage returns
      base64Image = base64Image.replace(/[\s\r\n]/g, '');
      
      // Log first 50 chars for debugging
      console.log('Image data prefix:', base64Image.substring(0, 50));
      console.log('Image data length:', base64Image.length);
      
      // Detect media type from base64 magic bytes or data URL
      // PNG starts with iVBORw0KGgo, JPEG with /9j/
      let mediaType = 'image/png';
      if (base64Image.startsWith('/9j/') || image.includes('data:image/jpeg')) {
        mediaType = 'image/jpeg';
      } else if (base64Image.startsWith('iVBORw')) {
        mediaType = 'image/png';
      } else if (image.includes('data:image/gif')) {
        mediaType = 'image/gif';
      } else if (image.includes('data:image/webp')) {
        mediaType = 'image/webp';
      }
      
      console.log('Detected media type:', mediaType);

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
                text: `Extract event details from this image. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

If the event spans multiple days (like Dec 6-7), return an ARRAY of events, one for each day.

Return ONLY JSON - either a single object OR an array:
Single: {"title":"Event Name","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM or null","location":"Location or null","description":"Details or null"}
Multiple days: [{"title":"Event Name (Day 1)","date":"2025-12-06","startTime":"10:00","endTime":"17:00","location":"..."},{"title":"Event Name (Day 2)","date":"2025-12-07","startTime":"10:00","endTime":"17:00","location":"..."}]`,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      
      // Try to parse as array first, then as single object
      let parsedData;
      const arrayMatch = textContent?.text.match(/\[[\s\S]*\]/);
      const objectMatch = textContent?.text.match(/\{[\s\S]*\}/);
      
      if (arrayMatch) {
        try {
          parsedData = JSON.parse(arrayMatch[0]);
        } catch (e) {
          // If array parse fails, try object
          if (objectMatch) {
            parsedData = [JSON.parse(objectMatch[0])];
          }
        }
      } else if (objectMatch) {
        parsedData = [JSON.parse(objectMatch[0])];
      }
      
      if (parsedData && parsedData.length > 0) {
        // Encode events as JSON in URL parameter
        const events = Array.isArray(parsedData) ? parsedData : [parsedData];
        
        const params = new URLSearchParams({
          key: apiKey,
          events: JSON.stringify(events),
          prefilled: '1'
        });

        // Use request host for local network testing, production URL otherwise
        const host = req.headers.host || 'screenshot-event-app.vercel.app';
        const protocol = host.includes('localhost') || host.match(/^\d+\.\d+\.\d+\.\d+/) ? 'http' : 'https';
        const baseUrl = host.includes('vercel.app') ? 'https://screenshot-event-app.vercel.app' : `${protocol}://${host}`;
        
        const redirectUrl = `${baseUrl}/confirm.html?${params.toString()}`;
        
        // Return plain text URL (no formatting, headers, or encoding)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(200).end(redirectUrl);
      } else {
        return res.status(400).json({ error: 'Could not parse event details' });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.message || 'Unknown error';
      const statusCode = error.status || 500;
      return res.status(statusCode).json({ 
        error: errorMessage,
        details: error.error?.message || error.cause?.message || null
      });
    }
  }

  return res.status(405).send('Method not allowed');
}
