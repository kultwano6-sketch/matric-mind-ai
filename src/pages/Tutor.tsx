import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { 
  Send, Bot, User, Loader2, Sparkles, Plus, Paperclip, Mic, MicOff, 
  X, Image as ImageIcon, FileText, ChevronDown, StopCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

// Helper to extract text from UIMessage parts
function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

// Get image parts from message
function getMessageImages(message: UIMessage): string[] {
  if (!message.parts || !Array.isArray(message.parts)) return [];
  return message.parts
    .filter((p): p is { type: 'image'; image: string } => p.type === 'image')
    .map((p) => p.image);
}

const QUICK_SUGGESTIONS = [
  'Explain this concept to me',
  'Help me solve this problem',
  'Give me practice questions',
  'Summarize the key points',
];

export default function Tutor() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>(
    (searchParams.get('subject') as MatricSubject) || ''
  );
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; url: string; name: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Create transport with subject in the request
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: '/api/tutor',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          subject: selectedSubject,
          attachments: attachments.map(a => ({ type: a.type, url: a.url })),
        },
      }),
    });
  }, [selectedSubject, attachments]);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
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

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputValue(prev => {
          // Only update if we have new content
          if (transcript.trim()) {
            return transcript;
          }
          return prev;
        });
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Auto-scroll and scroll button visibility
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const handleSubjectChange = (v: string) => {
    setSelectedSubject(v as MatricSubject);
    setMessages([]);
    setDbSessionId(null);
  };

  const handleNewChat = () => {
    setMessages([]);
    setDbSessionId(null);
    setAttachments([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const isImage = file.type.startsWith('image/');
        setAttachments(prev => [...prev, {
          type: isImage ? 'image' : 'file',
          url,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      setIsListening(true);
    }
  };

  const handleSendMessage = async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || !selectedSubject || isLoading) return;

    let sid = dbSessionId;
    if (!sid) {
      sid = await startNewSession();
      if (!sid) return;
    }

    // Build message with attachments
    const messageText = text.trim() || 'Please analyze the attached file(s)';
    
    // Send message via AI SDK
    sendMessage({ text: messageText });
    setInputValue('');
    setAttachments([]);
    
    // Stop recording if active
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleQuickSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col relative">
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AI Tutor</h1>
              {selectedSubject && (
                <p className="text-xs text-muted-foreground">{SUBJECT_LABELS[selectedSubject]}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedSubject} onValueChange={handleSubjectChange}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {ALL_SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span>{SUBJECT_ICONS[s]}</span>
                      <span>{SUBJECT_LABELS[s]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewChat}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        >
          {/* Empty State */}
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                {selectedSubject ? (
                  <>
                    <div className="text-6xl mb-6">{SUBJECT_ICONS[selectedSubject]}</div>
                    <h2 className="text-2xl font-display font-bold mb-3">
                      {SUBJECT_LABELS[selectedSubject]} Tutor
                    </h2>
                    <p className="text-muted-foreground mb-8">
                      Ask me anything about {SUBJECT_LABELS[selectedSubject]}. I can explain concepts, 
                      help solve problems, or review your homework.
                    </p>
                    
                    {/* Quick Suggestions */}
                    <div className="flex flex-wrap gap-2 justify-center">
                      {QUICK_SUGGESTIONS.map((suggestion, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleQuickSuggestion(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full gradient-navy mx-auto mb-6 flex items-center justify-center">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-display font-bold mb-3">
                      Choose a Subject
                    </h2>
                    <p className="text-muted-foreground">
                      Select a subject above to start chatting with your personal AI tutor
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const content = getMessageText(msg);
            const images = getMessageImages(msg);
            
            return (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
                
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  {/* Image attachments */}
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {images.map((img, i) => (
                        <img 
                          key={i} 
                          src={img} 
                          alt="Attachment" 
                          className="max-w-xs rounded-lg border"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Message content */}
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground ml-auto' 
                      : 'bg-muted'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3">
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{content}</p>
                    )}
                  </div>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-secondary-foreground" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-32 right-6 rounded-full shadow-lg"
            onClick={scrollToBottom}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        )}

        {/* Floating Input Bar */}
        <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 px-4">
          <Card className="max-w-3xl mx-auto shadow-lg border-2">
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="px-3 pt-3 flex flex-wrap gap-2">
                {attachments.map((attachment, i) => (
                  <div 
                    key={i} 
                    className="relative group bg-muted rounded-lg p-2 pr-8 flex items-center gap-2"
                  >
                    {attachment.type === 'image' ? (
                      <>
                        <img 
                          src={attachment.url} 
                          alt={attachment.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <span className="text-xs text-muted-foreground max-w-24 truncate">
                          {attachment.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground max-w-24 truncate">
                          {attachment.name}
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Input Area */}
            <div className="flex items-end gap-2 p-3">
              {/* Attachment Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-10 w-10"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedSubject}
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file or image</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Text Input */}
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedSubject 
                    ? `Message ${SUBJECT_LABELS[selectedSubject]} Tutor...` 
                    : 'Select a subject to start'
                }
                disabled={!selectedSubject}
                className="flex-1 min-h-[44px] max-h-[200px] resize-none border-0 focus-visible:ring-0 bg-transparent text-sm py-3"
                rows={1}
              />

              {/* Voice Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isRecording ? 'destructive' : 'ghost'}
                      size="icon"
                      className={`shrink-0 h-10 w-10 ${isRecording ? 'animate-pulse' : ''}`}
                      onClick={toggleRecording}
                      disabled={!selectedSubject}
                    >
                      {isRecording ? (
                        <MicOff className="w-5 h-5" />
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRecording ? 'Stop recording' : 'Voice input'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Send/Stop Button */}
              {isLoading ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => stop()}
                >
                  <StopCircle className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-full"
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!selectedSubject || (!inputValue.trim() && attachments.length === 0)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="px-3 pb-2">
                <Badge variant="destructive\" className="gap-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Listening...
                </Badge>
              </div>
            )}
          </Card>
          
          {/* Disclaimer */}
          <p className="text-center text-xs text-muted-foreground mt-2">
            AI can make mistakes. Always verify important information.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
