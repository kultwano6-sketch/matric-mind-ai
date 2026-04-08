import { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { Mic, MicOff, Volume2, VolumeX, Loader2, MessageSquare, Bot, User } from 'lucide-react';
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

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

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
      if (data.error && data.fallback) throw new Error(data.reply || 'Failed');

      const fullResponse = data.reply || '';
      const cleanResponse = fullResponse.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '').trim();

      const assistantMsg: ConversationMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: fullResponse, timestamp: new Date() };
      setConversation(prev => [...prev, assistantMsg]);
      speakText(cleanResponse);
    } catch (err) {
      console.error('AI Error:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (!selectedSubject) { setError('Select a subject first'); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Not supported. Use Chrome.'); return; }
    setError(null);
    stopSpeaking();
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
    recognition.onerror = (event: any) => { setIsListening(false); if (event.error === 'not-allowed') setError('Mic denied'); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => { if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); };
  const toggleMute = () => { if (isSpeaking && !isMuted) stopSpeaking(); setIsMuted(!isMuted); };
  const clearConversation = () => { setConversation([]); setTranscript(''); stopSpeaking(); };

  return (
    <DashboardLayout>
      <div className="p-3 space-y-3">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-gold flex items-center justify-center">
              <Mic className="w-4 h-4 text-secondary-foreground" />
            </div>
            <h1 className="text-lg font-display font-bold">Voice Tutor</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v as MatricSubject)}>
              <SelectTrigger className="w-40 sm:w-48 text-sm"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {ALL_SUBJECTS.map(s => <SelectItem key={s} value={s} className="text-sm">{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={toggleMute} className="h-9 w-9">{isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</Button>
            {conversation.length > 0 && <Button variant="ghost" size="sm" onClick={clearConversation} className="text-xs h-9">Clear</Button>}
          </div>
        </div>

        {/* Welcome Card */}
        {conversation.length === 0 && !isListening && !isProcessing && (
          <Card className="glass-card border-2 border-primary/10">
            <CardContent className="p-3 text-center">
              {selectedSubject ? (
                <div className="space-y-1">
                  <div className="text-3xl">{SUBJECT_ICONS[selectedSubject]}</div>
                  <h2 className="font-bold text-sm">{SUBJECT_LABELS[selectedSubject]} Voice Tutor</h2>
                  <p className="text-xs text-muted-foreground">Tap the microphone to start!</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a subject above to begin</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Messages - Compact */}
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {conversation.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && <Bot className="w-4 h-4 shrink-0 mt-1" />}
              <div className={`max-w-[75%] rounded-lg px-2 py-1 text-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p>{msg.content}</p>
              </div>
              {msg.role === 'user' && <User className="w-4 h-4 shrink-0 mt-1" />}
            </div>
          ))}
          {isListening && transcript && <div className="flex justify-end"><div className="max-w-[75%] rounded-lg px-2 py-1 bg-primary/50 text-xs border border-dashed border-primary">{transcript}</div></div>}
          {isProcessing && <div className="flex gap-2 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && <div className="p-2 rounded-lg bg-red-500/10 text-red-600 text-xs text-center">{error}</div>}

        {/* Voice Button */}
        <div className="flex flex-col items-center gap-2">
          {(isListening || isSpeaking) && <div className="flex gap-2">{isListening && <Badge className="bg-red-500/20 text-red-600 text-xs">Listening</Badge>}{isSpeaking && <Badge className="bg-primary/20 text-primary text-xs">Speaking</Badge>}</div>}
          <button onClick={isListening ? stopListening : startListening} disabled={isProcessing || !selectedSubject} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 scale-110' : 'gradient-hero'} ${(!selectedSubject || isProcessing) && 'opacity-50'}`}>
            {isProcessing ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : isListening ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>
          <p className="text-xs text-muted-foreground">{isListening ? 'Tap to stop' : isProcessing ? 'Processing...' : selectedSubject ? 'Tap to speak' : 'Select subject'}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
