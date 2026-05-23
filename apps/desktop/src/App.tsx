import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import Layout from './components/Layout';

import { ToastProvider } from 'ui/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { isTauri, getBackendUrl } from 'shared/lib/desktop-config';

// Lazy loaded page components
const LoginPage = lazy(() => import('./pages/Login'));
const RegisterPage = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectsPage = lazy(() => import('./pages/Projects'));
const ProjectMembersPage = lazy(() => import('./pages/ProjectMembers'));
const UsersManagementPage = lazy(() => import('./pages/UsersManagement'));
const NewProject = lazy(() => import('./pages/NewProject'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const NewIssue = lazy(() => import('./pages/NewIssue'));
const IssueDetail = lazy(() => import('./pages/IssueDetail'));
const IssuesPage = lazy(() => import('./pages/Issues'));
const TasksPage = lazy(() => import('./pages/Tasks'));
const ProjectWikiPage = lazy(() => import('./pages/wiki/ProjectWiki'));
const ProjectBoardPage = lazy(() => import('./pages/ProjectBoard'));
const KanbanPage = lazy(() => import('./pages/Kanban'));
const PostDetailPage = lazy(() => import('./pages/PostDetail'));
const PostForm = lazy(() => import('./pages/PostForm'));
const ChatPage = lazy(() => import('./pages/Chat'));
const MemosPage = lazy(() => import('./pages/memos/Memos'));
const MemoDetailPage = lazy(() => import('./pages/memos/MemoDetailPage'));
const GlobalBoardList = lazy(() => import('./pages/boards/BoardList'));
const ServerSetup = lazy(() => import('./pages/ServerSetup'));
const AddressBookPage = lazy(() => import('./pages/addressbook/AddressBookPage'));
const AdminGroupsPage = lazy(() => import('./pages/admin/AdminGroupsPage'));
const OrganizationPage = lazy(() => import('./pages/admin/OrganizationPage'));
const SchedulerPage = lazy(() => import('./pages/admin/SchedulerPage'));
const LogsPage = lazy(() => import('./pages/admin/LogsPage'));
const ProjectSettingsPage = lazy(() => import('./pages/admin/ProjectSettings'));
const ProjectManagementPage = lazy(() => import('./pages/admin/ProjectManagement'));

import { PageLayout } from './components/layout/PageLayout';

import { SystemSidebar } from './components/layout/sidebars/SystemSidebar';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full">
    <div className="w-8 h-8 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({ children, noPadding }: { children: ReactNode, noPadding?: boolean }) {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      <PageLayout noPadding={noPadding}>
        {children}
      </PageLayout>
    </Layout>
  );
}

function SystemRoute({ children }: { children: ReactNode }) {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      <PageLayout sidebar={<SystemSidebar />}>
        {children}
      </PageLayout>
    </Layout>
  );
}

function RootRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri()) {
      // Browser context: normal routing
      const user = localStorage.getItem('user');
      navigate(user ? '/dashboard' : '/login', { replace: true });
      return;
    }

    // Desktop (Tauri) context: first check backend URL config
    getBackendUrl().then((url) => {
      if (!url) {
        navigate('/server-setup', { replace: true });
      } else {
        const user = localStorage.getItem('user');
        navigate(user ? '/dashboard' : '/login', { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-app)]">
      <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/server-setup" element={<ServerSetup />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/projects/new" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<Navigate to="dashboard" replace />} />
              <Route path="/projects/:id/dashboard" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
              <Route path="/projects/:id/members" element={<ProtectedRoute><ProjectMembersPage /></ProtectedRoute>} />
              <Route path="/projects/:id/wiki" element={<ProtectedRoute noPadding><ProjectWikiPage /></ProtectedRoute>} />
              <Route path="/projects/:id/board" element={<ProtectedRoute><ProjectBoardPage /></ProtectedRoute>} />
              <Route path="/projects/:id/board/new" element={<ProtectedRoute><PostForm /></ProtectedRoute>} />
              <Route path="/projects/:id/board/:postId/edit" element={<ProtectedRoute><PostForm /></ProtectedRoute>} />
              <Route path="/projects/:id/board/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/memos" element={<ProtectedRoute><MemosPage /></ProtectedRoute>} />
              <Route path="/memos/:id" element={<ProtectedRoute><MemoDetailPage /></ProtectedRoute>} />
              <Route path="/projects/:id/memos" element={<ProtectedRoute><MemosPage /></ProtectedRoute>} />
              <Route path="/projects/:id/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/projects/:id/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
              <Route path="/projects/:id/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
              <Route path="/projects/:id/kanban" element={<ProtectedRoute><KanbanPage /></ProtectedRoute>} />
              <Route path="/projects/:id/issues/new" element={<ProtectedRoute><NewIssue /></ProtectedRoute>} />
              <Route path="/projects/:id/issues/:issueId" element={<ProtectedRoute><IssueDetail /></ProtectedRoute>} />
              <Route path="/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
              <Route path="/users" element={<SystemRoute><UsersManagementPage /></SystemRoute>} />
              <Route path="/wiki" element={<ProtectedRoute noPadding><ProjectWikiPage /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><AddressBookPage /></ProtectedRoute>} />
              <Route path="/projects/:id/contacts" element={<ProtectedRoute><AddressBookPage /></ProtectedRoute>} />
              <Route path="/admin/groups" element={<SystemRoute><AdminGroupsPage /></SystemRoute>} />
              <Route path="/admin/organization" element={<SystemRoute><OrganizationPage /></SystemRoute>} />
              <Route path="/admin/scheduler" element={<SystemRoute><SchedulerPage /></SystemRoute>} />
              <Route path="/admin/logs" element={<SystemRoute><LogsPage /></SystemRoute>} />
              <Route path="/admin/projects" element={<SystemRoute><ProjectManagementPage /></SystemRoute>} />
              <Route path="/projects/:id/settings" element={<ProtectedRoute><ProjectSettingsPage /></ProtectedRoute>} />

              {/* Global Boards */}
              <Route path="/boards" element={<Navigate to="/boards/notice" replace />} />
              <Route path="/boards/:boardType" element={<ProtectedRoute><GlobalBoardList /></ProtectedRoute>} />
              <Route path="/boards/:boardType/new" element={<ProtectedRoute><PostForm /></ProtectedRoute>} />
              <Route path="/boards/:boardType/:postId/edit" element={<ProtectedRoute><PostForm /></ProtectedRoute>} />
              <Route path="/boards/:boardType/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />

              <Route path="/" element={<RootRoute />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  );
}

export default App;
