import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import FloatingAITutor from "@/components/FloatingAITutor";
import SwipeNavigation from "@/components/SwipeNavigation";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Tutor from "./pages/Tutor";
import ProgressPage from "./pages/Progress";
import LessonPlans from "./pages/LessonPlans";
import StudentsPage from "./pages/Students";
import TeachersPage from "./pages/Teachers";
import AssignmentsPage from "./pages/Assignments";
import AssignmentSubmission from "./pages/AssignmentSubmission";
import AnnouncementsPage from "./pages/Announcements";
import AnalyticsPage from "./pages/Analytics";
import QuizPage from "./pages/Quiz";
import SettingsPage from "./pages/Settings";
import AdminUsersPage from "./pages/AdminUsers";
import AdminSystemPage from "./pages/AdminSystem";
import VoiceTutor from "./pages/VoiceTutor";
import StudyPlanner from "./pages/StudyPlanner";
import SnapSolve from "./pages/SnapSolve";
import Gamification from "./pages/Gamification";
import ExplainMistake from "./pages/ExplainMistake";
import PracticeExam from "./pages/PracticeExam";
import PastPapers from "./pages/PastPapers";
import StudyNotes from "./pages/StudyNotes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FloatingAITutor />
            <SwipeNavigation>
            <Routes>
              {/* PUBLIC */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* PROTECTED */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/tutor" element={<ProtectedRoute><Tutor /></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
              <Route path="/lesson-plans" element={<ProtectedRoute><LessonPlans /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
              <Route path="/teachers" element={<ProtectedRoute><TeachersPage /></ProtectedRoute>} />
              <Route path="/assignments" element={<ProtectedRoute><AssignmentsPage /></ProtectedRoute>} />
              <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentSubmission /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
              <Route path="/admin/system" element={<ProtectedRoute><AdminSystemPage /></ProtectedRoute>} />

              {/* NEW FEATURES */}
              <Route path="/voice-tutor" element={<ProtectedRoute><VoiceTutor /></ProtectedRoute>} />
              <Route path="/study-planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
              <Route path="/snap-solve" element={<ProtectedRoute><SnapSolve /></ProtectedRoute>} />
              <Route path="/gamification" element={<ProtectedRoute><Gamification /></ProtectedRoute>} />
              <Route path="/practice-exam" element={<ProtectedRoute><PracticeExam /></ProtectedRoute>} />
              <Route path="/explain-mistake" element={<ProtectedRoute><ExplainMistake /></ProtectedRoute>} />
              <Route path="/past-papers" element={<ProtectedRoute><PastPapers /></ProtectedRoute>} />
              <Route path="/study-notes" element={<ProtectedRoute><StudyNotes /></ProtectedRoute>} />

              {/* FALLBACK */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SwipeNavigation>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
