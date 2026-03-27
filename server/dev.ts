import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load .env
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    groqKeySet: !!process.env.GROQ_API_KEY 
  });
});

// Import and adapt Vercel edge functions
async function loadApiRoute(routePath: string) {
  const mod = await import(routePath);
  return mod.default;
}

// Tutor endpoint
app.post('/api/tutor', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/tutor.ts'));
    
    // Convert Express req to Web API Request
    const url = `http://localhost:${PORT}/api/tutor`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
    }
    
    const request = new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });
    
    const response = await handler(request);
    
    // Stream the response back
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const reader = response.body?.getReader();
    if (reader) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Tutor error:', error);
    res.status(500).json({ error: 'Tutor failed', details: String(error) });
  }
});

// AI endpoint
app.post('/api/ai', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/ai.ts'));
    await handler(req, res);
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ error: 'AI failed' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[dev-server] API running on http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('[dev-server] ⚠️  GROQ_API_KEY is not set! AI responses will fail.');
    console.warn('[dev-server] Set it: export GROQ_API_KEY=your_key_here');
  }
});
