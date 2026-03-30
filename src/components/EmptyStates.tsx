import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LucideIcon, BookOpen, Brain, TrendingUp, FileText, Search, Sparkles, Calendar, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`text-center py-16 px-4 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
        {Icon ? (
          <Icon className="w-8 h-8 text-muted-foreground" />
        ) : (
          <span className="text-3xl">{emoji}</span>
        )}
      </div>
      <h3 className="text-lg font-display font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
      {action && (
        action.href ? (
          <Button asChild>
            <Link to={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </motion.div>
  );
}

// Pre-built empty states for common scenarios
export function NoProgressState() {
  return (
    <EmptyState
      icon={TrendingUp}
      title="No progress yet"
      description="Start studying to see your progress here. Try the AI Tutor or take a quiz!"
      action={{ label: 'Start Studying', href: '/tutor' }}
    />
  );
}

export function NoQuizzesState() {
  return (
    <EmptyState
      icon={Brain}
      title="No quizzes completed"
      description="Take your first AI-powered quiz to test your knowledge."
      action={{ label: 'Take a Quiz', href: '/quiz' }}
    />
  );
}

export function NoAssignmentsState() {
  return (
    <EmptyState
      icon={FileText}
      title="No assignments yet"
      description="Your teacher hasn't assigned any work yet. Check back soon!"
    />
  );
}

export function NoSearchResultsState() {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description="Try adjusting your search or filters to find what you're looking for."
    />
  );
}

export function NoPapersState() {
  return (
    <EmptyState
      icon={BookOpen}
      title="No papers found"
      description="Try adjusting your filters or search term."
    />
  );
}

export function NoStudyPlanState() {
  return (
    <EmptyState
      icon={Calendar}
      title="No study plan yet"
      description="Create a personalized study schedule to stay on track for matric."
      action={{ label: 'Create Plan', href: '/study-planner' }}
    />
  );
}

export function NoAchievementsState() {
  return (
    <EmptyState
      icon={Trophy}
      title="Start earning achievements"
      description="Complete quizzes, maintain streaks, and study to unlock badges and rewards!"
      action={{ label: 'Take a Quiz', href: '/quiz' }}
    />
  );
}

export function NoIllustrationsState() {
  return (
    <EmptyState
      icon={Sparkles}
      title="Generate your first illustration"
      description="Ask the AI to create detailed diagrams for science topics like biology, physics, or geography."
      action={{ label: 'Try It', href: '/illustrations' }}
    />
  );
}
