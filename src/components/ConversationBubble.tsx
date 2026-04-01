// ============================================================
// Matric Mind AI - Conversation Bubble Component
// Chat message bubbles with typing indicator and markdown
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface ConversationBubbleProps {
  message: string;
  isOwn: boolean;
  timestamp?: string;
  isTyping?: boolean;
  className?: string;
}

// ============================================================
// Simple Markdown Renderer
// ============================================================

function renderMarkdown(text: string): React.ReactNode {
  // Process text for basic markdown formatting
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-sm font-bold mt-2 mb-1">{line.slice(4)}</h3>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-2 mb-1">{line.slice(3)}</h2>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-lg font-bold mt-2 mb-1">{line.slice(2)}</h1>
      );
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm">
          <InlineMarkdown text={line.slice(2)} />
        </li>
      );
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-sm">
          <InlineMarkdown text={numMatch[2]} />
        </li>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<br key={i} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed">
        <InlineMarkdown text={line} />
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Inline markdown (bold, italic, code)
 */
function InlineMarkdown({ text }: { text: string }) {
  // Process bold (**text**), italic (*text*), and inline code (`code`)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Check for italic
    const italicMatch = remaining.match(/\*(.+?)\*/);
    // Check for inline code
    const codeMatch = remaining.match(/`(.+?)`/);

    // Find the earliest match
    const matches = [
      { match: boldMatch, type: 'bold' },
      { match: italicMatch, type: 'italic' },
      { match: codeMatch, type: 'code' },
    ].filter(m => m.match !== null) as Array<{ match: RegExpMatchArray; type: string }>;

    if (matches.length === 0) {
      // No more formatting, add remaining text
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Get the earliest match
    const earliest = matches.reduce((prev, curr) =>
      (curr.match?.index ?? Infinity) < (prev.match?.index ?? Infinity) ? curr : prev
    );

    const matchIndex = earliest.match.index!;

    // Add text before the match
    if (matchIndex > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, matchIndex)}</span>);
    }

    // Add formatted text
    const content = earliest.match[1];
    switch (earliest.type) {
      case 'bold':
        parts.push(<strong key={key++} className="font-semibold">{content}</strong>);
        break;
      case 'italic':
        parts.push(<em key={key++}>{content}</em>);
        break;
      case 'code':
        parts.push(
          <code key={key++} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">
            {content}
          </code>
        );
        break;
    }

    // Continue with remaining text after the match
    remaining = remaining.slice(matchIndex + earliest.match[0].length);
  }

  return <>{parts}</>;
}

// ============================================================
// Typing Indicator
// ============================================================

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// Timestamp Formatter
// ============================================================

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes} ${ampm}`;
}

// ============================================================
// Main Component
// ============================================================

export default function ConversationBubble({
  message,
  isOwn,
  timestamp,
  isTyping = false,
  className = '',
}: ConversationBubbleProps) {
  return (
    <motion.div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 ${className}`}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* AI Avatar */}
      {!isOwn && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-2">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Message bubble */}
      <div className={`max-w-[80%] ${isOwn ? 'order-1' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted dark:bg-gray-800 text-foreground rounded-bl-md'
          }`}
        >
          {isTyping ? (
            <TypingIndicator />
          ) : (
            isOwn ? (
              <p className="text-sm whitespace-pre-wrap">{message}</p>
            ) : (
              renderMarkdown(message)
            )
          )}
        </div>

        {/* Timestamp */}
        {timestamp && !isTyping && (
          <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
            {formatTimestamp(timestamp)}
          </p>
        )}
      </div>

      {/* User Avatar */}
      {isOwn && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center ml-2">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </motion.div>
  );
}
