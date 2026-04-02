// Matric Mind AI - Production Server
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
const PORT = process.env.PORT || 3001;

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://matric-mind-ai-production.up.railway.app'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', groqKeySet: !!process.env.GROQ_API_KEY, env: 'production' });
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
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value as string);
  }
  return new Request(url, { method: req.method, headers, body: req.body ? JSON.stringify(req.body) : undefined });
}

// Response helper
async function sendWebResponse(res: any, response: Response) {
  res.status(response.status);
  response.headers.forEach((value, key) => { res.setHeader(key, value); });
  return response;
}

// Mount API route helper
function mountApiRoute(path: string) {
  // GET handler
  app.get(path, async (req, res) => {
    try {
      const handler = await loadApiRoute(join(__dirname, `../api/${path.replace('/api/', '')}.ts`));
      const request = toWebRequest(req, `${req.protocol}://${req.get('host')}${path}`);
      const response = await handler(request);
      const text = await response.text();
      try { res.json(JSON.parse(text)); } catch { res.send(text); }
    } catch (error) {
      console.error(`${path} error:`, error);
      res.status(500).json({ error: `${path} failed` });
    }
  });
  // POST handler
  app.post(path, async (req, res) => {
    try {
      const handler = await loadApiRoute(join(__dirname, `../api/${path.replace('/api/', '')}.ts`));
      const request = toWebRequest(req, `${req.protocol}://${req.get('host')}${path}`);
      const response = await handler(request);
      const text = await response.text();
      try { res.json(JSON.parse(text)); } catch { res.send(text); }
    } catch (error) {
      console.error(`${path} error:`, error);
      res.status(500).json({ error: `${path} failed` });
    }
  });
}

// Core endpoints
app.post('/api/tutor', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/tutor.ts'));
    const request = toWebRequest(req, `${req.protocol}://${req.get('host')}/api/tutor`);
    const response = await handler(request);
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const reader = response.body?.getReader();
    if (reader) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      while (true) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
      res.end();
    } else { const text = await response.text(); res.send(text); }
  } catch (e) { console.error('Tutor error:', e); res.status(500).json({ error: 'Tutor failed' }); }
});

app.post('/api/ai', async (req, res) => {
  try {
    const handler = await loadApiRoute(join(__dirname, '../api/ai.ts'));
    const request = toWebRequest(req, `${req.protocol}://${req.get('host')}/api/ai`);
    const response = await handler(request);
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const reader = response.body?.getReader();
    if (reader) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      while (true) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
      res.end();
    } else { const text = await response.text(); res.send(text); }
  } catch (e) { console.error('AI error:', e); res.status(500).json({ error: 'AI failed' }); }
});

// All API routes
mountApiRoute('/api/snapsolve');
mountApiRoute('/api/explain');
mountApiRoute('/api/grade-quiz');
mountApiRoute('/api/weakness-detection');
mountApiRoute('/api/study-recommendations');
mountApiRoute('/api/matric-readiness');
mountApiRoute('/api/voice-tts');
mountApiRoute('/api/ocr-solve');
mountApiRoute('/api/parent-report');
mountApiRoute('/api/exam-simulator');
mountApiRoute('/api/dynamic-difficulty');
mountApiRoute('/api/predictive-analytics');
mountApiRoute('/api/motivation');
mountApiRoute('/api/ocr-advanced');
mountApiRoute('/api/daily-challenge');
mountApiRoute('/api/conversation-mode');
mountApiRoute('/api/textbook-scan');
mountApiRoute('/api/progress-snapshot');
mountApiRoute('/api/offline-sync');

// Static files
const distPath = resolve(__dirname, '../dist');
if (existsSync(distPath)) {
  console.log(`Serving static from: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
} else {
  console.warn('No dist folder found');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  if (!process.env.GROQ_API_KEY) console.warn('⚠️ GROQ_API_KEY not set');
});
