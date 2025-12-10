
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Files (The React App)
app.use(express.static(path.join(__dirname, 'dist')));

// --- SECURE API ROUTES ---

// Initialize AI with Server-Side Key
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.post('/api/generate', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'API_KEY not configured on server' });
  }

  try {
    const { model, contents, config } = req.body;
    
    // Call Google Gemini from the SERVER side
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents,
      config
    });

    // Helper to get text from response similar to SDK
    // CRITICAL FIX: Access .text as a property, NOT a method
    const text = response.text; 
    
    // Send back a shape that the client expects (mocking the SDK response structure slightly)
    res.json({ text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Catch-all handler for React Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
