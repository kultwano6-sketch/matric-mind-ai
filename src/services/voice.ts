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
 */
export function stopRecording(): RecordingResult {
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
    const error = await response.json();
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

    audio.onerror = (e) => {
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
  // For now, use the Web Speech API approach or return empty
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
    // API not available, fallback not possible for recorded audio
  }

  throw new Error('Speech-to-text service not available. Use startSpeechRecognition for live transcription.');
}

// ============================================================
// Audio Visualization Helpers
// ============================================================

/**
 * Create an audio context and analyser for visualization.
 * Use with requestAnimationFrame to get frequency data.
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
