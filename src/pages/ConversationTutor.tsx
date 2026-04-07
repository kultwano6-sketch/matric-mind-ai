// ============================================================
// Matric Mind AI - Conversation Tutor Page
// Full conversation mode with AI tutor
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Plus, Sparkles, Lightbulb, ArrowDown, MessageCircle,
  History, Trash2, RefreshCw,
} from 'lucide-react';
import ConversationBubble from '@/components/ConversationBubble';
import {
  startConversation,
  sendMessage,
  getAllConversations,
  deleteConversation,
  formatSessionPreview,
  type ConversationSession,
  type ConversationMessage,
} from '@/services/conversation';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { ALL_SUBJECTS, SUBJECT_LABELS } from '@/lib/subjects';

const QUICK_ACTIONS = [
  { label: 'Explain simpler', icon: '🔍', prompt: 'Can you explain that in simpler terms?' },
  { label: 'Give me an example', icon: '📝', prompt: 'Can you give me a practical example of this?' },
  { label: 'Go deeper', icon: '🏊', prompt: 'Can you go deeper into this topic?' },
  { label: 'Why is this important?', icon: '❓', prompt: 'Why is this important to understand?' },
];

export default function ConversationTutor() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history
  useEffect(() => {
    if (user?.id) {
      const all = getAllConversations(user.id);
      setConversations(all);
    }
  }, [user?.id, sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleStartConversation = async () => {
    if (!user?.id || !subject) return;

    setLoading(true);
    try {
      const session = await startConversation(user.id, subject);
      setSessionId(session.id);
      setMessages(session.messages);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to start conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputMessage.trim();
    if (!messageText || !sessionId || !user?.id) return;

    // Add user message immediately
    const userMessage: ConversationMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setTyping(true);

    try {
      const result = await sendMessage(sessionId, messageText, user.id, subject);
      setMessages(result.session.messages);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setTyping(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleNewTopic = () => {
    setSessionId(null);
    setMessages([]);
    setSubject('');
  };

  const handleLoadConversation = (session: ConversationSession) => {
    setSessionId(session.id);
    setMessages(session.messages);
    setSubject(session.subject);
    setShowHistory(false);
  };

  const handleDeleteConversation = (sessionId: string) => {
    deleteConversation(sessionId);
    setConversations(prev => prev.filter(c => c.id !== sessionId));
    if (sessionId === sessionId) {
      setSessionId(null);
      setMessages([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-blue-500/20 p-5 mb-4">
          <div>
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Conversation Tutor</h1>
            <p className="text-muted-foreground">Chat naturally with your AI tutor</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4 mr-1" />
              History
            </Button>
            {sessionId && (
              <Button variant="outline" size="sm" onClick={handleNewTopic}>
                <Plus className="w-4 h-4 mr-1" />
                New Topic
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* History Sidebar */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-shrink-0"
              >
                <Card className="h-full border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Past Conversations</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100%-3rem)]">
                      {conversations.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-4 text-center">
                          No conversations yet
                        </p>
                      ) : (
                        <div className="space-y-1 p-2">
                          {conversations.map(conv => {
                            const preview = formatSessionPreview(conv);
                            return (
                              <motion.div
                                key={conv.id}
                                className={`p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                                  conv.id === sessionId ? 'bg-muted' : ''
                                }`}
                                onClick={() => handleLoadConversation(conv)}
                                whileHover={{ scale: 1.02 }}
                              >
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {SUBJECT_LABELS[conv.subject as keyof typeof SUBJECT_LABELS] || conv.subject}
                                  </Badge>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteConversation(conv.id);
                                    }}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {preview.preview}
                                </p>
                                <p className="text-xs text-muted-foreground/70">
                                  {preview.messageCount} messages · {preview.timeAgo}
                                </p>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Chat Area */}
          <Card className="flex-1 flex flex-col min-h-0 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            {!sessionId ? (
              // Subject selection / start screen
              <CardContent className="flex-1 flex flex-col items-center justify-center p-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-md"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Start a Conversation</h2>
                  <p className="text-muted-foreground mb-6">
                    Pick a subject and start chatting with your AI tutor.
                    The tutor remembers what you discussed!
                  </p>

                  <div className="space-y-4">
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger className="border-2 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_SUBJECTS.map(s => (
                          <SelectItem key={s} value={s}>
                            {SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] || s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      className="w-full"
                      size="lg" className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all"
                      disabled={!subject || loading}
                      onClick={handleStartConversation}
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Start Talking
                    </Button>
                  </div>
                </motion.div>
              </CardContent>
            ) : (
              // Chat messages
              <>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-1">
                    {messages.map((msg, idx) => (
                      <ConversationBubble
                        key={idx}
                        message={msg.content}
                        isOwn={msg.role === 'user'}
                        timestamp={msg.timestamp}
                      />
                    ))}
                    {typing && (
                      <ConversationBubble
                        message=""
                        isOwn={false}
                        isTyping
                      />
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Quick Actions */}
                <div className="px-4 py-3 border-t flex gap-2 overflow-x-auto">
                  {QUICK_ACTIONS.map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 text-xs gap-1.5 border-2 border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                      onClick={() => handleQuickAction(action.prompt)}
                      disabled={typing}
                    >
                      <span className="text-sm">{action.icon}</span>
                      {action.label}
                    </Button>
                  ))}
                </div>

                {/* Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      placeholder="Ask a follow-up question..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={typing}
                      className="flex-1 border-2 border-border/30 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all"
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() || typing}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
