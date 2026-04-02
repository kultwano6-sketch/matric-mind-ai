import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';
import { existsSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', groqKeySet: !!process.env.GROQ_API_KEY, env: process.env.NODE_ENV || 'development' });
});

// Dynamic route loader
async function loadApiRoute(routePath: string) {
  const mod = await import(routePath);
  return mod.default;
}

// Convert Express req to Web API Request
function toWebRequest(req: any, url: string): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
  }
  return new Request(url, { method: req.method, headers, body: req.body ? JSON.stringify(req.body) : undefined });
}

// Handle streaming response (tutor-style SSE)
async function streamResponse(res: any, response: Response) {
  res.status(response.status);
  response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
  const reader = response.body?.getReader();
  if (reader) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    while (true) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
    res.end();
  } else {
    res.send(await response.text());
  }
}

// Handle JSON response
async function jsonResponse(res: any, response: Response) {
  res.status(response.status);
  const text = await response.text();
  try { res.json(JSON.parse(text)); } catch { res.send(text); }
}

// ─── Core endpoints ───────────────────────────────────────────────────────────

app.post('/api/tutor', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/tutor.ts'));
    await streamResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/tutor`)));
  } catch (e) { console.error('Tutor error:', e); res.status(500).json({ error: 'Tutor failed' }); }
});

app.post('/api/snapsolve', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/snapsolve.ts'));
    await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/snapsolve`)));
  } catch (e) { console.error('SnapSolve error:', e); res.status(500).json({ error: 'SnapSolve failed' }); }
});

app.post('/api/ai', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/ai.ts'));
    await streamResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/ai`)));
  } catch (e) { console.error('AI error:', e); res.status(500).json({ error: 'AI failed' }); }
});

app.post('/api/explain', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/explain.ts'));
    await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/explain`)));
  } catch (e) { console.error('Explain error:', e); res.status(500).json({ error: 'Explain failed' }); }
});

app.post('/api/grade-quiz', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/grade-quiz.ts'));
    await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/grade-quiz`)));
  } catch (e) { console.error('Grade quiz error:', e); res.status(500).json({ error: 'Grade quiz failed' }); }
});

// ─── Mount helper (GET + POST) ────────────────────────────────────────────────

function mountApiRoute(path: string) {
  const apiName = path.replace('/api/', '');
  app.get(path, async (req, res) => {
    try {
      const handler = await loadApiRoute(join(__dirname, `../api/${apiName}.ts`));
      await jsonResponse(res, await handler(toWebRequest(req, `${req.protocol}://${req.get('host')}${path}`)));
    } catch (error) { console.error(`${apiName} error:`, error); res.status(500).json({ error: `${apiName} failed` }); }
  });
  app.post(path, async (req, res) => {
    try {
      const handler = await loadApiRoute(join(__dirname, `../api/${apiName}.ts`));
      await jsonResponse(res, await handler(toWebRequest(req, `${req.protocol}://${req.get('host')}${path}`)));
    } catch (error) { console.error(`${apiName} error:`, error); res.status(500).json({ error: `${apiName} failed` }); }
  });
}

// ─── All API routes ────────────────────────────────────────────────────────────

// Batch 1 feature endpoints
mountApiRoute('/api/weakness-detection');
mountApiRoute('/api/study-recommendations');
mountApiRoute('/api/matric-readiness');
mountApiRoute('/api/voice-tts');
mountApiRoute('/api/ocr-solve');
mountApiRoute('/api/parent-report');

// Batch 2 feature endpoints
mountApiRoute('/api/exam-simulator');
mountApiRoute('/api/dynamic-difficulty');
mountApiRoute('/api/predictive-analytics');
mountApiRoute('/api/motivation');
mountApiRoute('/api/ocr-advanced');
mountApiRoute('/api/daily-challenge');

// Batch 3 feature endpoints
mountApiRoute('/api/conversation-mode');
mountApiRoute('/api/textbook-scan');
mountApiRoute('/api/progress-snapshot');
mountApiRoute('/api/offline-sync');

// ─── Static files ─────────────────────────────────────────────────────────────

const distPath = resolve(__dirname, '../dist');
console.log(`📁 Checking dist at: ${distPath}`);
console.log(`📁 Dist exists: ${existsSync(distPath)}`);
if (existsSync(distPath)) {
  console.log(`📁 Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*path', (_req, res) => res.sendFile(join(distPath, 'index.html')));
} else {
  console.error(`❌ dist folder NOT found at: ${distPath}`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  if (!process.env.GROQ_API_KEY) console.warn('⚠️ GROQ_API_KEY not set! AI responses will fail.');
});
