// ============================================================
// Matric Mind AI - Voice Service Additions
// Enhanced voice options: speech rate, pitch, language, conversation mode
// ============================================================

// ============================================================
// New Types
// ============================================================

export interface EnhancedTTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speechRate?: number;    // 0.5 - 2.0 (1.0 = normal)
  voicePitch?: number;    // -12 to 12 semitones (0 = normal)
  language?: string;      // 'en-ZA', 'af-ZA', 'zu-ZA', etc.
  conversationMode?: boolean; // Keeps mic open between messages
}

export interface VoiceLanguage {
  code: string;
  name: string;
  voiceId?: string;
  speechRecognitionLang: string;
}

// ============================================================
// Language Configurations
// ============================================================

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'en', name: 'English', voiceId: 'TX3LPaxmHKxFdv7VOQHJ', speechRecognitionLang: 'en-ZA' },
  { code: 'af', name: 'Afrikaans', voiceId: undefined, speechRecognitionLang: 'af-ZA' },
  { code: 'zu', name: 'isiZulu', voiceId: undefined, speechRecognitionLang: 'zu-ZA' },
  { code: 'xh', name: 'isiXhosa', voiceId: undefined, speechRecognitionLang: 'xh-ZA' },
  { code: 'st', name: 'Sesotho', voiceId: undefined, speechRecognitionLang: 'st-ZA' },
  { code: 'tn', name: 'Setswana', voiceId: undefined, speechRecognitionLang: 'tn-ZA' },
];

/**
 * Get voice configuration for a language
 */
export function getVoiceLanguage(code: string): VoiceLanguage {
  return SUPPORTED_VOICE_LANGUAGES.find(l => l.code === code) || SUPPORTED_VOICE_LANGUAGES[0];
}

/**
 * Get speech recognition language code for a language
 */
export function getSpeechRecognitionLang(code: string): string {
  const lang = getVoiceLanguage(code);
  return lang.speechRecognitionLang;
}

// ============================================================
// Speech Rate Helpers
// ============================================================

/**
 * Get human-readable label for speech rate
 */
export function getSpeechRateLabel(rate: number): string {
  if (rate <= 0.5) return 'Very Slow';
  if (rate <= 0.75) return 'Slow';
  if (rate <= 1.0) return 'Normal';
  if (rate <= 1.25) return 'Fast';
  if (rate <= 1.5) return 'Very Fast';
  return 'Maximum';
}

/**
 * Apply speech rate to audio playback
 */
export function applySpeechRate(audio: HTMLAudioElement, rate: number): void {
  audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
}

// ============================================================
// Voice Pitch Helpers
// ============================================================

/**
 * Get human-readable label for voice pitch
 */
export function getVoicePitchLabel(pitch: number): string {
  if (pitch <= -6) return 'Very Low';
  if (pitch <= -3) return 'Low';
  if (pitch <= 0) return 'Normal';
  if (pitch <= 3) return 'High';
  return 'Very High';
}

// ============================================================
// Conversation Mode Audio Manager
// ============================================================

let conversationAudio: HTMLAudioElement | null = null;
let isConversationMode = false;

/**
 * Enable conversation mode (keeps mic open between messages)
 */
export function enableConversationMode(): void {
  isConversationMode = true;
}

/**
 * Disable conversation mode
 */
export function disableConversationMode(): void {
  isConversationMode = false;
  stopConversationAudio();
}

/**
 * Check if conversation mode is active
 */
export function isInConversationMode(): boolean {
  return isConversationMode;
}

/**
 * Stop any currently playing conversation audio
 */
export function stopConversationAudio(): void {
  if (conversationAudio) {
    conversationAudio.pause();
    conversationAudio.currentTime = 0;
    conversationAudio = null;
  }
}

/**
 * Play audio in conversation mode (manages single audio instance)
 */
export function playConversationAudio(audioBuffer: ArrayBuffer, contentType: string = 'audio/mpeg'): Promise<void> {
  return new Promise((resolve, reject) => {
    // Stop any currently playing audio
    stopConversationAudio();

    const blob = new Blob([audioBuffer], { type: contentType });
    const url = URL.createObjectURL(blob);
    conversationAudio = new Audio(url);

    conversationAudio.onended = () => {
      URL.revokeObjectURL(url);
      conversationAudio = null;
      resolve();
    };

    conversationAudio.onerror = () => {
      URL.revokeObjectURL(url);
      conversationAudio = null;
      reject(new Error('Audio playback failed'));
    };

    conversationAudio.play().catch(reject);
  });
}

// ============================================================
// Default Voice Preferences
// ============================================================

export interface VoicePreferences {
  language: string;
  speechRate: number;
  voicePitch: number;
  autoPlay: boolean;
  conversationMode: boolean;
}

const VOICE_PREFS_KEY = 'matric_mind_voice_preferences';

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  language: 'en',
  speechRate: 1.0,
  voicePitch: 0,
  autoPlay: true,
  conversationMode: false,
};

/**
 * Get saved voice preferences
 */
export function getVoicePreferences(): VoicePreferences {
  try {
    const saved = localStorage.getItem(VOICE_PREFS_KEY);
    if (saved) {
      return { ...DEFAULT_VOICE_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_VOICE_PREFERENCES };
}

/**
 * Save voice preferences
 */
export function saveVoicePreferences(prefs: VoicePreferences): void {
  localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Update a single voice preference
 */
export function updateVoicePreference<K extends keyof VoicePreferences>(
  key: K,
  value: VoicePreferences[K]
): VoicePreferences {
  const prefs = getVoicePreferences();
  prefs[key] = value;
  saveVoicePreferences(prefs);
  return prefs;
}

// ============================================================
// Enhanced Text-to-Speech
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Text-to-speech with enhanced options
 */
export async function enhancedTextToSpeech(
  text: string,
  options?: EnhancedTTSOptions
): Promise<ArrayBuffer> {
  const prefs = getVoicePreferences();

  const response = await fetch(`${API_BASE}/api/voice-tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id: options?.voiceId || getVoiceLanguage(options?.language || prefs.language).voiceId,
      model_id: options?.modelId,
      voice_settings: {
        stability: options?.stability ?? 0.5,
        similarity_boost: options?.similarityBoost ?? 0.75,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'TTS request failed');
  }

  const data = await response.json();

  // Decode base64 to ArrayBuffer
  const binaryString = atob(data.audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Speak text with enhanced options and automatic playback
 */
export async function enhancedSpeakText(
  text: string,
  options?: EnhancedTTSOptions
): Promise<HTMLAudioElement> {
  const prefs = getVoicePreferences();
  const audioBuffer = await enhancedTextToSpeech(text, options);

  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  // Apply enhanced settings
  applySpeechRate(audio, options?.speechRate ?? prefs.speechRate);

  audio.onended = () => {
    URL.revokeObjectURL(url);
  };

  await audio.play();
  return audio;
}
