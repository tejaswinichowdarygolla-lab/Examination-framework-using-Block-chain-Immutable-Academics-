import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider, useWallet } from "@/context/WalletContext";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Phase1TestPanel from "./components/dev/Phase1TestPanel";
import { useIPFS } from "./hooks/useIPFS";
import AppLayout from "./components/layout/AppLayout";
import { ENV } from "@/config/env";

import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCourses from "./pages/student/StudentCourses";
import ActiveExam from "./pages/student/ActiveExam";
import SubmissionHistory from "./pages/student/SubmissionHistory";
import ZKProofs from "./pages/student/ZKProofs";
import StudentResults from "./pages/student/StudentResults";

import InstructorDashboard from "./pages/instructor/InstructorDashboard";
import InstructorCourses from "./pages/instructor/InstructorCourses";
import ExamManagement from "./pages/instructor/ExamManagement";
import InstructorSubmissions from "./pages/instructor/InstructorSubmissions";
import IPFSManager from "./pages/instructor/IPFSManager";

import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageUsers from "./pages/admin/ManageUsers";
import AuditLogs from "./pages/admin/AuditLogs";
import SystemSettings from "./pages/admin/SystemSettings";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function IPFSInit() {
  const { ipfsReady, ipfsError } = useIPFS();
  if (ipfsError) console.warn("[App] IPFS unavailable:", ipfsError);
  return null;
}
function RoleGuard({ allowedRoles, children }: { allowedRoles: string[], children: React.ReactNode }) {
  const { isConnected, address, role, isCorrectNetwork, isConnecting } = useWallet();

  // SEC-TC-055/056: Flags removed to prevent total RBAC bypass via URL manipulation.
  // We use real wallet and contract checks instead for every route traversal.

  // 1. Handle Loading / Session Restoration
  // If we are currently connecting OR we were connected but address isn't restored yet, wait.
  if (isConnecting || (isConnected && address === null) || (isConnected && role === null)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Restoring Session...</p>
        </div>
      </div>
    );
  }

  // 3. Unauthorized access (Not connected or wrong network)
  if (!isConnected || !isCorrectNetwork) {
    return <Navigate to="/" replace />;
  }

  // 4. Role-based Authorization
  if (!allowedRoles.includes(role as string)) {
    if (role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
    if (role === "TEACHER") return <Navigate to="/instructor/dashboard" replace />;
    if (role === "STUDENT") return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <IPFSInit />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register/:linkId" element={<Register />} />
            <Route path="/dev/phase1" element={<Phase1TestPanel />} />

            <Route element={<AppLayout />}>
              <Route
                path="/student/dashboard"
                element={
                  <RoleGuard allowedRoles={["STUDENT", "TEACHER", "ADMIN", "SUB_ADMIN"]}>
                    <StudentDashboard />
                  </RoleGuard>
                }
              />
              <Route path="/student/courses" element={<RoleGuard allowedRoles={["STUDENT"]}><StudentCourses /></RoleGuard>} />
              <Route path="/student/exam/:examId" element={<RoleGuard allowedRoles={["STUDENT"]}><ActiveExam /></RoleGuard>} />
              <Route path="/student/submissions" element={<RoleGuard allowedRoles={["STUDENT"]}><SubmissionHistory /></RoleGuard>} />
              <Route path="/student/results" element={<RoleGuard allowedRoles={["STUDENT"]}><StudentResults /></RoleGuard>} />
              <Route path="/student/proofs" element={<RoleGuard allowedRoles={["STUDENT"]}><ZKProofs /></RoleGuard>} />

              <Route path="/instructor/dashboard" element={<RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><InstructorDashboard /></RoleGuard>} />
              <Route path="/instructor/courses" element={<RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><InstructorCourses /></RoleGuard>} />
              <Route path="/instructor/exam/:examId" element={<RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><ExamManagement /></RoleGuard>} />
              <Route path="/instructor/submissions/:examId" element={<RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><InstructorSubmissions /></RoleGuard>} />
              <Route path="/instructor/ipfs" element={<RoleGuard allowedRoles={["TEACHER", "ADMIN"]}><IPFSManager /></RoleGuard>} />

              <Route path="/admin/dashboard" element={<RoleGuard allowedRoles={["ADMIN", "SUB_ADMIN"]}><AdminDashboard /></RoleGuard>} />
              <Route path="/admin/users" element={<RoleGuard allowedRoles={["ADMIN", "SUB_ADMIN"]}><ManageUsers /></RoleGuard>} />
              <Route path="/admin/audit" element={<RoleGuard allowedRoles={["ADMIN", "SUB_ADMIN"]}><AuditLogs /></RoleGuard>} />
              <Route path="/admin/settings" element={<RoleGuard allowedRoles={["ADMIN"]}><SystemSettings /></RoleGuard>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

