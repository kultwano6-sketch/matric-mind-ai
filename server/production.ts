import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';
import { existsSync } from 'fs';

// Load .env in development
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    groqKeySet: !!process.env.GROQ_API_KEY,
    env: process.env.NODE_ENV || 'development',
  });
});

// Dynamic route loader
async function loadApiRoute(routePath: string) {
  const mod = await import(routePath);
  return mod.default;
}

// Tutor endpoint
app.post('/api/tutor', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/tutor.ts'));

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

    res.status(response.status);
    response.headers.forEach((value: string, key: string) => {
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

// SnapSolve endpoint
app.post('/api/snapsolve', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/snapsolve.ts'));

    const url = `http://localhost:${PORT}/api/snapsolve`;
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
    res.status(response.status);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('SnapSolve error:', error);
    res.status(500).json({ error: 'SnapSolve failed' });
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

// Illustrations endpoint
app.post('/api/illustrations', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/illustrations.ts'));
    const url = `http://localhost:${PORT}/api/illustrations`;
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
    res.status(response.status);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Illustrations error:', error);
    res.status(500).json({ error: 'Illustrations failed' });
  }
});

// Serve static frontend in production
const distPath = resolve(__dirname, '../dist');
console.log(`📁 Checking dist at: ${distPath}`);
console.log(`📁 Dist exists: ${existsSync(distPath)}`);
if (existsSync(distPath)) {
  console.log(`📁 Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*path', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
} else {
  console.error(`❌ dist folder NOT found at: ${distPath}`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY is not set! AI responses will fail.');
  }
});
