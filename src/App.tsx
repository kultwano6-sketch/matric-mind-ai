import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import SwipeNavigation from "@/components/SwipeNavigation";
import { DashboardSkeleton, ChatSkeleton } from "@/components/LoadingSkeletons";

// Critical pages (loaded immediately)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy-loaded pages (code split)
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tutor = lazy(() => import("./pages/Tutor"));
const ProgressPage = lazy(() => import("./pages/Progress"));
const LessonPlans = lazy(() => import("./pages/LessonPlans"));
const StudentsPage = lazy(() => import("./pages/Students"));
const TeachersPage = lazy(() => import("./pages/Teachers"));
const AssignmentsPage = lazy(() => import("./pages/Assignments"));
const AssignmentSubmission = lazy(() => import("./pages/AssignmentSubmission"));
const AnnouncementsPage = lazy(() => import("./pages/Announcements"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const QuizPage = lazy(() => import("./pages/Quiz"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsers"));
const AdminSystemPage = lazy(() => import("./pages/AdminSystem"));
const TeacherApproval = lazy(() => import("./pages/TeacherApproval"));
const VoiceTutor = lazy(() => import("./pages/VoiceTutor"));
const StudyPlanner = lazy(() => import("./pages/StudyPlanner"));
const SnapSolve = lazy(() => import("./pages/SnapSolve"));
const Gamification = lazy(() => import("./pages/Gamification"));
const ExplainMistake = lazy(() => import("./pages/ExplainMistake"));
const PracticeExam = lazy(() => import("./pages/PracticeExam"));
const PastPapers = lazy(() => import("./pages/PastPapers"));
const StudyNotes = lazy(() => import("./pages/StudyNotes"));
const MatricReadiness = lazy(() => import("./pages/MatricReadiness"));
const SmartStudyPlan = lazy(() => import("./pages/SmartStudyPlan"));
const ExamSimulator = lazy(() => import("./pages/ExamSimulator"));
const EnhancedAnalytics = lazy(() => import("./pages/EnhancedAnalytics"));
const DailyChallenges = lazy(() => import("./pages/DailyChallenges"));
const ConversationTutor = lazy(() => import("./pages/ConversationTutor"));
const TextbookScan = lazy(() => import("./pages/TextbookScan"));
const ProgressTracker = lazy(() => import("./pages/ProgressTracker"));
const OfflineManager = lazy(() => import("./pages/OfflineManager"));
// Removed Settings-enhanced (merged into Settings)
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 300000, retry: 2, retryDelay: (i) => Math.min(1000 * 2 ** i, 30000) },
    mutations: { retry: 1 },
  },
});

function LazyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SwipeNavigation>
            <Routes>
              {/* PUBLIC */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<LazyWrapper><ResetPassword /></LazyWrapper>} />

              {/* PROTECTED */}
              <Route path="/dashboard" element={<ProtectedRoute><LazyWrapper><Dashboard /></LazyWrapper></ProtectedRoute>} />
              <Route path="/tutor" element={<ProtectedRoute><LazyWrapper><Tutor /></LazyWrapper></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute><LazyWrapper><ProgressPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/lesson-plans" element={<ProtectedRoute><LazyWrapper><LessonPlans /></LazyWrapper></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute><LazyWrapper><StudentsPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/teachers" element={<ProtectedRoute><LazyWrapper><TeachersPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/assignments" element={<ProtectedRoute><LazyWrapper><AssignmentsPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/assignments/:id" element={<ProtectedRoute><LazyWrapper><AssignmentSubmission /></LazyWrapper></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute><LazyWrapper><AnnouncementsPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><LazyWrapper><AnalyticsPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/quiz" element={<ProtectedRoute><LazyWrapper><QuizPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><LazyWrapper><SettingsPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><LazyWrapper><AdminUsersPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/admin/system" element={<ProtectedRoute><LazyWrapper><AdminSystemPage /></LazyWrapper></ProtectedRoute>} />
              <Route path="/admin/teachers" element={<ProtectedRoute><LazyWrapper><TeacherApproval /></LazyWrapper></ProtectedRoute>} />

              {/* FEATURES */}
              <Route path="/voice-tutor" element={<ProtectedRoute><LazyWrapper><VoiceTutor /></LazyWrapper></ProtectedRoute>} />
              <Route path="/study-planner" element={<ProtectedRoute><LazyWrapper><StudyPlanner /></LazyWrapper></ProtectedRoute>} />
              <Route path="/snap-solve" element={<ProtectedRoute><LazyWrapper><SnapSolve /></LazyWrapper></ProtectedRoute>} />
              <Route path="/gamification" element={<ProtectedRoute><LazyWrapper><Gamification /></LazyWrapper></ProtectedRoute>} />
              <Route path="/practice-exam" element={<ProtectedRoute><LazyWrapper><PracticeExam /></LazyWrapper></ProtectedRoute>} />
              <Route path="/explain-mistake" element={<ProtectedRoute><LazyWrapper><ExplainMistake /></LazyWrapper></ProtectedRoute>} />
              <Route path="/past-papers" element={<ProtectedRoute><LazyWrapper><PastPapers /></LazyWrapper></ProtectedRoute>} />
              <Route path="/study-notes" element={<ProtectedRoute><LazyWrapper><StudyNotes /></LazyWrapper></ProtectedRoute>} />
              <Route path="/matric-readiness" element={<ProtectedRoute><LazyWrapper><MatricReadiness /></LazyWrapper></ProtectedRoute>} />
              <Route path="/smart-study-plan" element={<ProtectedRoute><LazyWrapper><SmartStudyPlan /></LazyWrapper></ProtectedRoute>} />
              <Route path="/exam-simulator" element={<ProtectedRoute><LazyWrapper><ExamSimulator /></LazyWrapper></ProtectedRoute>} />
              <Route path="/enhanced-analytics" element={<ProtectedRoute><LazyWrapper><EnhancedAnalytics /></LazyWrapper></ProtectedRoute>} />
              <Route path="/daily-challenges" element={<ProtectedRoute><LazyWrapper><DailyChallenges /></LazyWrapper></ProtectedRoute>} />
              <Route path="/conversation-tutor" element={<ProtectedRoute><LazyWrapper><ConversationTutor /></LazyWrapper></ProtectedRoute>} />
              <Route path="/textbook-scan" element={<ProtectedRoute><LazyWrapper><TextbookScan /></LazyWrapper></ProtectedRoute>} />
              <Route path="/progress-tracker" element={<ProtectedRoute><LazyWrapper><ProgressTracker /></LazyWrapper></ProtectedRoute>} />
              {/* Settings now includes Enhanced features */}
              <Route path="/offline-manager" element={<ProtectedRoute><LazyWrapper><OfflineManager /></LazyWrapper></ProtectedRoute>} />

              {/* FALLBACK */}
              <Route path="*" element={<LazyWrapper><NotFound /></LazyWrapper>} />
            </Routes>
            </SwipeNavigation>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
