// Tutor.tsx — Premium Gold/Black AI Tutor with Dropdown Selection
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { 
  Send, Bot, User, Loader2, Sparkles, Trash2, 
  BookOpen, Crown, ChevronDown, Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

import { SUBJECT_LABELS, ALL_SUBJECTS } from '@/lib/subjects';
type MatricSubject = Database['public']['Enums']['matric_subject'];

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
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSubjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectSubject = (subject: MatricSubject) => {
    setSelectedSubject(subject);
    setShowSubjectDropdown(false);
    setMessages([]);
  };

  // No subject selected yet - sleek selector
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

          {/* Main selector */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-md">
              <h2 className="text-2xl font-bold text-white text-center mb-2">Welcome back</h2>
              <p className="text-white/50 text-center mb-8">Choose a subject to start learning</p>

              {/* Custom Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
                  className="w-full p-4 rounded-2xl border border-white/20 bg-white/5 text-white flex items-center justify-between hover:border-amber-500/50 transition-all"
                >
                  <span className="text-white/70">
                    {selectedSubject ? SUBJECT_LABELS[selectedSubject] : 'Select your subject...'}
                  </span>
                  <ChevronDown className={cn(
                    "w-5 h-5 text-white/50 transition-transform",
                    showSubjectDropdown && "rotate-180"
                  )} />
                </button>

                {/* Dropdown menu */}
                {showSubjectDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/20 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                    {ALL_SUBJECTS.map(subject => (
                      <button
                        key={subject}
                        onClick={() => selectSubject(subject)}
                        className="w-full px-4 py-3 text-left text-white/80 hover:bg-white/10 hover:text-white flex items-center justify-between transition-colors border-b border-white/5 last:border-0"
                      >
                        <span>{SUBJECT_LABELS[subject]}</span>
                        {selectedSubject === subject && (
                          <Check className="w-4 h-4 text-amber-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Start button */}
              {selectedSubject && (
                <button
                  onClick={() => {}}
                  className="w-full mt-6 p-4 rounded-2xl gradient-gold text-black font-semibold flex items-center justify-center gap-2 animate-pulse"
                >
                  Start Learning {selectedSubject}
                </button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentSubjectLabel = SUBJECT_LABELS[selectedSubject];

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
              <span className="text-xs text-white/50 block">{currentSubjectLabel}</span>
            </div>
          </div>

          {/* Subject dropdown in chat view */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white text-sm hover:border-amber-500/50 transition-all"
            >
              <span>{currentSubjectLabel}</span>
              <ChevronDown className="w-3 h-3 text-white/50" />
            </button>

            {showSubjectDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-white/20 rounded-xl overflow-hidden shadow-2xl z-50 max-h-[250px] overflow-y-auto">
                {ALL_SUBJECTS.map(subject => (
                  <button
                    key={subject}
                    onClick={() => selectSubject(subject)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors",
                      subject === selectedSubject 
                        ? "bg-amber-500/20 text-amber-400" 
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {SUBJECT_LABELS[subject]}
                  </button>
                ))}
              </div>
            )}
          </div>
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