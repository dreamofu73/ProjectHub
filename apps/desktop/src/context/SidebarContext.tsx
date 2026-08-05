import { createContext, useContext } from 'react';
import type { Location } from 'react-router-dom';
import type { CustomFolder, ChatRoom } from 'shared/types';

export interface SidebarProps {
  hasSidebar: boolean;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  t: (key: string) => string;
  location: Location;
  currentFolder: string;
  setCurrentFolder: (folder: string) => void;
  unreadMemosCount: number;
  customFolders: CustomFolder[];
  isAddingFolder: boolean;
  setIsAddingFolder: (val: boolean) => void;
  newFolderName: string;
  setNewFolderName: (val: string) => void;
  handleAddFolder: (e: React.FormEvent) => void;
  editingFolderId: string | null;
  setEditingFolderId: (id: string | null) => void;
  editingFolderName: string;
  setEditingFolderName: (val: string) => void;
  handleRenameFolder: (id: string) => void;
  handleDeleteFolder: (id: string, e: React.MouseEvent) => void;
  chatRooms: ChatRoom[];
  chatUnreadCounts: Record<string, number>;
  wikiList: any[];
  navigate: (path: string) => void;
  isProjectManager?: boolean;
}

export const SidebarContext = createContext<SidebarProps | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
