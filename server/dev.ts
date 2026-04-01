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

// Restrict CORS to development origins
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3001', 'http://127.0.0.1:8080'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    groqKeySet: !!process.env.GROQ_API_KEY,
    env: 'development',
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

// Send Web API response back through Express
async function sendWebResponse(res: express.Response, response: Response) {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  return response;
}

// Tutor endpoint (streaming)
app.post('/api/tutor', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/tutor.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/tutor`);
    const response = await handler(request);

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

// AI endpoint (streaming) — FIXED to use Web API Request pattern
app.post('/api/ai', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/ai.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/ai`);
    const response = await handler(request);

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
    res.status(500).json({ error: 'AI failed', details: String(error) });
  }
});

// SnapSolve endpoint
app.post('/api/snapsolve', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/snapsolve.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/snapsolve`);
    const response = await handler(request);
    await sendWebResponse(res, response);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('SnapSolve error:', error);
    res.status(500).json({ error: 'SnapSolve failed', details: String(error) });
  }
});

// Explain Mistake endpoint — NEW, was missing from dev server
app.post('/api/explain', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/explain.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/explain`);
    const response = await handler(request);
    await sendWebResponse(res, response);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Explain error:', error);
    res.status(500).json({ error: 'Explain failed', details: String(error) });
  }
});

// Grade Quiz endpoint — NEW, was unreachable
app.post('/api/grade-quiz', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/grade-quiz.ts'));
    const request = toWebRequest(req, `http://localhost:${PORT}/api/grade-quiz`);
    const response = await handler(request);
    await sendWebResponse(res, response);
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Grade quiz error:', error);
    res.status(500).json({ error: 'Grade quiz failed', details: String(error) });
  }
});

// Helper to mount standard API routes
function mountApiRoute(path: string) {
  app.post(path, async (req, res) => {
    try {
      const handler = await loadApiRoute(join(__dirname, `../api/${path.replace('/api/', '')}.ts`));
      const request = toWebRequest(req, `http://localhost:${PORT}${path}`);
      const response = await handler(request);
      await sendWebResponse(res, response);
      const text = await response.text();
      try { res.json(JSON.parse(text)); } catch { res.send(text); }
    } catch (error) {
      console.error(`${path} error:`, error);
      res.status(500).json({ error: `${path} failed`, details: String(error) });
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
mountApiRoute("/api/conversation-mode");
mountApiRoute("/api/textbook-scan");
mountApiRoute("/api/progress-snapshot");
mountApiRoute("/api/offline-sync");

app.listen(PORT, () => {
  console.log(`[dev-server] API running on http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('[dev-server] ⚠️  GROQ_API_KEY is not set! AI responses will fail.');
    console.warn('[dev-server] Set it: export GROQ_API_KEY=your_key_here');
  }
});
