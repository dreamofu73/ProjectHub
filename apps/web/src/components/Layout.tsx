import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Bug, BookOpen, FileText, Bell, FolderKanban, Mail, Archive, MessageSquare, Settings, CheckSquare } from 'lucide-react';
import { useToast } from 'ui/Toast';
import { useLanguage } from '../context/LanguageContext';
import { useTheme, THEMES } from '../context/ThemeContext';
import { api } from 'shared/lib/api';
import type { CustomFolder, ChatRoom, Message } from 'shared/types';

import { Header } from './layout/Header';
import { ProfileDialog } from './layout/ProfileDialog';
import { PreferencesDialog } from './layout/PreferencesDialog';
import CommandPalette from './CommandPalette';

import { SidebarContext } from '../context/SidebarContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isDark, cycleLightDark, lightDark, setLightDark, colorTheme, setColorTheme } = useTheme();
  const { language, t, setLanguage } = useLanguage();

  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolder = searchParams.get('folder') || 'received';
  const setCurrentFolder = (folder: string) => {
    if (!location.pathname.includes('/memos')) {
      const pathSegments = location.pathname.split('/').filter(Boolean);
      const projectId = pathSegments[0] === 'projects' ? pathSegments[1] : null;
      if (projectId) {
        navigate(`/projects/${projectId}/memos?folder=${folder}`);
      } else {
        navigate(`/memos?folder=${folder}`);
      }
    } else {
      setSearchParams(prev => {
        prev.set('folder', folder);
        prev.delete('page');
        return prev;
      }, { replace: true });
    }
  };

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const username = user?.login || 'Admin User';
  const role = user?.role || 'admin';
  const initials = username.slice(0, 2).toUpperCase();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // --- Custom Memo Folders State ---
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const fetchCustomFolders = useCallback(async () => {
    try {
      const res = await api('/api/memos/folders');
      const json = await res.json();
      if (json.success) setCustomFolders(json.data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (location.pathname.includes('/memos')) fetchCustomFolders();
  }, [location.pathname, fetchCustomFolders]);

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await api('/api/memos/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('폴더가 생성되었습니다.', 'success');
        setNewFolderName('');
        setIsAddingFolder(false);
        fetchCustomFolders();
        window.dispatchEvent(new CustomEvent('refresh_memo_folders'));
      }
    } catch (err) { console.error(err); }
  };

  const handleRenameFolder = async (id: string) => {
    if (!editingFolderName.trim()) { setEditingFolderId(null); return; }
    try {
      const res = await api(`/api/memos/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('폴더 이름이 변경되었습니다.', 'success');
        setEditingFolderId(null);
        fetchCustomFolders();
        window.dispatchEvent(new CustomEvent('refresh_memo_folders'));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('이 폴더를 삭제하시겠습니까?')) return;
    try {
      const res = await api(`/api/memos/folders/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('폴더가 삭제되었습니다.', 'success');
        fetchCustomFolders();
        window.dispatchEvent(new CustomEvent('refresh_memo_folders'));
        if (currentFolder === `folder_${id}`) setCurrentFolder('received');
      }
    } catch (err) { console.error(err); }
  };

  // --- Profile State ---
  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isSettingsOpen && user?.id) {
      api(`/api/users/${user.id}`)
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data) {
            setEmail(json.data.email || '');
            setFirstname(json.data.firstname || '');
            setLastname(json.data.lastname || '');
          }
        }).catch(() => {});
    }
  }, [isSettingsOpen, user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (newPassword && newPassword !== newPasswordConfirm) return showToast(t('passwordMismatch'), 'error');

    setIsUpdating(true);
    try {
      await api(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || null, firstname: firstname || null, lastname: lastname || null }),
      });
      if (newPassword) {
        await api(`/api/users/${user.id}/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword }),
        });
      }
      localStorage.setItem('user', JSON.stringify({ ...user, email, firstname, lastname }));
      showToast(t('profileUpdateSuccess'), 'success');
      setIsSettingsOpen(false);
    } catch { showToast(t('profileUpdateFail'), 'error'); }
    finally { setIsUpdating(false); }
  };

  // --- Global Unread Counts ---
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const globalLastSeenRef = useRef<string>('0');
  const [unreadMemosCount, setUnreadMemosCount] = useState(0);

  const pollGlobalUnread = useCallback(async () => {
    if (location.pathname === '/chat') { setGlobalUnreadCount(0); return; }
    try {
      const res = await api('/api/chat');
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        const latestId = (json.data.length > 0 ? json.data.reduce((max: string, m: Message) => (BigInt(m.id) > BigInt(max) ? m.id : max), '0') : '0');
        if (globalLastSeenRef.current === '0') globalLastSeenRef.current = latestId;
        else if (BigInt(latestId) > BigInt(globalLastSeenRef.current)) setGlobalUnreadCount(json.data.filter((m: Message) => BigInt(m.id) > BigInt(globalLastSeenRef.current)).length);
      }
    } catch {}
  }, [location.pathname]);

  const pollUnreadMemos = useCallback(async () => {
    if (location.pathname === '/memos') { setUnreadMemosCount(0); return; }
    try {
      const res = await api('/api/memos/unread/count');
      const json = await res.json();
      if (json.success) setUnreadMemosCount(json.count || 0);
    } catch {}
  }, [location.pathname]);

  useEffect(() => {
    pollGlobalUnread(); pollUnreadMemos();
    const chatInt = setInterval(pollGlobalUnread, 5000);
    const memoInt = setInterval(pollUnreadMemos, 10000);
    return () => { clearInterval(chatInt); clearInterval(memoInt); };
  }, [pollGlobalUnread, pollUnreadMemos]);

  // --- Chat Rooms ---
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatUnreadCounts] = useState<Record<string, number>>({});

  // --- Wiki State ---
  const [wikiList, setWikiList] = useState<any[]>([]);

  const fetchWikiList = useCallback(async () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const projectIdentifier = pathSegments[0] === 'projects' ? pathSegments[1] : null;
    try {
      let url = '/api/wiki';
      if (projectIdentifier) {
        const projectRes = await api(`/api/projects/${projectIdentifier}`);
        const projectJson = await projectRes.json();
        if (projectJson.success) {
          url = `/api/wiki?project_id=${projectJson.data.id}`;
        }
      }
      const res = await api(url);
      const json = await res.json();
      if (json.success) setWikiList(json.data || []);
    } catch (err) { console.error(err); }
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.includes('/wiki')) fetchWikiList();
  }, [location.pathname, fetchWikiList]);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await api('/api/chat/rooms');
      const json = await res.json();
      if (json.success) setChatRooms(json.data || []);
    } catch {}
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    showToast(t('logout'), 'success');
    navigate('/login');
  };

  // --- Project Context ---
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isProjectContext = pathSegments[0] === 'projects' && pathSegments[1] && pathSegments[1] !== 'new';
  const projectId = isProjectContext ? pathSegments[1] : null;
  const isSystemContext = location.pathname.startsWith('/users') || location.pathname.startsWith('/admin/groups') || location.pathname.startsWith('/admin/organization') || location.pathname.startsWith('/admin/scheduler') || location.pathname.startsWith('/admin/logs');

  useEffect(() => {
    if (location.pathname.startsWith('/chat') || (isProjectContext && location.pathname.endsWith('/chat'))) {
      fetchChatRooms();
    }
  }, [location.pathname, fetchChatRooms, isProjectContext]);

  useEffect(() => {
    const handleRefresh = () => fetchChatRooms();
    window.addEventListener('refresh_chat_rooms', handleRefresh);
    return () => window.removeEventListener('refresh_chat_rooms', handleRefresh);
  }, [fetchChatRooms]);

  const mainNav = isProjectContext ? [
    { name: t('dashboard'), path: `/projects/${projectId}/dashboard`, icon: LayoutDashboard },
    { name: t('issues'), path: `/projects/${projectId}/issues`, icon: Bug },
    { name: t('tasks'), path: `/projects/${projectId}/tasks`, icon: CheckSquare },
    { name: t('wiki'), path: `/projects/${projectId}/wiki`, icon: BookOpen },
    { name: t('board'), path: `/projects/${projectId}/board`, icon: FileText },
    { name: t('memos'), path: `/projects/${projectId}/memos`, icon: Mail },
    { name: t('chat'), path: `/projects/${projectId}/chat`, icon: MessageSquare },
  ] : [
    { name: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('notices'), path: '/boards/notice', icon: Bell },
    { name: t('projects'), path: '/projects', icon: FolderKanban },
    { name: t('issues'), path: '/issues', icon: Bug },
    { name: t('memos'), path: '/memos', icon: Mail },
    { name: t('wiki'), path: '/wiki', icon: BookOpen },
    { name: t('resources'), path: '/boards/resource', icon: Archive },
    { name: t('chat'), path: '/chat', icon: MessageSquare },
  ];

  if (role === 'admin' && !isProjectContext) {
    mainNav.push({ name: t('systemManagement'), path: '/users', icon: Settings });
  }

  const isProjectMainPage = (() => {
    if (!location.pathname.startsWith('/projects/')) return false;
    const after = location.pathname.slice(10);
    if (after === 'new') return false;
    const parts = after.split('/');
    return parts.length === 2 && ['dashboard', 'members', 'settings', 'tasks', 'issues', 'kanban'].includes(parts[1]);
  })();

  const hasSidebar = isProjectMainPage || location.pathname.includes('/memos') || location.pathname.includes('/chat') || location.pathname.includes('/boards') || location.pathname.includes('/contacts') || location.pathname.includes('/wiki') || location.pathname.includes('/board') || isSystemContext;

  const sidebarProps = {
    hasSidebar,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    t,
    location,
    currentFolder,
    setCurrentFolder,
    unreadMemosCount,
    customFolders,
    isAddingFolder,
    setIsAddingFolder,
    newFolderName,
    setNewFolderName,
    handleAddFolder,
    editingFolderId,
    setEditingFolderId,
    editingFolderName,
    setEditingFolderName,
    handleRenameFolder,
    handleDeleteFolder,
    chatRooms,
    chatUnreadCounts,
    wikiList,
    navigate
  };

  return (
    <SidebarContext.Provider value={sidebarProps}>
      <div className={`app-layout ${isSidebarCollapsed && hasSidebar ? 'sidebar-collapsed' : ''} flex flex-col min-h-screen`}>
        <Header
          t={t}
          location={location}
          mainNav={mainNav}
          globalUnreadCount={globalUnreadCount}
          unreadMemosCount={unreadMemosCount}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
          isDark={isDark}
          cycleLightDark={cycleLightDark}
          initials={initials}
          username={username}
          setIsSettingsOpen={setIsSettingsOpen}
          setIsPreferencesOpen={setIsPreferencesOpen}
          handleLogout={handleLogout}
        />

        <div className="flex flex-1 relative min-h-[calc(100vh-var(--header-height))]">
          <main className="main-content flex flex-1 w-full bg-white dark:bg-transparent" aria-label="메인 콘텐츠" style={{ marginLeft: 0, paddingTop: 0 }}>
            {children}
          </main>
        </div>

        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} isDark={isDark} toggleTheme={cycleLightDark} />

        <ProfileDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          t={t}
          user={user}
          initials={initials}
          roleColor={role === 'admin' ? 'bg-rose-400' : role === 'overseer' ? 'bg-blue-400' : 'bg-emerald-400'}
          roleLabel={role === 'admin' ? t('admin') : role === 'overseer' ? t('overseer') : t('user')}
          email={email}
          setEmail={setEmail}
          lastname={lastname}
          setLastname={setLastname}
          firstname={firstname}
          setFirstname={setFirstname}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          newPasswordConfirm={newPasswordConfirm}
          setNewPasswordConfirm={setNewPasswordConfirm}
          isUpdating={isUpdating}
          handleSaveProfile={handleSaveProfile}
        />

        <PreferencesDialog
          isOpen={isPreferencesOpen}
          onOpenChange={setIsPreferencesOpen}
          t={t}
          language={language}
          setLanguage={setLanguage}
          lightDark={lightDark}
          setLightDark={setLightDark}
          colorTheme={colorTheme}
          setColorTheme={(theme) => setColorTheme(theme)}
          themes={THEMES}
        />
      </div>
    </SidebarContext.Provider>
  );
}
