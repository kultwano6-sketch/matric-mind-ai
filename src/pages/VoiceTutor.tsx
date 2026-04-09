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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      speechSynthesis.cancel();
    };
  }, []);

  const speakText = (text: string) => {
    if (isMuted) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft') || v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => { speechSynthesis.cancel(); setIsSpeaking(false); };
  const stopListening = () => { if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); };
  const toggleMute = () => { if (isSpeaking && !isMuted) stopSpeaking(); setIsMuted(!isMuted); };
  const clearConversation = () => { setConversation([]); setTranscript(''); stopSpeaking(); };

  const sendToAI = async (userMessage: string) => {
    if (!selectedSubject) return;
    setIsProcessing(true);
    setError(null);
    const userMsg: ConversationMessage = { id: `user-${Date.now()}`, role: 'user', content: userMessage, timestamp: new Date() };
    setConversation(prev => [...prev, userMsg]);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, subject: selectedSubject }),
      });
      if (!response.ok) throw new Error('Failed to get AI response');
      const data = await response.json();
      
      // Always ensure we have a valid response - never render empty
      let fullResponse = data.reply || '';
      if (!fullResponse || fullResponse.trim().length === 0) {
        fullResponse = '⚠️ AI failed to respond. Please try again.';
      }
      
      const cleanResponse = fullResponse.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '').trim();
      const assistantMsg: ConversationMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: fullResponse, timestamp: new Date() };
      setConversation(prev => [...prev, assistantMsg]);
      speakText(cleanResponse);
    } catch (err) {
      console.error('AI Error:', err);
      setError('Failed to get response. Please try again.');
      // Add fallback message on error
      const fallbackMsg: ConversationMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: '⚠️ AI failed to respond. Please try again.', timestamp: new Date() };
      setConversation(prev => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (!selectedSubject) { setError('Please select a subject first'); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Voice recognition not supported. Use Chrome or Edge.'); return; }
    setError(null); stopSpeaking();
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => { setIsListening(true); setTranscript(''); };
    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const text = result[0].transcript;
      setTranscript(text);
      if (result.isFinal) { setIsListening(false); if (text.trim()) sendToAI(text); }
    };
    recognition.onerror = (event: any) => { setIsListening(false); if (event.error === 'not-allowed') setError('Microphone access denied.'); else if (event.error !== 'aborted') setError('Voice recognition error.'); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center shadow-lg">
              <Mic className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Voice Tutor</h1>
              <p className="text-sm text-muted-foreground">Talk to your AI tutor in real-time</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as MatricSubject)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {ALL_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={toggleMute} className={isMuted ? 'text-muted-foreground' : ''}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            
            {conversation.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearConversation}>Clear Chat</Button>
            )}
          </div>
        </div>

        {/* Welcome / Empty State */}
        {conversation.length === 0 && !isListening && !isProcessing && (
          <Card className="glass-card border-2 border-primary/10">
            <CardContent className="p-6 md:p-8 text-center">
              {selectedSubject ? (
                <div className="space-y-3">
                  <div className="text-5xl md:text-6xl">{SUBJECT_ICONS[selectedSubject]}</div>
                  <h2 className="text-xl md:text-2xl font-display font-bold">{SUBJECT_LABELS[selectedSubject]} Voice Tutor</h2>
                  <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
                    Tap the microphone button and ask me anything about {SUBJECT_LABELS[selectedSubject]}. 
                    I'll listen to your question and respond with voice!
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20">Explain concepts</Badge>
                    <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Practice problems</Badge>
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Exam tips</Badge>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl gradient-gold flex items-center justify-center mx-auto">
                    <MessageSquare className="w-8 h-8 md:w-10 md:h-10 text-sidebar-foreground" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-display font-bold">Select a Subject</h2>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Choose a subject above to start talking with your AI tutor
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        <div className="space-y-3">
          {conversation.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm md:text-base whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] md:text-xs mt-1 opacity-60">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isListening && transcript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary/50 text-primary-foreground border-2 border-dashed border-primary">
                <p className="text-sm md:text-base">{transcript}</p>
                <p className="text-xs mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Listening...
                </p>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-secondary-foreground" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border-2 border-red-500/20 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Voice Button */}
        <div className="flex flex-col items-center gap-4 py-4">
          {(isListening || isSpeaking) && (
            <div className="flex gap-2">
              {isListening && <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Listening</Badge>}
              {isSpeaking && <Badge className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Speaking
                <button onClick={stopSpeaking} className="ml-1 hover:opacity-70 text-xs">(stop)</button>
              </Badge>}
            </div>
          )}
          
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing || !selectedSubject}
            className={`
              relative w-24 h-24 md:w-28 md:h-28 rounded-full transition-all duration-300
              flex items-center justify-center
              ${isListening ? 'bg-gradient-to-br from-red-500 to-red-600 scale-110' : 'gradient-hero hover:opacity-90'}
              ${(!selectedSubject || isProcessing) && 'opacity-50 cursor-not-allowed'}
              shadow-lg hover:shadow-xl
            `}
          >
            {isProcessing ? (
              <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-white animate-spin" />
            ) : isListening ? (
              <MicOff className="w-10 h-10 md:w-12 md:h-12 text-white" />
            ) : (
              <Mic className="w-10 h-10 md:w-12 md:h-12 text-white" />
            )}
            
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
                <span className="absolute -inset-2 rounded-full border-2 border-red-500 animate-pulse opacity-50" />
              </>
            )}
          </button>

          <p className="text-sm text-muted-foreground text-center">
            {isListening ? 'Tap to stop' : isProcessing ? 'Processing...' : selectedSubject ? 'Tap to speak' : 'Select a subject to begin'}
          </p>
        </div>

        {/* Tips - Hidden on small screens */}
        <div className="hidden md:block">
          <Card className="glass-card border-2 border-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-secondary-foreground" />
                </div>
                <h3 className="font-display font-bold text-sm">Voice Tips</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary">1.</span> Speak clearly at a normal pace</li>
                <li className="flex items-start gap-2"><span className="text-primary">2.</span> Ask one question at a time</li>
                <li className="flex items-start gap-2"><span className="text-primary">3.</span> Wait for AI to finish speaking</li>
                <li className="flex items-start gap-2"><span className="text-primary">4.</span> Use headphones for better recognition</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
