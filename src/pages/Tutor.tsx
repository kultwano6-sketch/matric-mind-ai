import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Loader2, Sparkles, Plus, Paperclip, Mic, MicOff, 
  X, FileText, ChevronDown, StopCircle, Volume2, VolumeX, MessageSquare,
  Clock, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];
type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

// Message type stored in DB (mirrors UIMessage parts)
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: UIMessage['parts'];
}

// Helper to extract text from UIMessage parts
const getMessageText = (message: UIMessage): string => {
  if (!message.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
};

// Get image parts from message
const getMessageImages = (message: UIMessage): string[] => {
  if (!message.parts || !Array.isArray(message.parts)) return [];
  return message.parts
    .filter((p): p is { type: 'image'; image: string } => p.type === 'image')
    .map((p) => p.image);
};

const QUICK_SUGGESTIONS = [
  { text: 'Explain this concept', icon: '💡' },
  { text: 'Help me solve this problem', icon: '🧮' },
  { text: 'Give me practice questions', icon: '📝' },
  { text: 'Summarize key points', icon: '📋' },
];

// Memoized message component
const ChatMessage = memo(({ msg, isLast }: { msg: UIMessage; isLast: boolean }) => {
  const content = getMessageText(msg);
  const images = getMessageImages(msg);
  const isUser = msg.role === 'user';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-secondary-foreground" />
        </div>
      )}
      
      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img, i) => (
              <img key={i} src={img} alt="Attachment" className="max-w-[180px] rounded-lg border shadow-sm" />
            ))}
          </div>
        )}
        
        <div className={`rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-muted to-muted/80 border border-border/50'
        }`}>
          {!isUser ? (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
    </motion.div>
  );
});
ChatMessage.displayName = 'ChatMessage';

// Format session timestamp to friendly label
const formatSessionTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
};

