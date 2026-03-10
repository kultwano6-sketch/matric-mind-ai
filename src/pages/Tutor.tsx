import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS } from '@/lib/subjects';
import { Send, Bot, User, Loader2, Sparkles, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];
type Msg = { role: 'user' | 'assistant'; content: string };

const EXPLANATION_STYLES = [
  { label: 'Simple', prompt: 'Explain simply, like talking to a friend.' },
  { label: 'Step-by-step', prompt: 'Break it down step by step with numbered steps.' },
  { label: 'With examples', prompt: 'Use real-world examples to explain.' },
];

export default function Tutor() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>(
    (searchParams.get('subject') as MatricSubject) || ''
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [style, setStyle] = useState(EXPLANATION_STYLES[0].label);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Load existing sessions
  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions', user?.id, selectedSubject],
    queryFn: async () => {
      if (!selectedSubject) return [];
      const { data } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('student_id', user!.id)
        .eq('subject', selectedSubject)
        .order('updated_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user && !!selectedSubject,
  });

  const subjects = (studentProfile?.subjects as MatricSubject[]) || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load session messages when session changes
  useEffect(() => {
    if (!sessionId) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (data) {
        setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
      }
    };
    loadMessages();
  }, [sessionId]);

  const startNewSession = async () => {
    if (!selectedSubject || !user) return null;
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ student_id: user.id, subject: selectedSubject })
      .select()
      .single();
    if (data) {
      setSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      return data.id;
    }
    return null;
  };

  const saveMessage = async (sid: string, role: string, content: string) => {
    await supabase.from('chat_messages').insert({ session_id: sid, role, content });
    await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sid);
  };

  const handleSubjectChange = (v: string) => {
    setSelectedSubject(v as MatricSubject);
    setMessages([]);
    setSessionId(null);
  };

  const loadSession = (sid: string) => {
    setSessionId(sid);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedSubject || isLoading) return;

    let sid = sessionId;
    if (!sid) {
      sid = await startNewSession();
      if (!sid) return;
    }

    const userMsg: Msg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Save user message
    await saveMessage(sid, 'user', userMsg.content);

    const stylePrompt = EXPLANATION_STYLES.find(s => s.label === style)?.prompt || '';
    const allMessages = [...messages, userMsg];

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, subject: selectedSubject, stylePrompt }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          const msg = "I'm a bit busy right now. Please try again in a moment! 🙏";
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          await saveMessage(sid, 'assistant', msg);
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to get response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantSoFar = '';
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save complete assistant message
      if (assistantSoFar) {
        await saveMessage(sid, 'assistant', assistantSoFar);
      }
    } catch (err) {
      console.error(err);
      const errorMsg = 'Sorry, I had trouble connecting. Please try again! 😊';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      await saveMessage(sid, 'assistant', errorMsg);
    }

    setIsLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-display font-bold">AI Tutor</h1>
          </div>
          <Select value={selectedSubject} onValueChange={handleSubjectChange}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(s => (
                <SelectItem key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPLANATION_STYLES.map(s => (
                <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSubject && (
            <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setSessionId(null); }}>
              New Chat
            </Button>
          )}
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Session history sidebar */}
          {sessions && sessions.length > 0 && (
            <div className="hidden lg:flex flex-col w-48 shrink-0 space-y-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-medium px-2 mb-1 flex items-center gap-1">
                <History className="w-3 h-3" /> Past Sessions
              </p>
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`text-left text-xs p-2 rounded-lg transition-colors truncate ${
                    sessionId === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {new Date(s.updated_at).toLocaleDateString()} {new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}

          {/* Chat Area */}
          <Card className="flex-1 glass-card overflow-hidden flex flex-col">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && selectedSubject && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="text-5xl mb-4">{SUBJECT_ICONS[selectedSubject]}</div>
                    <h2 className="text-lg font-display font-semibold mb-2">
                      {SUBJECT_LABELS[selectedSubject]} Tutor
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Ask me anything about {SUBJECT_LABELS[selectedSubject]}! I'll explain concepts, work through examples, and help you prepare for your matric exams. 🎓
                    </p>
                  </div>
                </div>
              )}
              {!selectedSubject && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a subject to start chatting with your AI tutor
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t">
              <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={selectedSubject ? `Ask about ${SUBJECT_LABELS[selectedSubject]}...` : 'Select a subject first'}
                  disabled={!selectedSubject || isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={!selectedSubject || !input.trim() || isLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
