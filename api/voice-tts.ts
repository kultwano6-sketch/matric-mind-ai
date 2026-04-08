// api/voice-tts.ts — Text-to-Speech (ElevenLabs)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'TTS service unavailable',
        message: 'ELEVENLABS_API_KEY is not configured on the server.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  const body = await req.json();
  const { text, voice_id, model_id, voice_settings } = body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
      JSON.stringify({ error: 'text is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
  // ElevenLabs has a ~5000 char limit
  if (text.length > 5000) {
      JSON.stringify({ error: 'text too long (max 5000 characters)' }),
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
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('ElevenLabs API error:', response.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'TTS request failed', detail: errorBody }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // ElevenLabs returns raw audio/mpeg — encode to base64 for JSON transport
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
      JSON.stringify({ audio: base64Audio, content_type: 'audio/mpeg' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
  } catch (error: any) {
    console.error('TTS Error:', error);
        error: 'Failed to generate speech',
        message: error?.message || 'Unknown error',
      { status: 500, headers: { 'Content-Type': 'application/json' } }
}
