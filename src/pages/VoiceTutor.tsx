import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { supabase } from '@/integrations/supabase/client';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  isRecording,
  textToSpeech,
  speakText,
  playAudio,
  createAudioAnalyzer,
  getWaveformData,
  startSpeechRecognition,
} from '@/services/voice';
import {
  Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles,
  MessageSquare, Bot, User, Square, Pause, Play,
  Waves, Phone, PhoneOff
} from 'lucide-react';

type MatricSubject = string;

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioPlaying?: boolean;
}

interface VoiceSettings {
  voiceEnabled: boolean;
  autoPlayTTS: boolean;
  voiceId?: string;
}

export default function VoiceTutor() {
  const { user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(Array(32).fill(0));
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceEnabled: true,
    autoPlayTTS: true,
  });
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const recognitionCleanupRef = useRef<(() => void) | null>(null);
  const waveformIntervalRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionCleanupRef.current) {
        recognitionCleanupRef.current();
      }
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      cancelRecording();
      if (currentAudio) {
        currentAudio.pause();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Save voice session to database
  const saveVoiceSession = useCallback(async (subject: string, transcriptText: string, duration: number) => {
    if (!user) return;
    try {
      await supabase.from('voice_sessions').insert({
        student_id: user.id,
        subject,
        transcript: transcriptText,
        duration_sec: duration,
      });
    } catch (err) {
      console.error('Error saving voice session:', err);
    }
  }, [user]);

  // Generate TTS for assistant response
  const generateTTS = useCallback(async (text: string): Promise<HTMLAudioElement | null> => {
    if (isMuted || !voiceSettings.voiceEnabled) return null;

    try {
      // Clean text for speech
      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#+\s/g, '')
        .replace(/```[\s\S]*?```/g, 'code example')
        .replace(/`[^`]+`/g, match => match.slice(1, -1))
        .trim();

      const audioBuffer = await textToSpeech(cleanText, voiceSettings.voiceId);
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        setCurrentAudio(null);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        setCurrentAudio(null);
      };

      return audio;
    } catch (err) {
      console.error('TTS error:', err);
      return null;
    }
  }, [isMuted, voiceSettings]);

  // Send message to AI tutor
  const sendToAI = useCallback(async (userMessage: string) => {
    if (!selectedSubject || !userMessage.trim()) return;

    setIsProcessing(true);
    setError(null);

    const userMsg: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMsg]);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...conversation.map(m => ({
              role: m.role,
              parts: [{ type: 'text', text: m.content }],
            })),
            { role: 'user', parts: [{ type: 'text', text: userMessage }] },
          ],
          subject: selectedSubject,
          stylePrompt: 'Keep responses conversational and concise for voice interaction. Limit to 2-3 sentences when possible. Use natural spoken language.',
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let fullResponse = '';
      const decoder = new TextDecoder();

      // Add placeholder assistant message
      const assistantMsgId = `assistant-${Date.now()}`;
      setConversation(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text-delta' && parsed.delta) {
                fullResponse += parsed.delta;
                setConversation(prev =>
                  prev.map(m => m.id === assistantMsgId
                    ? { ...m, content: fullResponse }
                    : m
                  )
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      if (fullResponse.trim()) {
        // Generate and play TTS
        if (voiceSettings.autoPlayTTS && !isMuted) {
          setIsSpeaking(true);
          const audio = await generateTTS(fullResponse);
          if (audio) {
            setCurrentAudio(audio);
            await audio.play();
          }
        }

        // Save session
        saveVoiceSession(selectedSubject, `${userMessage}\n\n${fullResponse}`, 0);
      }

    } catch (err) {
      console.error('AI Error:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedSubject, conversation, voiceSettings, isMuted, generateTTS, saveVoiceSession, user]);

  // Start voice recording with waveform visualization
  const handleStartListening = useCallback(async () => {
    if (!selectedSubject) {
      setError('Please select a subject first');
      return;
    }

    setError(null);
    stopCurrentAudio();

    try {
      // Start recording
      const stream = await startRecording();
      streamRef.current = stream;

      // Set up waveform visualization
      const analyzer = createAudioAnalyzer(stream);
      waveformIntervalRef.current = window.setInterval(() => {
        const freqData = analyzer.getFrequencyData();
        const bars = getWaveformData(freqData, 32);
        setWaveform(bars);
      }, 50);

      // Start duration timer
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);

      setIsListening(true);

      // Also start speech recognition for live transcript
      const stopRecognition = startSpeechRecognition(
        (text, isFinal) => {
          setTranscript(text);
          if (isFinal && text.trim()) {
            handleStopAndSend(text);
          }
        },
        (error) => {
          console.warn('Speech recognition error:', error);
          // Don't set error for speech recognition issues, recording still works
        },
        'en-ZA'
      );

      recognitionCleanupRef.current = stopRecognition;

    } catch (err: any) {
      console.error('Recording error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError('Could not start recording. Please try again.');
      }
    }
  }, [selectedSubject]);

  // Stop recording and send to AI
  const handleStopAndSend = useCallback(async (transcriptText?: string) => {
    // Clean up recording
    if (recognitionCleanupRef.current) {
      recognitionCleanupRef.current();
      recognitionCleanupRef.current = null;
    }
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setWaveform(Array(32).fill(0));

    try {
      const result = await stopRecording();
      setIsListening(false);

      const text = transcriptText || transcript;
      if (text.trim()) {
        await sendToAI(text);
      }
    } catch {
      setIsListening(false);
      const text = transcriptText || transcript;
      if (text.trim()) {
        await sendToAI(text);
      }
    }

    setTranscript('');
  }, [transcript, sendToAI]);

  const handleStopListening = useCallback(() => {
    handleStopAndSend();
  }, [handleStopAndSend]);

  // Stop current audio playback
  const stopCurrentAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    setIsSpeaking(false);
  }, [currentAudio]);

  const toggleMute = () => {
    if (isSpeaking) {
      stopCurrentAudio();
    }
    setIsMuted(!isMuted);
  };

  const clearConversation = () => {
    setConversation([]);
    setTranscript('');
    stopCurrentAudio();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Waves className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Voice Tutor</h1>
              <p className="text-sm text-muted-foreground">Talk to your AI tutor in real-time</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {ALL_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>
                    {SUBJECT_ICONS[s as keyof typeof SUBJECT_ICONS] || '📖'} {SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className={isMuted ? 'text-muted-foreground' : ''}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            {conversation.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearConversation}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Main Voice Interface */}
          <Card className="flex-1 glass-card overflow-hidden flex flex-col">
            <CardContent className="flex-1 flex flex-col p-6">
              {/* Conversation Area */}
              <div className="flex-1 overflow-y-auto mb-6 space-y-4">
                {conversation.length === 0 && !isListening && !isProcessing && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md">
                      {selectedSubject ? (
                        <>
                          <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="text-6xl mb-4"
                          >
                            {SUBJECT_ICONS[selectedSubject as keyof typeof SUBJECT_ICONS] || '📖'}
                          </motion.div>
                          <h2 className="text-xl font-display font-semibold mb-2">
                            {SUBJECT_LABELS[selectedSubject as keyof typeof SUBJECT_LABELS] || selectedSubject} Voice Tutor
                          </h2>
                          <p className="text-muted-foreground mb-6">
                            Tap the microphone button and ask me anything about {SUBJECT_LABELS[selectedSubject as keyof typeof SUBJECT_LABELS] || selectedSubject}.
                            I'll listen to your question and respond with voice!
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
                            <Badge variant="outline">🎤 Voice input</Badge>
                            <Badge variant="outline">🔊 Voice output</Badge>
                            <Badge variant="outline">📝 Live transcript</Badge>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-full gradient-navy flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="w-8 h-8 text-sidebar-foreground" />
                          </div>
                          <h2 className="text-xl font-display font-semibold mb-2">
                            Select a Subject
                          </h2>
                          <p className="text-muted-foreground">
                            Choose a subject above to start talking with your AI tutor
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {conversation.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-secondary-foreground" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                      }`}>
                      {msg.content ? (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      )}
                      <p className="text-[10px] mt-1 opacity-60">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Live Transcript */}
                <AnimatePresence>
                  {isListening && transcript && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex gap-3 justify-end"
                    >
                      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary/50 text-primary-foreground border-2 border-dashed border-primary">
                        <p className="text-sm">{transcript}</p>
                        <p className="text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          Listening... {formatDuration(recordingDuration)}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Processing Indicator */}
                {isProcessing && !conversation.some(m => m.role === 'assistant' && m.content === '') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice Controls */}
              <div className="flex flex-col items-center gap-4">
                {/* Status + Timer */}
                {(isListening || isSpeaking) && (
                  <div className="flex items-center gap-3 text-sm">
                    {isListening && (
                      <Badge variant="outline" className="gap-1 border-red-500 text-red-500">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Recording {formatDuration(recordingDuration)}
                      </Badge>
                    )}
                    {isSpeaking && (
                      <Badge variant="outline" className="gap-1 border-primary text-primary">
                        <Volume2 className="w-3 h-3" />
                        Speaking...
                        <button onClick={stopCurrentAudio} className="ml-1 hover:opacity-70">
                          Stop
                        </button>
                      </Badge>
                    )}
                  </div>
                )}

                {/* Waveform Visualization */}
                <AnimatePresence>
                  {isListening && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 48 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-end gap-0.5 justify-center"
                    >
                      {waveform.map((value, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: Math.max(4, value * 0.48) }}
                          transition={{ duration: 0.1 }}
                          className="w-1.5 bg-red-500 rounded-full"
                          style={{ backgroundColor: value > 70 ? '#ef4444' : value > 40 ? '#f97316' : '#3b82f6' }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Main Record Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={isListening ? handleStopListening : handleStartListening}
                  disabled={isProcessing || !selectedSubject}
                  className={`
                    relative w-24 h-24 rounded-full transition-all duration-300
                    flex items-center justify-center
                    ${isListening
                      ? 'bg-red-500 hover:bg-red-600 scale-110'
                      : 'gradient-navy hover:opacity-90'
                    }
                    ${(!selectedSubject || isProcessing) && 'opacity-50 cursor-not-allowed'}
                    shadow-lg hover:shadow-xl
                  `}
                >
                  {isProcessing ? (
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  ) : isListening ? (
                    <Square className="w-8 h-8 text-white fill-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-white" />
                  )}

                  {/* Pulse Animation */}
                  {isListening && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse opacity-30" />
                    </>
                  )}
                </motion.button>

                <p className="text-sm text-muted-foreground text-center">
                  {isListening
                    ? 'Tap to stop recording'
                    : isProcessing
                      ? 'Processing your question...'
                      : selectedSubject
                        ? 'Tap the microphone to speak'
                        : 'Select a subject to begin'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tips Sidebar */}
          <div className="hidden lg:flex flex-col w-72 space-y-4">
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="font-display font-semibold text-sm">Voice Tips</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-accent font-medium">1.</span>
                    Speak clearly at a normal pace
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent font-medium">2.</span>
                    Ask one question at a time
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent font-medium">3.</span>
                    Wait for the tutor to finish
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent font-medium">4.</span>
                    Use headphones for best results
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-sm mb-3">Try Asking</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>"Explain photosynthesis to me"</li>
                  <li>"What is the quadratic formula?"</li>
                  <li>"Help me with accounting entries"</li>
                  <li>"Give me a practice problem"</li>
                  <li>"How do I balance this equation?"</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-sm mb-3">Voice Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Voice responses</span>
                    <button
                      onClick={() => setVoiceSettings(s => ({ ...s, autoPlayTTS: !s.autoPlayTTS }))}
                      className={`w-10 h-5 rounded-full transition-colors ${voiceSettings.autoPlayTTS ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${voiceSettings.autoPlayTTS ? 'translate-x-5.5' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
