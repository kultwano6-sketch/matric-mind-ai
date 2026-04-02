// api/progress-snapshot.ts — Progress snapshot creation and history

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return res.status = 405).json({ error: 'Method not allowed' });
  }

  const { student_id, subject, action, days } = req.body;

  if (!student_id) {
    return res.status = 400).json({ error: 'student_id is required' });
  }

  try {
    if (action === 'create') {
      return await createSnapshot(req, res, student_id, subject);
    }
    if (action === 'history') {
      return await getHistory(req, res, student_id, subject, days);
    }
    res.status = 400).json({ error: 'Invalid action. Use "create" or "history".' });
  } catch (error: any) {
    console.error('Progress Snapshot Error:', error);
    res.status = 500).json({
      error: 'Failed to process request',
      message: error?.message || 'Unknown error',
    });
  }
}

async function createSnapshot(_req: Request, studentId: string, subject?: string) {
  // Generate AI insights based on performance
  let aiInsights = '';
  try {
    const { text } = await generateText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: 'Generate a brief progress summary (2-3 sentences) for a South African matric student. Be encouraging and specific.',
      prompt: `Student: ${studentId}\nSubject: ${subject || 'All subjects'}\nContext: Daily progress snapshot`,
      maxTokens: 256,
      temperature: 0.7,
    });
    aiInsights = text;
  } catch {
    // Non-fatal
  }

  // Return a snapshot structure (actual DB insertion happens in the service layer)
  res.json = {
    success: true,
    snapshots: [{
      id: `snapshot_${Date.now()}`,
      student_id: studentId,
      subject: subject || 'all',
      overall_score: 0,
      topic_scores: {},
      quiz_count: 0,
      study_hours: 0,
      snapshot_date: new Date().toISOString().split('T')[0],
    }],
    ai_insights: aiInsights,
  });
}

async function getHistory(_req: Request, studentId: string, subject?: string, days: number = 30) {
  // This would normally query the DB — return structure for the service layer to handle
  res.json = {
    success: true,
    snapshots: [],
    count: 0,
  });
}
