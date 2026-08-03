import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../../context/SidebarContext';

interface PageLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  noPadding?: boolean;
  minimalPadding?: boolean;
}

export function PageLayout({ children, sidebar, noPadding, minimalPadding }: PageLayoutProps) {
  const { hasSidebar } = useSidebar();

  const paddingClass = noPadding
    ? ''
    : minimalPadding
    ? 'p-3 sm:p-4'
    : 'p-6';

  const containerClass = (noPadding || minimalPadding)
    ? 'h-full w-full'
    : 'max-w-7xl mx-auto';

  return (
    <div className="flex h-full w-full items-start">
      {sidebar || (hasSidebar && <Sidebar />)}
      <div id="page-scroll-container" className={`flex-1 w-full min-w-0 overflow-y-auto h-[calc(100vh-var(--header-height))] ${paddingClass}`}>
        <div className={containerClass}>
          {children}
        </div>
      </div>
    </div>
  );
}
