import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { Send, Bot, User, Loader2, Sparkles, History, BookOpen, Lightbulb, HelpCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

const EXPLANATION_STYLES = [
  { label: 'Simple', prompt: 'Explain simply, like talking to a friend.' },
  { label: 'Step-by-step', prompt: 'Break it down step by step with numbered steps.' },
  { label: 'With examples', prompt: 'Use real-world examples to explain.' },
];

const QUICK_PROMPTS = [
  { icon: BookOpen, text: 'Explain the key concepts' },
  { icon: Lightbulb, text: 'Give me a practice problem' },
  { icon: HelpCircle, text: 'I need help understanding...' },
];

// Helper to extract text from UIMessage parts
function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function Tutor() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>(
    (searchParams.get('subject') as MatricSubject) || ''
  );
  const [inputValue, setInputValue] = useState('');
  const [style, setStyle] = useState(EXPLANATION_STYLES[0].label);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create transport with subject and style in the request
  const transport = useMemo(() => {
    const stylePrompt = EXPLANATION_STYLES.find(s => s.label === style)?.prompt || '';
    return new DefaultChatTransport({
      api: '/api/tutor',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          subject: selectedSubject,
          stylePrompt,
        },
      }),
    });
  }, [selectedSubject, style]);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    id: `tutor-${selectedSubject}`,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

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

  // Show ALL subjects with AI tutors, not just student's enrolled subjects
  const subjects = ALL_SUBJECTS;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to database when they change
  useEffect(() => {
    if (!dbSessionId || messages.length === 0) return;
    
    const saveMessages = async () => {
      // Get the last message
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;
      
      const content = getMessageText(lastMessage);
      if (!content) return;

      // Only save complete assistant messages
      if (lastMessage.role === 'assistant' && status === 'ready') {
        await supabase.from('chat_messages').upsert({
          session_id: dbSessionId,
          role: lastMessage.role,
          content,
        }, { onConflict: 'session_id,role,content' });
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', dbSessionId);
      }
    };
    
    saveMessages();
  }, [messages, dbSessionId, status]);

  // Load session messages when session changes
  useEffect(() => {
    if (!dbSessionId) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', dbSessionId)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        // Convert DB messages to UIMessage format
        const uiMessages: UIMessage[] = data.map((m, i) => ({
          id: `db-${m.id || i}`,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        }));
        setMessages(uiMessages);
      }
    };
    loadMessages();
  }, [dbSessionId, setMessages]);

  const startNewSession = async () => {
    if (!selectedSubject || !user) return null;
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ student_id: user.id, subject: selectedSubject })
      .select()
      .single();
    if (data) {
      setDbSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      return data.id;
    }
    return null;
  };

  const saveUserMessage = async (sid: string, content: string) => {
    await supabase.from('chat_messages').insert({ session_id: sid, role: 'user', content });
  };

  const handleSubjectChange = (v: string) => {
    setSelectedSubject(v as MatricSubject);
    setMessages([]);
    setDbSessionId(null);
  };

  const loadSession = (sid: string) => {
    setDbSessionId(sid);
  };

  const handleNewChat = () => {
    setMessages([]);
    setDbSessionId(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !selectedSubject || isLoading) return;

    let sid = dbSessionId;
    if (!sid) {
      sid = await startNewSession();
      if (!sid) return;
    }

    // Save user message to database
    await saveUserMessage(sid, text);

    // Send message via AI SDK
    sendMessage({ text });
    setInputValue('');
  };

  const handleQuickPrompt = (promptText: string) => {
    if (selectedSubject) {
      const fullPrompt = `${promptText} about ${SUBJECT_LABELS[selectedSubject]}`;
      handleSendMessage(fullPrompt);
    }
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
            <Button variant="ghost" size="sm" onClick={handleNewChat}>
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
                    dbSessionId === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
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
                    <p className="text-muted-foreground text-sm mb-6">
                      I'm your personal AI tutor for {SUBJECT_LABELS[selectedSubject]}. Ask me anything - I'll explain concepts, work through problems, and help you prepare for your matric exams!
                    </p>
                    
                    {/* Quick prompts */}
                    <div className="flex flex-wrap gap-2 justify-center">
                      {QUICK_PROMPTS.map((prompt, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleQuickPrompt(prompt.text)}
                        >
                          <prompt.icon className="w-4 h-4" />
                          {prompt.text}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!selectedSubject && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a subject to start chatting with your AI tutor
                </div>
              )}
              {messages.map((msg) => {
                const content = getMessageText(msg);
                return (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                          <ReactMarkdown>{content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
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
              <form onSubmit={e => { e.preventDefault(); handleSendMessage(inputValue); }} className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={selectedSubject ? `Ask about ${SUBJECT_LABELS[selectedSubject]}...` : 'Select a subject first'}
                  disabled={!selectedSubject || isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={!selectedSubject || !inputValue.trim() || isLoading}>
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
