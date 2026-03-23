import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS, SUBJECT_ICONS, ALL_SUBJECTS } from '@/lib/subjects';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Loader2, Sparkles, Plus, Paperclip, Mic, MicOff, 
  X, FileText, ChevronDown, StopCircle, Volume2, VolumeX, Minimize2, Maximize2,
  MessageCircle, Image as ImageIcon
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

export default function FloatingAITutor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<MatricSubject | ''>('');
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; url: string; name: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

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
    id: `floating-tutor-${selectedSubject}`,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

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
        setInputValue(prev => transcript.trim() ? transcript : prev);
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
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  // Speak AI response
  useEffect(() => {
    if (messages.length > 0 && !isMuted) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && status === 'ready') {
        const text = getMessageText(lastMessage);
        if (text) speakText(text);
      }
    }
  }, [messages, status, isMuted]);

  const speakText = (text: string) => {
    if (isMuted) return;
    speechSynthesis.cancel();
    
    // Clean text for speech
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#+\s/g, '')
      .replace(/```[\s\S]*?```/g, 'code example')
      .replace(/`[^`]+`/g, match => match.slice(1, -1))
      .substring(0, 500);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || v.name.includes('Microsoft') || v.lang.startsWith('en')
    );
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubjectChange = (v: string) => {
    setSelectedSubject(v as MatricSubject);
    setMessages([]);
  };

  const handleNewChat = () => {
    setMessages([]);
    setAttachments([]);
    stopSpeaking();
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
    
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleSendMessage = async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || !selectedSubject || isLoading) return;
    
    const messageText = text.trim() || 'Please analyze the attached file(s)';
    sendMessage({ text: messageText });
    setInputValue('');
    setAttachments([]);
    
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  return (
    <>
      {/* Floating Bubble Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-gold shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
          >
            <MessageCircle className="w-6 h-6 text-secondary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? 'auto' : '600px',
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">AI Tutor</h3>
                  {isSpeaking && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Volume2 className="w-3 h-3 animate-pulse" /> Speaking...
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
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
                    <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>New Chat</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
                        {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isMinimized ? 'Expand' : 'Minimize'}</TooltipContent>
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
                <div className="px-4 py-2 border-b bg-muted/30">
                  <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a subject to start" />
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
                </div>

                {/* Messages */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                  style={{ minHeight: '300px' }}
                >
                  {/* Empty State */}
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center px-4">
                        {selectedSubject ? (
                          <>
                            <div className="text-4xl mb-3">{SUBJECT_ICONS[selectedSubject]}</div>
                            <h4 className="font-semibold mb-1">{SUBJECT_LABELS[selectedSubject]} Tutor</h4>
                            <p className="text-xs text-muted-foreground mb-4">
                              Upload homework, ask questions, or use voice input
                            </p>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {['Explain this concept', 'Help with homework', 'Practice questions'].map((s, i) => (
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
                            <div className="w-12 h-12 rounded-full gradient-navy mx-auto mb-3 flex items-center justify-center">
                              <Bot className="w-6 h-6 text-white" />
                            </div>
                            <h4 className="font-semibold mb-1">Choose a Subject</h4>
                            <p className="text-xs text-muted-foreground">
                              Select a subject above to get started
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
                      <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full gradient-gold flex items-center justify-center shrink-0">
                            <Bot className="w-3 h-3 text-secondary-foreground" />
                          </div>
                        )}
                        
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                          {images.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {images.map((img, i) => (
                                <img key={i} src={img} alt="Attachment" className="max-w-[100px] rounded border" />
                              ))}
                            </div>
                          )}
                          
                          <div className={`rounded-2xl px-3 py-2 text-sm ${
                            msg.role === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-xs max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2">
                                <ReactMarkdown>{content}</ReactMarkdown>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{content}</p>
                            )}
                          </div>
                        </div>
                        
                        {msg.role === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Loading */}
                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full gradient-gold flex items-center justify-center shrink-0">
                        <Bot className="w-3 h-3 text-secondary-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl px-3 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
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
                    className="absolute bottom-32 right-4 h-6 w-6 rounded-full shadow"
                    onClick={scrollToBottom}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                )}

                {/* Input Area */}
                <div className="border-t bg-card p-3">
                  {/* Attachments Preview */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {attachments.map((attachment, i) => (
                        <div 
                          key={i} 
                          className="relative group bg-muted rounded p-1.5 pr-6 flex items-center gap-1.5"
                        >
                          {attachment.type === 'image' ? (
                            <img src={attachment.url} alt={attachment.name} className="w-8 h-8 object-cover rounded" />
                          ) : (
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground max-w-16 truncate">
                            {attachment.name}
                          </span>
                          <button
                            onClick={() => removeAttachment(i)}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-1.5">
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
                            className="shrink-0 h-8 w-8"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!selectedSubject}
                          >
                            <Paperclip className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Upload homework or image</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Text Input */}
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedSubject ? 'Ask anything...' : 'Select a subject'}
                      disabled={!selectedSubject}
                      className="flex-1 min-h-[36px] max-h-[120px] resize-none border-0 focus-visible:ring-0 bg-muted/50 rounded-xl text-sm py-2 px-3"
                      rows={1}
                    />

                    {/* Voice Button */}
                    <TooltipProvider>
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
                        <TooltipContent>{isRecording ? 'Stop' : 'Voice input'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Send/Stop Button */}
                    {isLoading ? (
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => stop()}>
                        <StopCircle className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        className="shrink-0 h-8 w-8 rounded-full"
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!selectedSubject || (!inputValue.trim() && attachments.length === 0)}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Recording indicator */}
                  {isRecording && (
                    <Badge variant="destructive" className="gap-1 mt-2 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Listening...
                    </Badge>
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
