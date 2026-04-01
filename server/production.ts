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

// Restrict CORS to known origins
const allowedOrigins = [
  'https://matric-mind-ai-production.up.railway.app',
  'https://matric-mind-ai.vercel.app',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
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

// Convert Express req to Web API Request
function toWebRequest(req: express.Request, url: string): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
  }
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(req.body),
  });
}

// Tutor endpoint
app.post('/api/tutor', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/tutor.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/tutor`);
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

// AI endpoint — unified with dev server
app.post('/api/ai', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/ai.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/ai`);
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
    console.error('AI error:', error);
    res.status(500).json({ error: 'AI failed' });
  }
});

// SnapSolve endpoint
app.post('/api/snapsolve', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/snapsolve.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/snapsolve`);
    const response = await handler(request);
    res.status(response.status);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('SnapSolve error:', error);
    res.status(500).json({ error: 'SnapSolve failed' });
  }
});

// Explain Mistake endpoint (non-streaming)
app.post('/api/explain', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/explain.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/explain`);
    const response = await handler(request);
    res.status(response.status);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Explain error:', error);
    res.status(500).json({ error: 'Explain failed' });
  }
});

// Grade Quiz endpoint — NEW, was unreachable
app.post('/api/grade-quiz', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/grade-quiz.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/grade-quiz`);
    const response = await handler(request);
    res.status(response.status);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Grade quiz error:', error);
    res.status(500).json({ error: 'Grade quiz failed' });
  }
});

// Helper to mount standard API routes
function mountApiRoute(path: string) {
  app.post(path, async (req, res) => {
    try {
      const handler = await loadApiRoute(join(__dirname, `../api/${path.replace('/api/', '')}.ts`));
      const request = toWebRequest(req, `http://localhost:${PORT}${path}`);
      const response = await handler(request);
      res.status(response.status);
      const text = await response.text();
      try { res.json(JSON.parse(text)); } catch { res.send(text); }
    } catch (error) {
      console.error(`${path} error:`, error);
      res.status(500).json({ error: `${path} failed` });
    }
  });
}

// New AI feature endpoints
mountApiRoute('/api/weakness-detection');
mountApiRoute('/api/study-recommendations');
mountApiRoute('/api/matric-readiness');
mountApiRoute('/api/voice-tts');
mountApiRoute('/api/ocr-solve');
mountApiRoute('/api/parent-report');

// Batch 2: Advanced feature endpoints
mountApiRoute('/api/exam-simulator');
mountApiRoute('/api/dynamic-difficulty');
mountApiRoute('/api/predictive-analytics');
mountApiRoute('/api/motivation');
mountApiRoute('/api/ocr-advanced');

// Daily challenge supports GET and POST
app.get('/api/daily-challenge', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/daily-challenge.ts'));
    const request = new Request(`http://localhost:${PORT}/api/daily-challenge`, { method: 'GET' });
    const response = await handler(request);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('daily-challenge GET error:', error);
    res.status(500).json({ error: 'daily-challenge failed' });
  }
});
mountApiRoute('/api/daily-challenge');

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
