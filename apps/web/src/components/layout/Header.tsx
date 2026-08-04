import { Link, useNavigate, type Location } from 'react-router-dom';
import { Search, Sun, Moon, Settings, LogOut, Bell, type LucideIcon } from 'lucide-react';
import { Button } from 'ui/Button';
import { ProjectHubLogo } from 'ui/ProjectHubLogo';
import { api } from 'shared/lib/api';
import { useState, useEffect, useCallback } from 'react';
import type { Notification } from 'shared/types';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface HeaderProps {
  t: (key: string) => string;
  location: Location;
  mainNav: NavItem[];
  globalUnreadCount: number;
  unreadMemosCount: number;
  setIsCommandPaletteOpen: (val: boolean) => void;
  isDark: boolean;
  cycleLightDark: () => void;
  initials: string;
  username: string;
  setIsSettingsOpen: (val: boolean) => void;
  setIsPreferencesOpen: (val: boolean) => void;
  handleLogout: () => void;
}

export function Header({
  t,
  location,
  mainNav,
  globalUnreadCount,
  unreadMemosCount,
  setIsCommandPaletteOpen,
  isDark,
  cycleLightDark,
  initials,
  username,
  setIsSettingsOpen,
  setIsPreferencesOpen,
  handleLogout
}: HeaderProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api('/api/notifications?unread_only=true');
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const handleReadNotif = async (id: string, link: string | null) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications();
      if (link) {
        navigate(link);
      }
      setIsNotifOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReadAllNotifs = async () => {
    try {
      const res = await api('/api/notifications/read-all', { method: 'PUT' });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unreadNotifCount = notifications.length;
  return (
    <header className="app-header-nav flex items-center justify-between px-4 sm:px-6 py-2 border-b border-border bg-white dark:bg-slate-950 sticky top-0 z-[100] h-[var(--header-height)]">
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 min-w-0 shrink">
        <Link to="/dashboard" className="flex items-center gap-2.5 text-[var(--primary)] hover:opacity-85 no-underline shrink-0 group">
          <ProjectHubLogo size={26} className="text-[var(--primary)] transition-transform group-hover:scale-105" />
          <span className="font-extrabold text-base tracking-tight hidden sm:inline text-[var(--primary)]">ProjectHub</span>
        </Link>
        
        <div className="hidden xl:block h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
        
        <nav className="flex items-center gap-1 shrink-0" aria-label={t('mainNavigation')}>
          {mainNav.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2 lg:px-3 py-1 rounded-xl text-xs font-extrabold transition-all relative no-underline whitespace-nowrap min-w-[36px] lg:min-w-[56px] ${
                  isActive 
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-800'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon size={18} className={isActive ? 'opacity-100' : 'opacity-70'} />
                <span className="hidden lg:inline text-xs mt-0.5">{item.name}</span>
                {item.path === '/chat' && globalUnreadCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1 right-3.5" aria-label={t('unreadChatMessages')} />
                )}
                {item.path === '/memos' && unreadMemosCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1 right-3.5" aria-label={t('unreadMemos')} />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-3 min-w-0 shrink">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-none btn-icon w-8 h-8 flex items-center justify-center p-0 hover:bg-slate-100 dark:hover:bg-slate-900"
          icon={Search}
          onClick={() => setIsCommandPaletteOpen(true)}
          title={t('searchPlaceholder')}
          aria-label={`${t('searchPlaceholder')} (⌘K)`}
        />

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-none btn-icon w-8 h-8 flex items-center justify-center p-0 hover:bg-slate-100 dark:hover:bg-slate-900"
          icon={isDark ? Sun : Moon}
          onClick={cycleLightDark}
          aria-label={isDark ? t('lightMode') : t('darkMode')}
        />

        {/* 알림 센터 */}
        <div className="relative flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-none btn-icon w-8 h-8 flex items-center justify-center p-0 hover:bg-slate-100 dark:hover:bg-slate-900"
            icon={Bell}
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            aria-label={t('notification')}
          />
          {unreadNotifCount > 0 && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 text-xs font-bold text-white rounded-full flex items-center justify-center pointer-events-none select-none">
              {unreadNotifCount}
            </span>
          )}

          {isNotifOpen && (
            <div className="absolute right-0 top-9 w-72 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-[200] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between p-3 border-b border-slate-150 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30">
                <span className="font-bold text-xs">{t('notificationCenter')}</span>
                {unreadNotifCount > 0 && (
                  <button
                    onClick={handleReadAllNotifs}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline border-none bg-transparent cursor-pointer"
                  >
                    {t('markAllRead')}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto max-h-60 divide-y divide-slate-100 dark:divide-slate-900">
                {unreadNotifCount === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-400 font-medium">{t('noNewNotifications')}</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleReadNotif(notif.id, notif.link)}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-all flex flex-col gap-1 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                          {notif.title}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {notif.created_at.slice(5, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-350 font-medium leading-normal whitespace-normal break-words">
                        {notif.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden xl:block h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none"
            title={t('editProfile')}
            aria-label={`${t('editProfile')}: ${username}`}
          >
            <div className="w-7.5 h-7.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold" aria-hidden="true">
              {initials}
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-350 hidden xl:inline-block max-w-[80px] truncate">{username}</span>
          </button>

          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-none btn-icon w-7.5 h-7.5 flex items-center justify-center p-0 hover:bg-slate-100 dark:hover:bg-slate-900"
            icon={Settings}
            onClick={() => setIsPreferencesOpen(true)}
            title={t('settings')}
            aria-label={t('settings')}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 border-none btn-icon w-7.5 h-7.5 flex items-center justify-center p-0 hover:bg-slate-100 dark:hover:bg-slate-900"
            icon={LogOut}
            onClick={handleLogout}
            title={t('logout')}
            aria-label={t('logout')}
          />
        </div>
      </div>
    </header>
  );
}
