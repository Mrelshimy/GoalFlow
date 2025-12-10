
import { GoogleGenAI } from '@google/genai';

export default async function handler(request, response) {
  // Handle CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API_KEY configuration missing on server' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { model, contents, config } = request.body;

    const aiResponse = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents,
      config
    });

    // CRITICAL FIX: Access .text as a property, not a method
    const text = aiResponse.text; 

    return response.status(200).json({ text });
  } catch (error) {
    console.error('Vercel API Error:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
