export const maxDuration = 30;
export const runtime = 'edge';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

interface TTSRequest {
  text: string;
  voice_id?: string;
  model_id?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel - natural, clear voice
const DEFAULT_MODEL = 'eleven_multilingual_v2';

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

/**
 * POST /api/voice-tts
 * 
 * Takes text + optional voice_id, returns audio using ElevenLabs API.
 * Streams the audio response for efficient delivery.
 * 
 * Body:
 * {
 *   text: string,
 *   voice_id?: string,
 *   model_id?: string,
 *   voice_settings?: object
 * }
 * 
 * Returns: Audio/mpeg stream
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: TTSRequest = await req.json();
    const { text, voice_id, model_id, voice_settings } = body;

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required field: text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Truncate text if too long (ElevenLabs limit is ~5000 chars)
    const truncatedText = text.length > 5000 
      ? text.substring(0, 4997) + '...' 
      : text;

    const selectedVoiceId = voice_id || DEFAULT_VOICE_ID;
    const selectedModel = model_id || DEFAULT_MODEL;
    const settings = { ...DEFAULT_VOICE_SETTINGS, ...voice_settings };

    const requestBody = {
      text: truncatedText,
      model_id: selectedModel,
      voice_settings: settings,
    };

    // Call ElevenLabs API
    const response = await fetch(`${ELEVENLABS_API_URL}/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ElevenLabs API error:', response.status, errorBody);
      
      let errorMessage = 'ElevenLabs API request failed';
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.detail?.message || errorMessage;
      } catch {
        // Use default message
      }

      return new Response(JSON.stringify({ 
        error: errorMessage,
        status: response.status,
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the audio response
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return new Response(JSON.stringify({
      success: true,
      audio: audioBase64,
      content_type: 'audio/mpeg',
      voice_id: selectedVoiceId,
      model: selectedModel,
      text_length: truncatedText.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Voice TTS error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate speech',
      message: error?.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
