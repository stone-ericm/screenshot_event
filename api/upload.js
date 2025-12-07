import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple in-memory storage (for demo - in production use Redis/DB)
const imageStore = new Map();

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify API key
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (apiKey !== process.env.APP_SECRET_KEY) {
    return res.status(401).send('Unauthorized');
  }

  // POST: Upload image and get token
  if (req.method === 'POST') {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).send('No image');
      }

      // Generate a short token
      const token = crypto.randomBytes(8).toString('hex');
      
      // Store image temporarily (expires in 5 minutes)
      imageStore.set(token, {
        image: image,
        expires: Date.now() + 5 * 60 * 1000
      });

      // Clean up expired tokens
      for (const [key, value] of imageStore.entries()) {
        if (value.expires < Date.now()) {
          imageStore.delete(key);
        }
      }

      // Return just the token as plain text
      return res.status(200).send(token);
    } catch (error) {
      return res.status(500).send('Error');
    }
  }

  // GET: Process image by token and redirect
  if (req.method === 'GET') {
    const token = req.query.token;
    if (!token) {
      return res.status(400).send('No token');
    }

    const stored = imageStore.get(token);
    if (!stored || stored.expires < Date.now()) {
      return res.status(404).send('Token expired');
    }

    // Delete token after use
    imageStore.delete(token);

    try {
      const base64Image = stored.image.replace(/^data:image\/\w+;base64,/, '');

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
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `Extract event details from this image. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Return ONLY JSON:
{"title":"Event Name","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM or null","location":"Location or null","description":"Details or null"}`,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const jsonMatch = textContent?.text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const eventData = JSON.parse(jsonMatch[0]);
        
        const params = new URLSearchParams({
          key: apiKey,
          title: eventData.title || '',
          date: eventData.date || '',
          startTime: eventData.startTime || '',
          endTime: eventData.endTime || '',
          location: eventData.location || '',
          description: eventData.description || '',
          prefilled: '1'
        });

        // Redirect to confirmation page
        return res.redirect(302, `/confirm.html?${params.toString()}`);
      } else {
        return res.redirect(302, `/confirm.html?key=${apiKey}&error=parse`);
      }
    } catch (error) {
      console.error('Error:', error);
      return res.redirect(302, `/confirm.html?key=${apiKey}&error=process`);
    }
  }

  return res.status(405).send('Method not allowed');
}
