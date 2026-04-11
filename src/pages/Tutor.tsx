// Tutor.tsx — Premium Gold/Black AI Tutor
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, Bot, User, Loader2, Sparkles, Trash2, 
  BookOpen, ArrowRight, Crown,
  Calculator, Atom, Dna, Globe, FileText, TrendingUp, 
  Landmark, Briefcase, Map, Clock, Heart, Languages
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

import { SUBJECT_LABELS, ALL_SUBJECTS } from '@/lib/subjects';
type MatricSubject = Database['public']['Enums']['matric_subject'];

// Map subjects to icons
const SUBJECT_ICONS: Record<MatricSubject, React.ReactNode> = {
  mathematics: <Calculator className="w-6 h-6" />,
  mathematical_literacy: <TrendingUp className="w-6 h-6" />,
  physical_sciences: <Atom className="w-6 h-6" />,
  life_sciences: <Dna className="w-6 h-6" />,
  agricultural_sciences: <Map className="w-6 h-6" />,
  accounting: <Landmark className="w-6 h-6" />,
  business_studies: <Briefcase className="w-6 h-6" />,
  economics: <TrendingUp className="w-6 h-6" />,
  geography: <Globe className="w-6 h-6" />,
  history: <Clock className="w-6 h-6" />,
  life_orientation: <Heart className="w-6 h-6" />,
  english_home_language: <Languages className="w-6 h-6" />,
  english_first_additional: <Languages className="w-6 h-6" />,
  afrikaans_home_language: <Languages className="w-6 h-6" />,
  afrikaans_first_additional: <Languages className="w-6 h-6" />,
  isizulu_home_language: <Languages className="w-6 h-6" />,
  isizulu_first_additional: <Languages className="w-6 h-6" />,
  isixhosa_home_language: <Languages className="w-6 h-6" />,
  isixhosa_first_additional: <Languages className="w-6 h-6" />,
  sepedi_home_language: <Languages className="w-6 h-6" />,
  sepedi_first_additional: <Languages className="w-6 h-6" />,
  setswana_home_language: <Languages className="w-6 h-6" />,
  setswana_first_additional: <Languages className="w-6 h-6" />,
  sesotho_home_language: <Languages className="w-6 h-6" />,
  sesotho_first_additional: <Languages className="w-6 h-6" />,
  xitsonga_home_language: <Languages className="w-6 h-6" />,
  xitsonga_first_additional: <Languages className="w-6 h-6" />,
  tshivenda_home_language: <Languages className="w-6 h-6" />,
  tshivenda_first_additional: <Languages className="w-6 h-6" />,
  isindebele_home_language: <Languages className="w-6 h-6" />,
  isindebele_first_additional: <Languages className="w-6 h-6" />,
  sepedi_home_language: <Languages className="w-6 h-6" />,
  technology: <Atom className="w-6 h-6" />,
  computer_applications_technology: <FileText className="w-6 h-6" />,
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Explain a concept',
  'Solve a problem', 
  'Practice questions',
  'Summarize key points',
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

  // Subject selection screen - Premium Gold/Black
  if (!selectedSubject) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
          {/* Header */}
          <div className="px-4 py-6 border-b border-white/5 bg-black/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-white">AI Tutor</h1>
                <p className="text-xs text-white/50">Premium learning experience</p>
              </div>
            </div>
          </div>

          {/* Welcome text */}
          <div className="px-6 pt-8 pb-4">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-white/50">Select a subject to begin your tutoring session</p>
          </div>

          {/* Subject Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {ALL_SUBJECTS.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className="group p-4 rounded-2xl border border-white/10 bg-white/5 hover:gradient-gold hover:border-transparent hover:bg-gradient-to-br hover:from-amber-500 hover:to-orange-500 transition-all duration-300 text-left"
                >
                  <div className="text-white/70 group-hover:text-black mb-2">{SUBJECT_ICONS[subject]}</div>
                  <div className="font-semibold text-sm text-white group-hover:text-black">{SUBJECT_LABELS[subject]}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-white/50 group-hover:text-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="font-semibold text-white">AI Tutor</span>
              <span className="text-xs text-white/50 block flex items-center gap-1">
                {currentSubjectIcon} {currentSubjectLabel}
              </span>
            </div>
          </div>

          <Button 
            variant="ghost"
            size="sm"
            onClick={changeSubject}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Change
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 rounded-3xl gradient-gold flex items-center justify-center mb-6 shadow-xl shadow-amber-500/20">
                <Sparkles className="w-10 h-10 text-black" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{currentSubjectLabel}</h2>
              <p className="text-sm text-white/50 mb-6 max-w-xs">
                I'm ready to help you master {currentSubjectLabel}. What would you like to learn?
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="px-4 py-2 rounded-full border border-white/20 bg-white/5 text-white/80 text-sm hover:bg-white/10 hover:border-amber-500/50 hover:text-amber-400 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-black" />
                </div>
              )}

              <div className={`max-w-[75%] ${message.role === 'user' ? 'order-first' : ''}`}>
                {message.id === 'loading' ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-black/30 text-white/60 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                ) : (
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'gradient-gold text-black' 
                      : 'bg-white/10 border border-white/10 text-white'
                  }`}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none prose-invert">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-black" />
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/5 bg-black/30">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              onClick={clearChat}
              className="shrink-0 text-white/40 hover:text-white hover:bg-white/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${currentSubjectLabel}...`}
              className="min-h-[44px] max-h-[100px] resize-none rounded-2xl bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-amber-500/50"
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
              className="shrink-0 rounded-2xl gradient-gold hover:opacity-90"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Send className="w-4 h-4 text-black" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}