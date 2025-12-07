#!/usr/bin/env node
/**
 * Test script to upload an image to the local quick-add API
 * 
 * Usage:
 *   npm run test:upload                    # Uses placeholder data
 *   npm run test:upload -- /path/to/image  # Uses specified image
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Get local IP for network testing
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

async function main() {
  const imagePath = process.argv[2];
  
  // Load environment variables
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  const apiKey = process.env.APP_SECRET_KEY;
  if (!apiKey) {
    console.error('Error: APP_SECRET_KEY not found in .env file');
    process.exit(1);
  }

  let base64Image;
  
  if (imagePath) {
    // Read image from file
    if (!fs.existsSync(imagePath)) {
      console.error(`Error: File not found: ${imagePath}`);
      process.exit(1);
    }
    const imageBuffer = fs.readFileSync(imagePath);
    base64Image = imageBuffer.toString('base64');
    console.log(`Loaded image: ${imagePath}`);
  } else {
    // Use a tiny test PNG (1x1 transparent pixel)
    // This will likely fail parsing but tests the API connectivity
    base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    console.log('Using placeholder image (1x1 pixel - will likely fail parsing)');
    console.log('To test with a real image: npm run test:upload -- /path/to/screenshot.jpg');
  }

  const localIP = getLocalIP();
  console.log(`\nLocal IP: ${localIP}`);
  console.log(`For iPhone testing, use: http://${localIP}:3000/api/quick-add`);

  const url = 'http://localhost:3000/api/quick-add';
  
  console.log(`\nPOSTing to: ${url}`);
  console.log('Image size:', Math.round(base64Image.length / 1024), 'KB');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ image: base64Image }),
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('\n✅ Success!');
      console.log('Redirect URL:', responseText);
      
      // Open the URL in browser
      const { exec } = await import('child_process');
      exec(`open "${responseText}"`);
    } else {
      console.log('\n❌ Error:', response.status);
      console.log(responseText);
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.log('\nMake sure the dev server is running: npm run dev');
  }
}

main();
