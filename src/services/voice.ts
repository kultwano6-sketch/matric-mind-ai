// ============================================================
// Matric Mind AI - Voice Service
// Voice recording, TTS, and speech-to-text functionality
// ============================================================

// ============================================================
// Types
// ============================================================
export interface RecordingResult {
  blob: Blob;
  duration: number;
  url: string;
}

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

// ============================================================
// MediaRecorder Management
// ============================================================
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStartTime: number = 0;
let stream: MediaStream | null = null;

/**
 * Starts microphone recording.
 * Returns a promise that resolves when recording actually starts.
 */
export async function startRecording(): Promise<MediaStream> {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    throw new Error('Recording already in progress');
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });

    audioChunks = [];

    // Determine supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    recordingStartTime = Date.now();
    mediaRecorder.start(100); // Collect data every 100ms

    return stream;
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
}

/**
 * Stops recording and returns the audio blob with metadata.
 * FIXED: Return type was `RecordingResult` (sync) but actually returns a Promise.
 * Now correctly typed as `Promise<RecordingResult>`.
 */
export function stopRecording(): Promise<RecordingResult> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      reject(new Error('No active recording'));
      return;
    }

    mediaRecorder.onstop = () => {
      const duration = Math.round((Date.now() - recordingStartTime) / 1000);
      const mimeType = mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(audioChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Clean up stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }

      mediaRecorder = null;
      audioChunks = [];

      resolve({ blob, duration, url });
    };

    mediaRecorder.stop();
  });
}

/**
 * Cancel recording without returning audio.
 */
export function cancelRecording(): void {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  audioChunks = [];
  mediaRecorder = null;
}

/**
 * Check if currently recording.
 */
export function isRecording(): boolean {
  return mediaRecorder?.state === 'recording';
}

// ============================================================
// Text-to-Speech (ElevenLabs via API)
// ============================================================

/**
 * Convert text to speech using the ElevenLabs API via our backend.
 * Returns an ArrayBuffer of audio/mpeg data.
 */
export async function textToSpeech(
  text: string,
  voiceId?: string,
  options?: TTSOptions
): Promise<ArrayBuffer> {
  const response = await fetch('/api/voice-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      model_id: options?.modelId,
      voice_settings: options ? {
        stability: options.stability,
        similarity_boost: options.similarityBoost,
      } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'TTS request failed');
  }

  const data = await response.json();

  // Decode base64 audio to ArrayBuffer
  const binaryString = atob(data.audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Play audio from an ArrayBuffer.
 * Returns a promise that resolves when playback ends.
 */
export function playAudio(audioBuffer: ArrayBuffer, contentType: string = 'audio/mpeg'): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([audioBuffer], { type: contentType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch(reject);
  });
}

/**
 * Text-to-speech with automatic playback.
 * Convenience function that combines TTS + play.
 */
export async function speakText(
  text: string,
  voiceId?: string,
  options?: TTSOptions
): Promise<HTMLAudioElement> {
  const audioBuffer = await textToSpeech(text, voiceId, options);
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  await audio.play();

  audio.onended = () => {
    URL.revokeObjectURL(url);
  };

  return audio;
}

// ============================================================
// Speech-to-Text (Web Speech API fallback + API)
// ============================================================

let recognition: any = null;

/**
 * Start continuous speech recognition.
 * Returns text as it's recognized.
 */
export function startSpeechRecognition(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  language: string = 'en-ZA'
): () => void {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError?.('Speech recognition not supported in this browser');
    return () => {};
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = language;

  recognition.onresult = (event: any) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error !== 'aborted') {
      onError?.(event.error);
    }
  };

  recognition.start();

  // Return cleanup function
  return () => {
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
  };
}

/**
 * Convert speech audio blob to text using Whisper via the API.
 */
export async function speechToText(audio: Blob): Promise<string> {
  // Convert blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
  });
  reader.readAsDataURL(audio);
  const base64Audio = await base64Promise;

  // Call a speech-to-text endpoint (if available)
  try {
    const response = await fetch('/api/voice-stt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64Audio }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.text || '';
    }
  } catch {
    // API not available
  }

  throw new Error('Speech-to-text service not available. Use startSpeechRecognition for live transcription.');
}

