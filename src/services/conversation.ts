// ============================================================
// Matric Mind AI - Conversation Service
// Client-side service for multi-turn conversation mode
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================
// Types
// ============================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ConversationSession {
  id: string;
  student_id: string;
  subject: string;
  messages: ConversationMessage[];
  started_at: string;
  ended_at?: string;
}

export interface ConversationResponse {
  success: boolean;
  session_id: string;
  response: string;
  message_count: number;
  error?: string;
}

// ============================================================
// Local Storage Keys
// ============================================================

const STORAGE_KEY = 'matric_mind_conversations';

// ============================================================
// API Functions
// ============================================================

/**
 * Start a new conversation session
 */
export async function startConversation(
  studentId: string,
  subject: string
): Promise<ConversationSession> {
  const response = await fetch(`${API_BASE}/api/conversation-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId,
      subject,
      message: 'Hello! I\'m ready to start studying.',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start conversation');
  }

  const data: ConversationResponse = await response.json();

  const session: ConversationSession = {
    id: data.session_id,
    student_id: studentId,
    subject,
    messages: [
      { role: 'user', content: 'Hello! I\'m ready to start studying.', timestamp: new Date().toISOString() },
      { role: 'assistant', content: data.response, timestamp: new Date().toISOString() },
    ],
    started_at: new Date().toISOString(),
  };

  // Save to local storage
  saveSessionToStorage(session);

  return session;
}

/**
 * Send a message in an existing conversation
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  studentId: string,
  subject: string
): Promise<{ session: ConversationSession; response: string }> {
  // Load existing session
  const existingSession = getSessionFromStorage(sessionId);
  const subjectToUse = existingSession?.subject || subject;

  const response = await fetch(`${API_BASE}/api/conversation-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      student_id: studentId,
      subject: subjectToUse,
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to send message');
  }

  const data: ConversationResponse = await response.json();

  // Update local session
  const session = existingSession || {
    id: sessionId,
    student_id: studentId,
    subject: subjectToUse,
    messages: [],
    started_at: new Date().toISOString(),
  };

  session.messages.push(
    { role: 'user', content: message, timestamp: new Date().toISOString() },
    { role: 'assistant', content: data.response, timestamp: new Date().toISOString() }
  );

  saveSessionToStorage(session);

  return { session, response: data.response };
}

/**
 * Get conversation history for a session
 */
export function getConversationHistory(sessionId: string): ConversationMessage[] {
  const session = getSessionFromStorage(sessionId);
  return session?.messages || [];
}

/**
 * End a conversation session
 */
export function endConversation(sessionId: string): void {
  const sessions = getAllSessionsFromStorage();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex !== -1) {
    sessions[sessionIndex].ended_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
}

/**
 * Get all conversation sessions for a student
 */
export function getAllConversations(studentId: string): ConversationSession[] {
  const sessions = getAllSessionsFromStorage();
  return sessions
    .filter(s => s.student_id === studentId)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

/**
 * Delete a conversation session
 */
export function deleteConversation(sessionId: string): void {
  const sessions = getAllSessionsFromStorage();
  const filtered = sessions.filter(s => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Clear all conversations for a student
 */
export function clearAllConversations(studentId: string): void {
  const sessions = getAllSessionsFromStorage();
  const filtered = sessions.filter(s => s.student_id !== studentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// ============================================================
// Local Storage Helpers
// ============================================================

function getAllSessionsFromStorage(): ConversationSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function getSessionFromStorage(sessionId: string): ConversationSession | null {
  const sessions = getAllSessionsFromStorage();
  return sessions.find(s => s.id === sessionId) || null;
}

function saveSessionToStorage(session: ConversationSession): void {
  const sessions = getAllSessionsFromStorage();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  if (existingIndex !== -1) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  // Keep only last 50 sessions to avoid storage bloat
  const trimmed = sessions.slice(-50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * Format session for display
 */
export function formatSessionPreview(session: ConversationSession): {
  preview: string;
  messageCount: number;
  timeAgo: string;
} {
  const lastMessage = session.messages[session.messages.length - 1];
  const preview = lastMessage
    ? lastMessage.content.substring(0, 80) + (lastMessage.content.length > 80 ? '...' : '')
    : 'Empty conversation';

  const messageCount = session.messages.filter(m => m.role !== 'system').length;

  const startedDate = new Date(session.started_at);
  const now = new Date();
  const diffMs = now.getTime() - startedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo: string;
  if (diffMins < 1) timeAgo = 'Just now';
  else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
  else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
  else timeAgo = `${diffDays}d ago`;

  return { preview, messageCount, timeAgo };
}