export default function Tutor() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>(
    (searchParams.get('subject') as MatricSubject) || ''
  );
  const autoPrompt = searchParams.get('prompt') || '';
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; url: string; name: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const prevMessagesLengthRef = useRef(0);

  // Transport with subject
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

  // Auto-send prompt from URL params (e.g. from StudyNotes "Ask AI Tutor" button)
  const autoSentRef = useRef(false);
  const sendMessageRef = useRef(sendMessage);
  
  // Keep sendMessage ref updated without triggering re-renders
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);
  
  useEffect(() => {
    // Check conditions for auto-send
    if (!autoPrompt || !selectedSubject || autoSentRef.current || isLoading) return;
    if (messages.length > 0) return;
    
    // Mark as sent to prevent duplicates
    autoSentRef.current = true;
    
    const timer = setTimeout(async () => {
      // Create a new session first if needed
      if (!dbSessionId && user) {
        try {
          const { data } = await supabase
            .from('chat_sessions')
            .insert({ student_id: user.id, subject: selectedSubject })
            .select()
            .single();
          if (data) {
            setDbSessionId(data.id);
            prevMessagesLengthRef.current = 0;
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
          }
        } catch (error) {
          console.error('Failed to create session:', error);
        }
      }
      
      // Use the ref to avoid dependency issues
      sendMessageRef.current({ text: autoPrompt });
    }, 400);
    
    return () => clearTimeout(timer);
  }, [autoPrompt, selectedSubject, isLoading, messages.length, dbSessionId, user, queryClient]);

  // Fetch student profile
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch chat sessions for current subject
  const { data: chatSessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['chat-sessions', user?.id, selectedSubject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('student_id', user!.id)
        .eq('subject', selectedSubject as MatricSubject)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as ChatSession[];
    },
    enabled: !!user && !!selectedSubject,
  });

  // Save messages to DB when they change (after assistant finishes)
  useEffect(() => {
    if (!dbSessionId || messages.length === 0) return;
    // Only save after assistant finishes streaming and we have new messages
    if (status !== 'ready') return;
    if (messages.length <= prevMessagesLengthRef.current) return;
    prevMessagesLengthRef.current = messages.length;

    const saveMessages = async () => {
      // Convert UIMessages to storable format and save
      const messagesToSave: StoredMessage[] = messages.map(m => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
      }));

      await supabase
        .from('chat_messages')
        .upsert(
          {
            session_id: dbSessionId,
            content: JSON.stringify(messagesToSave),
            role: 'system', // marker that this row contains the full conversation
          },
          { onConflict: 'session_id' }
        );

      // Generate title from first user message if this is a new session
      const firstUserMsg = messages.find(m => m.role === 'user');
      const msgText = firstUserMsg?.parts
        ?.filter(p => p.type === 'text')
        .map(p => (p as { type: 'text'; text: string }).text)
        .join('') || '';
      const title = msgText.substring(0, 50) + (msgText.length > 50 ? '...' : '');

      // Update session with updated_at
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', dbSessionId);

      refetchSessions();
    };

    saveMessages();
  }, [messages, status, dbSessionId, refetchSessions]);

  // Load messages from a selected session
  const loadSession = useCallback(async (session: ChatSession) => {
    setLoadingSession(true);
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('content')
        .eq('session_id', session.id)
        .maybeSingle();

      setDbSessionId(session.id);
      
      if (data?.content) {
        try {
          const parsed = JSON.parse(data.content) as StoredMessage[];
          const uiMessages: UIMessage[] = parsed.map(m => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
          }));
          setMessages(prev => uiMessages);
          prevMessagesLengthRef.current = uiMessages.length;
        } catch {
          setMessages(prev => []);
          prevMessagesLengthRef.current = 0;
        }
      } else {
        setMessages(prev => []);
        prevMessagesLengthRef.current = 0;
      }
    } finally {
      setLoadingSession(false);
    }
  }, [setMessages]);

  // Delete a chat session
  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Delete messages first, then session
    await supabase.from('chat_messages').delete().eq('session_id', sessionId);
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    
    if (dbSessionId === sessionId) {
      setDbSessionId(null);
      setMessages(prev => []);
      prevMessagesLengthRef.current = 0;
    }
    
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
  }, [dbSessionId, setMessages, queryClient]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInputValue(transcript);
      };
      
      recognitionRef.current.onend = () => setIsRecording(false);
      recognitionRef.current.onerror = () => setIsRecording(false);
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      speechSynthesis.cancel();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, status]);

  // Scroll detection
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [inputValue]);

  // Text-to-speech
  useEffect(() => {
    if (isMuted || status !== 'ready' || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;
    
    const text = getMessageText(lastMessage);
    if (!text) return;
    
    speechSynthesis.cancel();
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#+\s/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, match => match.slice(1, -1))
      .substring(0, 400);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    speechSynthesis.speak(utterance);
  }, [messages, status, isMuted]);

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const startNewSession = useCallback(async () => {
    if (!selectedSubject || !user) return null;
    const { data } = await supabase
      .from('chat_sessions')
      .insert({ student_id: user.id, subject: selectedSubject })
      .select()
      .single();
    if (data) {
      setDbSessionId(data.id);
      prevMessagesLengthRef.current = 0;
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      return data.id;
    }
    return null;
  }, [selectedSubject, user, queryClient]);

  const handleSubjectChange = useCallback((v: string) => {
    setSelectedSubject(v as MatricSubject);
    setMessages(prev => []);
    setDbSessionId(null);
    prevMessagesLengthRef.current = 0;
    autoSentRef.current = false; // Reset auto-send flag when subject changes
    stopSpeaking();
  }, [setMessages, stopSpeaking]);

  const handleNewChat = useCallback(() => {
    setMessages(prev => []);
    setDbSessionId(null);
    prevMessagesLengthRef.current = 0;
    setAttachments([]);
    autoSentRef.current = false; // Reset auto-send flag for new chat
    stopSpeaking();
  }, [setMessages, stopSpeaking]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).slice(0, 5).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setAttachments(prev => [...prev, { 
          type: file.type.startsWith('image/') ? 'image' : 'file', 
          url, 
          name: file.name 
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  const handleSendMessage = useCallback(async () => {
    if ((!inputValue.trim() && attachments.length === 0) || !selectedSubject || isLoading) return;

    let sid = dbSessionId;
    if (!sid) {
      sid = await startNewSession();
      if (!sid) return;
    }

    const messageText = inputValue.trim() || 'Please analyze the attached file(s)';
    sendMessage({ text: messageText });
    setInputValue('');
    setAttachments([]);
    
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [inputValue, attachments, selectedSubject, isLoading, dbSessionId, startNewSession, sendMessage, isRecording]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const firstName = studentProfile?.full_name?.split(' ')[0];

  // Get first message text as a session preview
  const getSessionPreview = (session: ChatSession): string => {
    const date = new Date(session.created_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
    const subject = SUBJECT_LABELS[session.subject as MatricSubject] || 'Chat';
    return `${subject} - ${date}`;
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Session Sidebar */}
        <AnimatePresence>
          {sidebarOpen && selectedSubject && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full border-r bg-card/50 backdrop-blur-sm shrink-0 overflow-visible"
            >
              <div className="flex flex-col h-full w-[280px]">
                {/* Sidebar Header */}
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">History</span>
                    {chatSessions.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {chatSessions.length}
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(false)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>

                {/* New Chat Button */}
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={handleNewChat}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Chat
                  </Button>
                </div>

                {/* Sessions List */}
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {chatSessions.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-xs text-muted-foreground">No chat history yet</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">Start a conversation!</p>
                      </div>
                    ) : (
                      chatSessions.map((session) => (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="group"
                        >
                          <Card
                            className={`p-2.5 cursor-pointer transition-all hover:bg-muted/70 border-transparent ${
                              dbSessionId === session.id ? 'bg-muted border-primary/30 shadow-sm' : ''
                            }`}
                            onClick={() => loadSession(session)}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">
                                  {getSessionPreview(session)}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatSessionTime(session.updated_at)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => deleteSession(session.id, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages Area */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto relative" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {loadingSession && (
              <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading conversation...
                </div>
              </div>
            )}
            <div className="max-w-3xl mx-auto px-4 py-6">
              {/* Empty State */}
              <AnimatePresence mode="wait">
                {messages.length === 0 && !loadingSession && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="min-h-[55vh] flex items-center justify-center"
                  >
                    <div className="text-center max-w-lg">
                      {selectedSubject ? (
                        <>
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.1 }}
                            className="text-6xl mb-4"
                          >
                            {SUBJECT_ICONS[selectedSubject]}
                          </motion.div>
                          <h2 className="text-2xl font-display font-bold mb-2">
                            {SUBJECT_LABELS[selectedSubject]}
                          </h2>
                          <p className="text-muted-foreground mb-6">
                            Upload homework, ask questions, or use voice input
                          </p>
                          
                          <div className="grid grid-cols-2 gap-3">
                            {QUICK_SUGGESTIONS.map((s, i) => (
                              <motion.button
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + i * 0.04 }}
                                onClick={() => setInputValue(s.text)}
                                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-border/50 bg-gradient-to-br from-card to-muted/30 hover:border-primary/50 hover:from-primary/5 hover:to-accent/5 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 text-left text-sm group"
                              >
                                <span className="text-xl group-hover:scale-110 transition-transform">{s.icon}</span>
                                <span className="font-medium group-hover:text-primary transition-colors">{s.text}</span>
                              </motion.button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.1 }}
                            className="w-20 h-20 rounded-2xl gradient-navy mx-auto mb-5 flex items-center justify-center"
                          >
                            <Sparkles className="w-10 h-10 text-white" />
                          </motion.div>
                          <h2 className="text-2xl font-display font-bold mb-2">
                            {firstName ? `Hi, ${firstName}!` : 'Hi there!'}
                          </h2>
                          <p className="text-muted-foreground mb-6">
                            Select a subject to start learning
                          </p>
                          
                          <div className="grid grid-cols-3 gap-3">
                            {ALL_SUBJECTS.slice(0, 9).map((s, i) => (
                              <motion.button
                                key={s}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.15 + i * 0.025 }}
                                onClick={() => setSelectedSubject(s)}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-border/30 bg-gradient-to-br from-card to-muted/20 hover:border-primary/50 hover:from-primary/5 hover:to-accent/5 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-200 group"
                              >
                                <span className="text-3xl group-hover:scale-110 transition-transform">{SUBJECT_ICONS[s]}</span>
                                <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors line-clamp-1">{SUBJECT_LABELS[s]}</span>
                              </motion.button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="space-y-5">
                {messages.map((msg, i) => (
                  <ChatMessage key={msg.id} msg={msg} isLast={i === messages.length - 1} />
                ))}
              </div>

              {/* Fast typing indicator */}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-3 mt-5"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-1.5">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Scroll button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-36 left-1/2 -translate-x-1/2"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-lg gap-1.5"
                  onClick={scrollToBottom}
                >
                  <ChevronDown className="w-4 h-4" />
                  Scroll down
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Bar */}
          <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-4 px-4">
            <div className="max-w-3xl mx-auto">
              {/* Controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Sidebar toggle */}
                  {selectedSubject && !sidebarOpen && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setSidebarOpen(true)}>
                      <MessageSquare className="w-3.5 h-3.5" />
                      History
                      {chatSessions.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                          {chatSessions.length}
                        </Badge>
                      )}
                    </Button>
                  )}
                  
                  <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                    <SelectTrigger className="w-[180px] h-8 text-xs border-dashed">
                      <SelectValue placeholder="Choose subject..." />
                    </SelectTrigger>
                    <SelectContent className="">
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
                  
                  {selectedSubject && messages.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={handleNewChat}>
                      <Plus className="w-3 h-3" />
                      New
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => { 
                            if (isMuted) setIsMuted(false); 
                            else { stopSpeaking(); setIsMuted(true); }
                          }}
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isMuted ? 'Enable voice' : 'Mute'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {isSpeaking && (
                    <Badge variant="outline" className="gap-1 text-[10px] h-6">
                      <Volume2 className="w-3 h-3 animate-pulse" />
                      Speaking
                      <button onClick={stopSpeaking} className="ml-1 hover:opacity-70">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Input Card */}
              <div className="rounded-2xl border-2 bg-card shadow-lg overflow-visible">
                {/* Attachments */}
                <AnimatePresence>
                  {attachments.length > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pt-3 flex flex-wrap gap-2"
                    >
                      {attachments.map((a, i) => (
                        <motion.div 
                          key={i}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="relative group bg-muted rounded-lg p-2 pr-8 flex items-center gap-2"
                        >
                          {a.type === 'image' ? (
                            <img src={a.url} alt={a.name} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-background rounded flex items-center justify-center">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground max-w-24 truncate">{a.name}</span>
                          <button
                            onClick={() => removeAttachment(i)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Input Row */}
                <div className="flex items-end gap-2 p-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!selectedSubject}
                        >
                          <Paperclip className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Upload file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedSubject ? `Ask about ${SUBJECT_LABELS[selectedSubject]}...` : 'Select a subject first'}
                    disabled={!selectedSubject}
                    className="flex-1 min-h-[44px]  resize-none border-2 border-border/30 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background/80 backdrop-blur-sm text-sm py-3 transition-all"
                    rows={1}
                  />

                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isRecording ? 'destructive' : 'ghost'}
                          size="icon"
                          className={`shrink-0 h-10 w-10 rounded-xl ${isRecording ? 'animate-pulse' : ''}`}
                          onClick={toggleRecording}
                          disabled={!selectedSubject}
                        >
                          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isRecording ? 'Stop' : 'Voice input'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {isLoading ? (
                    <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all" onClick={() => stop()}>
                      <StopCircle className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all"
                      onClick={handleSendMessage}
                      disabled={!selectedSubject || (!inputValue.trim() && attachments.length === 0)}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                {/* Recording indicator */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-2"
                    >
                      <Badge variant="destructive" className="gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        Listening...
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                AI can make mistakes. Always verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
