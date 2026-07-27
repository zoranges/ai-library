import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import FrontendLayout from '@/components/layout/FrontendLayout';
import SidebarLayout from '@/components/layout/SidebarLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import Home from '@/pages/books/Home';
import Books from '@/pages/books/BookList';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import BookDetail from '@/pages/books/BookDetail';
import Reader from '@/pages/reader/Reader';
import AdminLogin from '@/pages/admin/AdminLogin';
import Dashboard from '@/pages/admin/Dashboard';
import SchoolManagement from '@/pages/admin/SchoolManagement';
import SchoolDetail from '@/pages/admin/SchoolDetail';
import StudentManagement from '@/pages/admin/StudentManagement';
import BookManagement from '@/pages/admin/BookManagement';
import AdminManagement from '@/pages/admin/AdminManagement';
import Statistics from '@/pages/admin/Statistics';
import LeaderboardManagement from '@/pages/admin/LeaderboardManagement';
import AccountCenter from '@/pages/admin/AccountCenter';
import RoleSwitch from '@/pages/admin/RoleSwitch';
import Quiz from '@/pages/quiz/Quiz';
import Leaderboard from '@/pages/leaderboard/Leaderboard';
import Profile from '@/pages/profile/Profile';
import ReadingHistory from '@/pages/profile/ReadingHistory';
import Favorites from '@/pages/profile/Favorites';
import Notes from '@/pages/profile/Notes';
import Achievements from '@/pages/profile/Achievements';
import ReadingGrowth from '@/pages/profile/ReadingGrowth';
import AIConfig from '@/pages/admin/AIConfig';
import SystemSettings from '@/pages/admin/SystemSettings';
import CategoryManagement from '@/pages/admin/CategoryManagement';
import ICWhitelist from '@/pages/admin/ICWhitelist';
import BatchUpload from '@/pages/admin/BatchUpload';
import OperationLogs from '@/pages/admin/OperationLogs';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, fetchMe, token } = useAuthStore();
  const [checking, setChecking] = useState(!user && !!token);

  useEffect(() => {
    if (token && !user) {
      fetchMe().finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, fetchMe, token } = useAuthStore();
  const [checking, setChecking] = useState(!user && !!token);

  useEffect(() => {
    if (token && !user) {
      fetchMe().finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'oklch(0.12 0.015 255)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-white/20 border-t-accent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (user?.role !== 'super_admin' && user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center animate-fade-in">
        <h2 className="text-2xl font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-text-tertiary">页面开发中...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Frontend pages — sidebar layout */}
        <Route element={<SidebarLayout />}>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/books" element={<ProtectedRoute><Books /></ProtectedRoute>} />
          <Route path="/books/:id" element={<ProtectedRoute><BookDetail /></ProtectedRoute>} />
          <Route path="/read/:id" element={<ProtectedRoute><Reader /></ProtectedRoute>} />
          <Route path="/quiz/:bookId" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>}>
            <Route index element={<ReadingHistory />} />
            <Route path="history" element={<ReadingHistory />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="notes" element={<Notes />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="growth" element={<ReadingGrowth />} />
          </Route>
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="admins" element={<AdminManagement />} />
          <Route path="schools" element={<SchoolManagement />} />
          <Route path="schools/:id" element={<SchoolDetail />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="students/:id" element={<StudentManagement />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="leaderboard" element={<LeaderboardManagement />} />
          <Route path="books" element={<BookManagement />} />
          <Route path="books/new" element={<BookManagement />} />
          <Route path="books/:id/edit" element={<BookManagement />} />
          <Route path="books/categories" element={<CategoryManagement />} />
          <Route path="account" element={<AccountCenter />} />
          <Route path="role-switch" element={<RoleSwitch />} />
          <Route path="ai-config" element={<AIConfig />} />
          <Route path="system-settings" element={<SystemSettings />} />
          <Route path="ic-whitelist" element={<ICWhitelist />} />
          <Route path="batch-upload" element={<BatchUpload />} />
          <Route path="logs" element={<OperationLogs />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
