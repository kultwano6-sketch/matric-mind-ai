// api/voice-tts.ts — Text-to-Speech (ElevenLabs)
import type { Request, Response } from 'express';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      error: 'TTS service unavailable',
      message: 'ELEVENLABS_API_KEY is not configured on the server.',
    });
  }

  const { text, voice_id, model_id, voice_settings } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  // ElevenLabs has a ~5000 char limit
  if (text.length > 5000) {
    return res.status(400).json({ error: 'text too long (max 5000 characters)' });
  }

  const voiceId = voice_id || 'TX3LPaxmHKxFdv7VOQHJ'; // Default South African voice
  const modelId = model_id || 'eleven_multilingual_v2';

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: modelId,
          voice_settings: voice_settings || {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('ElevenLabs API error:', response.status, errorBody);
      return res.status(response.status).json({
        error: 'TTS request failed',
        detail: errorBody,
      });
    }

    // ElevenLabs returns raw audio/mpeg — encode to base64 for JSON transport
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    res.json({
      audio: base64Audio,
      content_type: 'audio/mpeg',
    });
  } catch (error: any) {
    console.error('TTS Error:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error?.message || 'Unknown error',
    });
  }
}
