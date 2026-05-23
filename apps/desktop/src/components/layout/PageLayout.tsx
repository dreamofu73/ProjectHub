import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../../context/SidebarContext';

interface PageLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  noPadding?: boolean;
}

export function PageLayout({ children, sidebar, noPadding }: PageLayoutProps) {
  const { hasSidebar } = useSidebar();

  return (
    <div className="flex h-full w-full items-start">
      {sidebar || (hasSidebar && <Sidebar />)}
      <div id="page-scroll-container" className={`flex-1 w-full min-w-0 overflow-y-auto h-[calc(100vh-var(--header-height))] ${noPadding ? '' : 'p-6'}`}>
        <div className={noPadding ? 'h-full' : 'max-w-7xl mx-auto'}>
          {children}
        </div>
      </div>
    </div>
  );
}
