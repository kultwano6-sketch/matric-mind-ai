// Matric Mind AI - Dev Server (mirrors production but with hot-reload)
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// Middleware
// ============================================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================================
// Environment Validation
// ============================================================

if (!process.env.GROQ_API_KEY) {
  console.warn(
    'WARNING: GROQ_API_KEY is not set. ' +
    'AI features will not work until you set it.'
  );
}

// ============================================================
// Groq Client
// ============================================================

export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ============================================================
// Routes
// ============================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'development',
  });
});

// Dynamic route loader helper
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
  return new Request(url, {
    method: req.method,
    headers,
    body: req.body ? JSON.stringify(req.body) : undefined,
  });
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
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
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

// Mount helper (GET + POST)
function mountApiRoute(apiPath: string) {
  const apiName = apiPath.replace('/api/', '');
  app.get(apiPath, async (req: Request, res: Response) => {
    try {
      const handler = await loadApiRoute(`../api/${apiName}.ts`);
      await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}${apiPath}`)));
    } catch (error) { console.error(`${apiName} error:`, error); res.status(500).json({ error: `${apiName} failed` }); }
  });
  app.post(apiPath, async (req: Request, res: Response) => {
    try {
      const handler = await loadApiRoute(`../api/${apiName}.ts`);
      await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}${apiPath}`)));
    } catch (error) { console.error(`${apiName} error:`, error); res.status(500).json({ error: `${apiName} failed` }); }
  });
}

// ─── Core endpoints ───────────────────────────────────────────────────────────

app.post('/api/tutor', async (req: Request, res: Response) => {
  try {
    const handler = await loadApiRoute(`../api/tutor.ts`);
    const response = await handler(toWebRequest(req, `http://localhost:${PORT}/api/tutor`));
    console.log('Tutor response status:', response.status);
    await jsonResponse(res, response);
  } catch (e) { console.error('Tutor error:', e); res.status(500).json({ reply: '⚠️ AI failed to respond. Please try again.' }); }
});

app.post('/api/snapsolve', async (req: Request, res: Response) => {
  try {
    const handler = await loadApiRoute(`../api/snapsolve.ts`);
    await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/snapsolve`)));
  } catch (e) { console.error('SnapSolve error:', e); res.status(500).json({ error: 'SnapSolve failed' }); }
});

app.post('/api/ai', async (req: Request, res: Response) => {
  try {
    const handler = await loadApiRoute(`../api/ai.ts`);
    await streamResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/ai`)));
  } catch (e) { console.error('AI error:', e); res.status(500).json({ error: 'AI failed' }); }
});

app.post('/api/explain', async (req: Request, res: Response) => {
  try {
    const handler = await loadApiRoute(`../api/explain.ts`);
    await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/explain`)));
  } catch (e) { console.error('Explain error:', e); res.status(500).json({ error: 'Explain failed' }); }
});

app.post('/api/grade-quiz', async (req: Request, res: Response) => {
  try {
    const handler = await loadApiRoute(`../api/grade-quiz.ts`);
    await jsonResponse(res, await handler(toWebRequest(req, `http://localhost:${PORT}/api/grade-quiz`)));
  } catch (e) { console.error('Grade quiz error:', e); res.status(500).json({ error: 'Grade quiz failed' }); }
});

// ─── All API routes ────────────────────────────────────────────────────────────

mountApiRoute('/api/insights-engine');
mountApiRoute('/api/readiness-score');
mountApiRoute('/api/adaptive-learning');
mountApiRoute('/api/predictions');
mountApiRoute('/api/at-risk-students');
mountApiRoute('/api/snap-solve-v2');
mountApiRoute('/api/ocr-pipeline');

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
mountApiRoute('/api/notifications-scheduled');

// ============================================================
// Scheduled Notifications System
// Every 5 hours, send role-based reminders
// ============================================================

async function sendScheduledNotifications(role: string) {
  try {
    const response = await fetch(`https://matric-mind-ai-production.up.railway.app/api/notifications-scheduled/send-scheduled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    const result = await response.json();
    console.log(`[Scheduled] ${role} reminders:`, result);
  } catch (error) {
    console.error(`[Scheduled] Failed to send ${role} reminders:`, error);
  }
}

// Run every 5 hours (18,000,000 ms)
const FIVE_HOURS = 5 * 60 * 60 * 1000;

if (process.env.ENABLE_SCHEDULED_NOTIFICATIONS === 'true') {
  setInterval(() => {
    console.log('[Scheduled] Running 5-hour notification check...');
    sendScheduledNotifications('student');
    sendScheduledNotifications('teacher');
    sendScheduledNotifications('head_teacher');
    sendScheduledNotifications('admin');
  }, FIVE_HOURS);
  console.log(`[Scheduled] Notification scheduler enabled (every ${FIVE_HOURS / 3600000} hours)`);
}

// ============================================================
// Global error handler
// ============================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// ============================================================
// Start
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 [DEV] Matric Mind API running on port ${PORT}`);
  console.log(`🤖 Groq model: ${GROQ_MODEL}`);
});

export default app;
