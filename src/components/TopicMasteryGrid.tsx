// ============================================================
// Matric Mind AI - Topic Mastery Grid Component
// Grid display of topic mastery with color-coded cells
// ============================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface TopicMastery {
  topic: string;
  mastery_pct: number;
  status: 'mastered' | 'learning' | 'struggling';
}

export interface TopicMasteryGridProps {
  topics: TopicMastery[];
  onTopicClick?: (topic: TopicMastery) => void;
  className?: string;
  showExpandable?: boolean;
}

// ============================================================
// Color Helpers
// ============================================================

function getMasteryColor(pct: number): string {
  if (pct >= 70) return 'bg-green-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-red-500';
}

function getMasteryBgColor(pct: number): string {
  if (pct >= 70) return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
  if (pct >= 40) return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
  return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
}

function getMasteryTextColor(pct: number): string {
  if (pct >= 70) return 'text-green-700 dark:text-green-300';
  if (pct >= 40) return 'text-blue-700 dark:text-blue-300';
  return 'text-red-700 dark:text-red-300';
}

function getMasteryLabel(pct: number): string {
  if (pct >= 80) return 'Mastered';
  if (pct >= 70) return 'Strong';
  if (pct >= 50) return 'Developing';
  if (pct >= 40) return 'Learning';
  if (pct >= 20) return 'Needs Work';
  return 'Struggling';
}

// ============================================================
// Single Topic Cell
// ============================================================

interface TopicCellProps {
  topic: TopicMastery;
  onClick?: () => void;
  expanded: boolean;
  onToggle: () => void;
}

function TopicCell({ topic, onClick, expanded, onToggle }: TopicCellProps) {
  return (
    <motion.div
      layout
      className={`rounded-lg border p-3 cursor-pointer transition-shadow hover:shadow-md ${getMasteryBgColor(topic.mastery_pct)}`}
      onClick={() => {
        onClick?.();
        onToggle();
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium truncate flex-1 ${getMasteryTextColor(topic.mastery_pct)}`}>
          {topic.topic}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-1" />
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
        <motion.div
          className={`h-2 rounded-full ${getMasteryColor(topic.mastery_pct)}`}
          initial={{ width: 0 }}
          animate={{ width: `${topic.mastery_pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{getMasteryLabel(topic.mastery_pct)}</span>
        <span className={`text-sm font-bold ${getMasteryTextColor(topic.mastery_pct)}`}>
          {topic.mastery_pct}%
        </span>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={getMasteryTextColor(topic.mastery_pct)}>
                  {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                </span>
              </p>
              {topic.mastery_pct < 40 && (
                <p className="text-orange-600 dark:text-orange-400">
                  💡 This topic needs focused revision
                </p>
              )}
              {topic.mastery_pct >= 70 && (
                <p className="text-green-600 dark:text-green-400">
                  ✅ Strong understanding — keep practising to maintain
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function TopicMasteryGrid({
  topics,
  onTopicClick,
  className = '',
  showExpandable = true,
}: TopicMasteryGridProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  if (!topics || topics.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
        <BookOpen className="w-12 h-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">No topic data yet</p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          Complete quizzes to see your topic mastery
        </p>
      </div>
    );
  }

  // Sort topics: struggling first (for attention), then by mastery
  const sortedTopics = [...topics].sort((a, b) => {
    if (a.status === 'struggling' && b.status !== 'struggling') return -1;
    if (a.status !== 'struggling' && b.status === 'struggling') return 1;
    return a.mastery_pct - b.mastery_pct;
  });

  // Summary counts
  const mastered = topics.filter(t => t.mastery_pct >= 70).length;
  const learning = topics.filter(t => t.mastery_pct >= 40 && t.mastery_pct < 70).length;
  const struggling = topics.filter(t => t.mastery_pct < 40).length;

  return (
    <div className={className}>
      {/* Summary badges */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {mastered} Mastered
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {learning} Learning
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {struggling} Needs Work
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedTopics.map((topic) => (
          <TopicCell
            key={topic.topic}
            topic={topic}
            onClick={() => onTopicClick?.(topic)}
            expanded={showExpandable && expandedTopic === topic.topic}
            onToggle={() => {
              if (showExpandable) {
                setExpandedTopic(
                  expandedTopic === topic.topic ? null : topic.topic
                );
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
