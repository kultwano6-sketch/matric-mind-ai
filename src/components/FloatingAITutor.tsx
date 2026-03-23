import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Loader2, Sparkles, Plus, Paperclip, Mic, MicOff, 
  X, FileText, ChevronDown, StopCircle, Volume2, VolumeX, Minimize2, Maximize2,
  MessageCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Database } from '@/integrations/supabase/types';

type MatricSubject = Database['public']['Enums']['matric_subject'];

// Memoized helper to extract text from UIMessage parts
const getMessageText = (message: UIMessage): string => {
  if (!message.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
};

// Memoized message component for better performance
const ChatMessage = memo(({ msg, isUser }: { msg: UIMessage; isUser: boolean }) => {
  const content = getMessageText(msg);
  
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full gradient-gold flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-secondary-foreground" />
        </div>
      )}
      
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div className={`rounded-2xl px-3 py-2 text-sm ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}>
          {!isUser ? (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
});
ChatMessage.displayName = 'ChatMessage';

export default function FloatingAITutor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>('');
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; url: string; name: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Muted by default for faster feel
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Create transport with subject
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
    id: `floating-tutor-${selectedSubject}`,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Initialize speech recognition - lazy load
  useEffect(() => {
    if (!isOpen) return;
    
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Single utterance for faster response
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
  }, [isOpen]);

  // Auto-scroll on new messages
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
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 80);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [inputValue]);

  // Text-to-speech for AI responses (only when enabled)
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
      .substring(0, 300); // Shorter for faster speech
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1; // Slightly faster
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

  const handleSubjectChange = useCallback((v: string) => {
    setSelectedSubject(v as MatricSubject);
    setMessages([]);
  }, [setMessages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setAttachments([]);
    stopSpeaking();
  }, [setMessages, stopSpeaking]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).slice(0, 3).forEach(file => { // Max 3 files
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setAttachments(prev => [...prev, {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url,
          name: file.name,
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
    
    const messageText = inputValue.trim() || 'Please analyze the attached file(s)';
    sendMessage({ text: messageText });
    setInputValue('');
    setAttachments([]);
    
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [inputValue, attachments, selectedSubject, isLoading, sendMessage, isRecording]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-gold shadow-lg flex items-center justify-center"
          >
            <MessageCircle className="w-6 h-6 text-secondary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, height: isMinimized ? 'auto' : '520px' }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b bg-card">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">AI Tutor</h3>
                  {isSpeaking && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Volume2 className="w-2.5 h-2.5 animate-pulse" /> Speaking
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => { isMuted ? setIsMuted(false) : (stopSpeaking(), setIsMuted(true)); }}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{isMuted ? 'Enable voice' : 'Mute'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">New chat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
                        {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{isMinimized ? 'Expand' : 'Minimize'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Subject Selector */}
                <div className="px-3 py-2 border-b bg-muted/20">
                  <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
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
                </div>

                {/* Messages */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
                >
                  {/* Empty State */}
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center py-8">
                      <div className="text-center px-4">
                        {selectedSubject ? (
                          <>
                            <div className="text-4xl mb-2">{SUBJECT_ICONS[selectedSubject]}</div>
                            <h4 className="font-semibold text-sm mb-1">{SUBJECT_LABELS[selectedSubject]}</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                              Ask questions or upload homework
                            </p>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {['Explain this', 'Help me solve', 'Practice questions'].map((s, i) => (
                                <Button
                                  key={i}
                                  variant="outline"
                                  size="sm"
                                  className="text-[10px] h-6 px-2"
                                  onClick={() => setInputValue(s)}
                                >
                                  {s}
                                </Button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full gradient-navy mx-auto mb-2 flex items-center justify-center">
                              <Bot className="w-6 h-6 text-white" />
                            </div>
                            <h4 className="font-semibold text-sm mb-1">Choose a Subject</h4>
                            <p className="text-xs text-muted-foreground">
                              Select above to start
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messages List */}
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} msg={msg} isUser={msg.role === 'user'} />
                  ))}

                  {/* Loading */}
                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full gradient-gold flex items-center justify-center shrink-0">
                        <Bot className="w-3.5 h-3.5 text-secondary-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl px-3 py-2 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-xs text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll Button */}
                {showScrollButton && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-28 right-3 h-6 w-6 rounded-full shadow"
                    onClick={scrollToBottom}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                )}

                {/* Input Area */}
                <div className="border-t bg-card p-2.5">
                  {/* Attachments */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {attachments.map((a, i) => (
                        <div key={i} className="relative group bg-muted rounded p-1.5 pr-6 flex items-center gap-1.5">
                          {a.type === 'image' ? (
                            <img src={a.url} alt={a.name} className="w-8 h-8 object-cover rounded" />
                          ) : (
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground max-w-16 truncate">{a.name}</span>
                          <button
                            onClick={() => removeAttachment(i)}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/80 opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-1.5">
                    {/* Attachment */}
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
                            className="shrink-0 h-8 w-8"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!selectedSubject}
                          >
                            <Paperclip className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Upload file</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Input */}
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedSubject ? 'Ask anything...' : 'Select a subject'}
                      disabled={!selectedSubject}
                      className="flex-1 min-h-[36px] max-h-[100px] resize-none border-0 focus-visible:ring-0 bg-muted/50 rounded-xl text-sm py-2 px-3"
                      rows={1}
                    />

                    {/* Voice */}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={isRecording ? 'destructive' : 'ghost'}
                            size="icon"
                            className={`shrink-0 h-8 w-8 ${isRecording ? 'animate-pulse' : ''}`}
                            onClick={toggleRecording}
                            disabled={!selectedSubject}
                          >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{isRecording ? 'Stop' : 'Voice'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Send/Stop */}
                    {isLoading ? (
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => stop()}>
                        <StopCircle className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        className="shrink-0 h-8 w-8 rounded-full"
                        onClick={handleSendMessage}
                        disabled={!selectedSubject || (!inputValue.trim() && attachments.length === 0)}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {isRecording && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-destructive">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                      Listening...
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
