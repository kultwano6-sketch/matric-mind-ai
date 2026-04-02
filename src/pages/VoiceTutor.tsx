import { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, MessageSquare, Bot, User } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function VoiceTutor() {
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      speechSynthesis.cancel();
    };
  }, []);

  const speakText = (text: string) => {
    if (isMuted) return;
    
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    // Try to find a good voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Microsoft') || 
      v.lang.startsWith('en')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const sendToAI = async (userMessage: string) => {
    if (!selectedSubject) return;
    
    setIsProcessing(true);
    setError(null);

    // Add user message to conversation
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
          stylePrompt: 'Keep responses conversational and concise for voice. Limit to 2-3 sentences when possible.',
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let fullResponse = '';
      const decoder = new TextDecoder();

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
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Clean up the response for speech
      const cleanResponse = fullResponse
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#+\s/g, '')
        .replace(/```[\s\S]*?```/g, 'code example')
        .replace(/`[^`]+`/g, match => match.slice(1, -1))
        .trim();

      // Add assistant message to conversation
      const assistantMsg: ConversationMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, assistantMsg]);

      // Speak the response
      speakText(cleanResponse);
    } catch (err) {
      console.error('AI Error:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (!selectedSubject) {
      setError('Please select a subject first');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    setError(null);
    stopSpeaking();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      
      setTranscript(text);
      
      if (result.isFinal) {
        setIsListening(false);
        if (text.trim()) {
          sendToAI(text);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (event.error !== 'aborted') {
        setError('Voice recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleMute = () => {
    if (isSpeaking && !isMuted) {
      stopSpeaking();
    }
    setIsMuted(!isMuted);
  };

  const clearConversation = () => {
    setConversation([]);
    setTranscript('');
    stopSpeaking();
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Mic className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">Voice Tutor</h1>
              <p className="text-sm text-muted-foreground">Talk to your AI tutor in real-time</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as MatricSubject)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {ALL_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>
                    {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
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
                Clear Chat
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
                          <div className="text-6xl mb-4">{SUBJECT_ICONS[selectedSubject]}</div>
                          <h2 className="text-xl font-display font-semibold mb-2">
                            {SUBJECT_LABELS[selectedSubject]} Voice Tutor
                          </h2>
                          <p className="text-muted-foreground mb-6">
                            Tap the microphone button and ask me anything about {SUBJECT_LABELS[selectedSubject]}. 
                            I'll listen to your question and respond with voice!
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
                            <Badge variant="outline">Explain concepts</Badge>
                            <Badge variant="outline">Practice problems</Badge>
                            <Badge variant="outline">Exam tips</Badge>
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
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-secondary-foreground" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[10px] mt-1 opacity-60">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Live Transcript */}
                {isListening && transcript && (
                  <div className="flex gap-3 justify-end">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary/50 text-primary-foreground border-2 border-dashed border-primary">
                      <p className="text-sm">{transcript}</p>
                      <p className="text-[10px] mt-1 flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Listening...
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                )}

                {/* Processing Indicator */}
                {isProcessing && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                  {error}
                </div>
              )}

              {/* Voice Button */}
              <div className="flex flex-col items-center gap-4">
                {/* Status Indicator */}
                {(isListening || isSpeaking) && (
                  <div className="flex items-center gap-2 text-sm">
                    {isListening && (
                      <Badge variant="outline" className="gap-1 border-red-500 text-red-500">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Listening...
                      </Badge>
                    )}
                    {isSpeaking && (
                      <Badge variant="outline" className="gap-1 border-primary text-primary">
                        <Volume2 className="w-3 h-3" />
                        Speaking...
                        <button 
                          onClick={stopSpeaking}
                          className="ml-1 hover:opacity-70"
                        >
                          Stop
                        </button>
                      </Badge>
                    )}
                  </div>
                )}

                {/* Main Button */}
                <button
                  onClick={isListening ? stopListening : startListening}
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
                    <MicOff className="w-10 h-10 text-white" />
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
                </button>

                <p className="text-sm text-muted-foreground text-center">
                  {isListening 
                    ? 'Tap to stop' 
                    : isProcessing 
                      ? 'Processing...'
                      : selectedSubject 
                        ? 'Tap to speak' 
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
                    <span className="text-accent">1.</span>
                    Speak clearly and at a normal pace
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">2.</span>
                    Ask one question at a time
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">3.</span>
                    Wait for the AI to finish speaking
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent">4.</span>
                    Use headphones for better recognition
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-display font-semibold text-sm mb-3">Try Asking</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>"Explain photosynthesis"</li>
                  <li>"What is the quadratic formula?"</li>
                  <li>"Help me with accounting entries"</li>
                  <li>"Give me a practice problem"</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