// ============================================================
// Audio Visualization Helpers
// ============================================================

/**
 * Create an audio context and analyser for visualization.
 */
export function createAudioAnalyzer(stream: MediaStream): {
  analyser: AnalyserNode;
  getFrequencyData: () => Uint8Array;
  getAverageVolume: () => number;
  cleanup: () => void;
} {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  return {
    analyser,
    getFrequencyData: () => {
      analyser.getByteFrequencyData(dataArray);
      return dataArray;
    },
    getAverageVolume: () => {
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      return Math.round(sum / bufferLength);
    },
    cleanup: () => {
      source.disconnect();
      audioContext.close();
    },
  };
}

/**
 * Calculate audio waveform data from frequency data for visualization.
 */
export function getWaveformData(frequencyData: Uint8Array, barCount: number = 32): number[] {
  const bars: number[] = [];
  const step = Math.floor(frequencyData.length / barCount);

  for (let i = 0; i < barCount; i++) {
    const start = i * step;
    const end = start + step;
    const slice = frequencyData.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    bars.push(Math.round((avg / 255) * 100));
  }

  return bars;
}

// ============================================================
// Enhanced voice options: speech rate, pitch, language, conversation mode
// ============================================================

export interface EnhancedTTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speechRate?: number;
  voicePitch?: number;
  language?: string;
  conversationMode?: boolean;
}

export interface VoiceLanguage {
  code: string;
  name: string;
  voiceId?: string;
  speechRecognitionLang: string;
}

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'en', name: 'English', voiceId: 'TX3LPaxmHKxFdv7VOQHJ', speechRecognitionLang: 'en-ZA' },
  { code: 'af', name: 'Afrikaans', voiceId: undefined, speechRecognitionLang: 'af-ZA' },
  { code: 'zu', name: 'isiZulu', voiceId: undefined, speechRecognitionLang: 'zu-ZA' },
  { code: 'xh', name: 'isiXhosa', voiceId: undefined, speechRecognitionLang: 'xh-ZA' },
  { code: 'st', name: 'Sesotho', voiceId: undefined, speechRecognitionLang: 'st-ZA' },
  { code: 'tn', name: 'Setswana', voiceId: undefined, speechRecognitionLang: 'tn-ZA' },
];

export function getVoiceLanguage(code: string): VoiceLanguage {
  return SUPPORTED_VOICE_LANGUAGES.find(l => l.code === code) || SUPPORTED_VOICE_LANGUAGES[0];
}

export function getSpeechRecognitionLang(code: string): string {
  const lang = getVoiceLanguage(code);
  return lang.speechRecognitionLang;
}

export function getSpeechRateLabel(rate: number): string {
  if (rate <= 0.5) return 'Very Slow';
  if (rate <= 0.75) return 'Slow';
  if (rate <= 1.0) return 'Normal';
  if (rate <= 1.25) return 'Fast';
  if (rate <= 1.5) return 'Very Fast';
  return 'Maximum';
}

export function applySpeechRate(audio: HTMLAudioElement, rate: number): void {
  audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
}

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

export function enableConversationMode(): void {
  isConversationMode = true;
}

export function disableConversationMode(): void {
  isConversationMode = false;
  stopConversationAudio();
}

export function isInConversationMode(): boolean {
  return isConversationMode;
}

export function stopConversationAudio(): void {
  if (conversationAudio) {
    conversationAudio.pause();
    conversationAudio.currentTime = 0;
    conversationAudio = null;
  }
}

export function playConversationAudio(audioBuffer: ArrayBuffer, contentType: string = 'audio/mpeg'): Promise<void> {
  return new Promise((resolve, reject) => {
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

export function saveVoicePreferences(prefs: VoicePreferences): void {
  localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));
}

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

  const binaryString = atob(data.audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

export async function enhancedSpeakText(
  text: string,
  options?: EnhancedTTSOptions
): Promise<HTMLAudioElement> {
  const prefs = getVoicePreferences();
  const audioBuffer = await enhancedTextToSpeech(text, options);

  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  applySpeechRate(audio, options?.speechRate ?? prefs.speechRate);

  audio.onended = () => {
    URL.revokeObjectURL(url);
  };

  await audio.play();
  return audio;
}
