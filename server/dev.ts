// Matric Mind AI - Dev Server (mirrors production but with hot-reload)
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';

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
  console.error(
    'FATAL: GROQ_API_KEY is not set. ' +
    'Please set it in your environment or .env file. Exiting.'
  );
  process.exit(1);
}

// ============================================================
// Groq Client
// ============================================================

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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

import apiRoutes from './routes.js';
app.use('/api', apiRoutes);

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
