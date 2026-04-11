// Tutor.tsx — AI Tutor with Subject Selection
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Send, Bot, User, Loader2, Sparkles, Trash2, 
  BookOpen, X, Plus, ArrowRight, GraduationCap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
type MatricSubject = Database['public']['Enums']['matric_subject'];

// Simple message type
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { label: 'Explain a concept', prompt: 'Explain this concept to me' },
  { label: 'Solve a problem', prompt: 'Can you help me solve a problem?' },
  { label: 'Practice quiz', prompt: 'Give me practice questions' },
  { label: 'Summarize topic', prompt: 'Summarize the key points' },
];

export default function Tutor() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSubject = searchParams.get('subject') as MatricSubject | null;
  
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | null>(initialSubject || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !selectedSubject) return;
    
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const loadingMessage: Message = {
      id: 'loading',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          subject: selectedSubject,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      
      setMessages(prev => {
        const withoutLoading = prev.filter(m => m.id !== 'loading');
        const aiMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'I could not generate a response. Please try again.',
          timestamp: new Date(),
        };
        return [...withoutLoading, aiMessage];
      });

      if (user) {
        await supabase.from('chat_messages').insert({
          session_id: 'tutor',
          role: 'user',
          content: text,
        });
        await supabase.from('chat_messages').insert({
          session_id: 'tutor',
          role: 'assistant',
          content: data.reply,
        });
      }
    } catch (err: any) {
      console.error('Tutor error:', err);
      setError(err.message || 'Failed to get response');
      setMessages(prev => prev.filter(m => m.id !== 'loading'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const changeSubject = () => {
    setSelectedSubject(null);
    setMessages([]);
  };

  // Subject selection screen
  if (!selectedSubject) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-purple-50/50 to-background dark:from-purple-950/20">
          {/* Header */}
          <div className="px-4 py-4 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">AI Tutor</h1>
                <p className="text-xs text-muted-foreground">Choose a subject to learn</p>
              </div>
            </div>
          </div>

          {/* Subject Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
              {ALL_SUBJECTS.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className="group p-4 rounded-xl border bg-background hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-left"
                >
                  <div className="text-2xl mb-2">{SUBJECT_ICONS[subject]}</div>
                  <div className="font-medium text-sm">{SUBJECT_LABELS[subject]}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Start learning <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentSubjectLabel = SUBJECT_LABELS[selectedSubject];
  const currentSubjectIcon = SUBJECT_ICONS[selectedSubject];

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">AI Tutor</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {currentSubjectIcon} {currentSubjectLabel}
              </span>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={changeSubject}
            className="gap-2 rounded-lg text-purple-500 border-purple-200 hover:bg-purple-50"
          >
            <BookOpen className="w-3 h-3" />
            Change Subject
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-muted/20 to-background">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 shadow-lg">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-lg font-semibold mb-1">{currentSubjectLabel} Tutor</h2>
              <p className="text-sm text-muted-foreground mb-4">
                I'm ready to help you learn {currentSubjectLabel}
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map(({ label, prompt }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full text-xs hover:border-purple-300"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`max-w-[75%] ${message.role === 'user' ? 'order-first' : ''}`}>
                {message.id === 'loading' ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground bg-muted rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                ) : (
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted border'
                  }`}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-background/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              onClick={clearChat}
              className="shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${currentSubjectLabel}...`}
              className="min-h-[44px] max-h-[100px] resize-none rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <Button 
              type="submit" 
              size="icon"
              disabled={isLoading || !input.trim()}
              className="shrink-0 rounded-lg bg-purple-500 hover:bg-purple-600"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}