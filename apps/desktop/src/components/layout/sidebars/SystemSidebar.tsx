import { Link, useLocation } from 'react-router-dom';
import { User, Shield, Building2, Clock, FileText, ChevronRight, Folder } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { useSidebar } from '../../../context/SidebarContext';
import { Tooltip } from 'ui/Tooltip';

export function SystemSidebar() {
  const { t } = useLanguage();
  const location = useLocation();
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useSidebar();

  const systemNav = [
    { name: t('users'), path: '/users', icon: User },
    { name: t('adminGroups'), path: '/admin/groups', icon: Shield },
    { name: t('organizationInfo') || '조직정보 관리', path: '/admin/organization', icon: Building2 },
    { name: t('scheduler'), path: '/admin/scheduler', icon: Clock },
    { name: t('projectManagement') || '프로젝트 관리', path: '/admin/projects', icon: Folder },
    { name: t('logs') || '로그 관리', path: '/admin/logs', icon: FileText },
  ];

  return (
    <aside className="sidebar relative overflow-visible h-[calc(100vh-var(--header-height))] sticky top-0 z-40 border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30" aria-label={t('systemManagement')}>
      <div className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col ${isSidebarCollapsed ? 'p-2' : 'p-4'} pb-14 justify-between h-full`}>
        <div className="flex flex-col gap-3">
          {!isSidebarCollapsed && (
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">
              {t('systemManagement')}
            </div>
          )}
          <ul className="sidebar-nav" aria-label="시스템 관리 메뉴">
            {systemNav.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path} className="sidebar-nav-item">
                  <Tooltip content={item.name} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={item.path}
                      className={`sidebar-nav-link ${isActive ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <item.icon size={16} className={`shrink-0 ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="sidebar-toggle-btn z-50"
        aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-expanded={!isSidebarCollapsed}
      >
        <ChevronRight size={14} className={isSidebarCollapsed ? '' : 'rotate-180 transition-transform'} />
      </button>
    </aside>
  );
}
