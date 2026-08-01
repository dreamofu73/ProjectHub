import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {  ChevronRight, Plus, Send, Inbox, Award, Clock, Archive, Trash2, Folder, Edit2, X, MessageSquare, Bell, Users, FileText, Search, Home, Settings, Columns3, ChevronDown, CheckSquare , BarChart } from 'lucide-react';
import { Tooltip } from 'ui/Tooltip';
import { useSidebar } from '../../context/SidebarContext';
import type { WikiPage } from 'shared/types';

interface WikiPageNode extends WikiPage {
  children: WikiPageNode[];
}

function buildWikiTree(pages: WikiPage[]): WikiPageNode[] {
  const map = new Map<string, WikiPageNode>();
  const roots: WikiPageNode[] = [];

  pages.forEach(page => {
    map.set(page.id, { ...page, children: [] });
  });

  pages.forEach(page => {
    const node = map.get(page.id)!;
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function WikiTreeItem({ page, location, isSidebarCollapsed, navigate, t, depth = 0 }: { page: WikiPageNode, location: any, isSidebarCollapsed: boolean, navigate: any, t: any, depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = page.children.length > 0;
  const isActive = location.search.includes(`id=${page.id}`);

  return (
    <>
      <li className="sidebar-nav-item">
        <Tooltip content={page.title} disabled={!isSidebarCollapsed} position="right">
          <div 
            className={`flex items-center justify-between group w-full py-1.5 pr-2 rounded-md cursor-pointer transition-colors ${isActive ? 'bg-[var(--sidebar-link-active-bg)] text-[var(--sidebar-link-active-color)] font-medium' : 'hover:bg-[var(--sidebar-link-hover-bg)] text-[var(--sidebar-link-color)] hover:text-[var(--sidebar-link-hover-color)]'}`}
            style={{ paddingLeft: `${0.5 + depth * 1.5}rem` }}
          >
            <div className="flex items-center flex-1 min-w-0">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className={`p-0.5 rounded border-none bg-transparent cursor-pointer flex-shrink-0 ${isActive ? 'text-[var(--sidebar-link-active-color)] hover:bg-black/10 dark:hover:bg-white/10' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              {!hasChildren && <div className="w-5" />}
              <Link
                to={`${location.pathname.split('?')[0]}?id=${page.id}`}
                className={`flex flex-1 items-center gap-2 truncate ${isSidebarCollapsed ? 'justify-center' : ''}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <FileText size={16} className={`shrink-0 ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                {!isSidebarCollapsed && <span className="truncate">{page.title}</span>}
              </Link>
            </div>
            {!isSidebarCollapsed && (
              <Link
                to={`${location.pathname.split('?')[0]}?id=new&parent_id=${page.id}`}
                className={`p-1 ml-auto opacity-0 group-hover:opacity-100 rounded border-none bg-transparent cursor-pointer flex items-center transition-opacity ${isActive ? 'text-[var(--sidebar-link-active-color)] hover:bg-black/10 dark:hover:bg-white/10' : 'text-slate-400 hover:text-[var(--primary)] hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                title="하위 페이지 생성"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus size={14} />
              </Link>
            )}
          </div>
        </Tooltip>
      </li>
      {isExpanded && hasChildren && (
        <ul className="flex flex-col gap-0.5">
          {page.children.map(child => (
            <WikiTreeItem key={child.id} page={child} location={location} isSidebarCollapsed={isSidebarCollapsed} navigate={navigate} t={t} depth={depth + 1} />
          ))}
        </ul>
      )}
    </>
  );
}

export function Sidebar() {
  const props = useSidebar();
  const {
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
  } = props;

  // 프로젝트 게시판 내비 — 경로/쿼리 문자열 includes 대신 정확 비교
  const projectBoardBase: string = location.pathname.match(/^(\/projects\/[^/]+)\/board/)?.[1]
    ?? location.pathname.split('/board')[0];
  const boardCategory = new URLSearchParams(location.search).get('category');
  const isBoardCategoryActive = (category: string | null) =>
    category === null
      ? !boardCategory && location.pathname.endsWith('/board')
      : boardCategory === category;

  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const wikiTree = useMemo(() => buildWikiTree((wikiList as WikiPage[]) || []), [wikiList]);

  return (
    <aside className="sidebar relative overflow-visible h-[calc(100vh-var(--header-height))] sticky top-0 z-40 border-r border-[var(--border)] bg-slate-50/30 dark:bg-slate-900/30" aria-label={t('sidebar') || '사이드바 네비게이션'}>
      <div className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col ${isSidebarCollapsed ? 'p-2' : 'p-4'} pb-14 justify-between h-full`}>
        <div>
          {/* 프로젝트 메뉴 사이드바 (초기화면 / 멤버 / 설정) */}
          {(location.pathname.match(/^\/projects\/[^/]+\/(dashboard|members|settings)$/) ?? false) && (
            <div className="sidebar-section">
              {!isSidebarCollapsed && <div className="sidebar-section-label">프로젝트 메뉴</div>}
              <ul className="sidebar-nav" aria-label="프로젝트 메뉴">
                <li className="sidebar-nav-item">
                  <Tooltip content="초기화면" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/dashboard`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/dashboard') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <Home size={16} className={`shrink-0 ${location.pathname.endsWith('/dashboard') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>초기화면</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content="멤버" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/members`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/members') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <Users size={16} className={`shrink-0 ${location.pathname.endsWith('/members') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>멤버</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content="설정" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/settings`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/settings') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <Settings size={16} className={`shrink-0 ${location.pathname.endsWith('/settings') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>설정</span>}
                    </Link>
                  </Tooltip>
                </li>
              </ul>
            </div>
          )}

          {/* 일감 사이드바 (일감 / 간트차트) */}
          {(location.pathname.match(/^\/projects\/[^/]+\/tasks$/) ?? false) && (
            <div className="sidebar-section">
              {!isSidebarCollapsed && <div className="sidebar-section-label">일감</div>}
              <ul className="sidebar-nav" aria-label="일감 메뉴">
                <li className="sidebar-nav-item">
                  <Tooltip content="일감" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/tasks`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/tasks') && !location.search.includes('view=gantt') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <CheckSquare size={16} className={`shrink-0 ${location.pathname.endsWith('/tasks') && !location.search.includes('view=gantt') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>일감</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content="간트차트" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/tasks?view=gantt`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/tasks') && location.search.includes('view=gantt') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <BarChart size={16} className={`shrink-0 ${location.pathname.endsWith('/tasks') && location.search.includes('view=gantt') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>간트차트</span>}
                    </Link>
                  </Tooltip>
                </li>
              </ul>
            </div>
          )}

          {/* 이슈 사이드바 (이슈 / 칸반보드) */}
          {(location.pathname.match(/^\/projects\/[^/]+\/(issues|kanban)$/) ?? false) && (
            <div className="sidebar-section">
              {!isSidebarCollapsed && <div className="sidebar-section-label">이슈</div>}
              <ul className="sidebar-nav" aria-label="이슈 메뉴">
                <li className="sidebar-nav-item">
                  <Tooltip content="이슈" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/issues`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/issues') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <FileText size={16} className={`shrink-0 ${location.pathname.endsWith('/issues') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>이슈</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content="칸반보드" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`/projects/${location.pathname.split('/')[2]}/kanban`}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/kanban') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <Columns3 size={16} className={`shrink-0 ${location.pathname.endsWith('/kanban') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>칸반보드</span>}
                    </Link>
                  </Tooltip>
                </li>
              </ul>
            </div>
          )}

          {(location.pathname.includes('/memos') || location.pathname.includes('/contacts')) && (
            <div className="sidebar-section">
              {!isSidebarCollapsed && (
                <div className="grid grid-cols-2 gap-2 mb-4 animate-in fade-in duration-300">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open_compose_memo', { detail: { self: false } }))}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:shadow-lg cursor-pointer border-none hover:opacity-90"
                    style={{ background: 'var(--primary)' }}
                    aria-label="쪽지쓰기"
                  >
                    <Send size={13} />
                    쪽지쓰기
                  </button>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open_compose_memo', { detail: { self: true } }))}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer border hover:opacity-90"
                    style={{
                      background: 'var(--primary-10, color-mix(in srgb, var(--primary) 10%, transparent))',
                      borderColor: 'var(--primary-30, color-mix(in srgb, var(--primary) 30%, transparent))',
                      color: 'var(--primary)',
                    }}
                    aria-label="내게쓰기"
                  >
                    <Award size={13} />
                    내게쓰기
                  </button>
                </div>
              )}
              
              {!isSidebarCollapsed && <div className="sidebar-section-label">마이 쪽지함</div>}
              <ul className="sidebar-nav" aria-label="쪽지함 목록">
                <li className="sidebar-nav-item">
                  <Tooltip content={t('receivedMemos')} disabled={!isSidebarCollapsed} position="right">
                    <button
                      onClick={() => setCurrentFolder('received')}
                      className={`sidebar-nav-link ${location.pathname.includes('/memos') && currentFolder === 'received' ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''} relative`}
                      aria-current={location.pathname.includes('/memos') && currentFolder === 'received' ? 'true' : undefined}
                    >
                      <Inbox size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === 'received' ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('receivedMemos')}</span>}
                      {!isSidebarCollapsed && unreadMemosCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-xs font-extrabold leading-none animate-bounce-in">
                          {unreadMemosCount}
                        </span>
                      )}
                    </button>
                  </Tooltip>
                </li>
                


                <li className="sidebar-nav-item">
                  <Tooltip content="내게쓴쪽지함" disabled={!isSidebarCollapsed} position="right">
                    <button
                      onClick={() => setCurrentFolder('self')}
                      className={`sidebar-nav-link ${location.pathname.includes('/memos') && currentFolder === 'self' ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.includes('/memos') && currentFolder === 'self' ? 'true' : undefined}
                    >
                      <Award size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === 'self' ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>내게쓴쪽지함</span>}
                    </button>
                  </Tooltip>
                </li>

                <li className="sidebar-nav-item">
                  <Tooltip content={t('sentMemos')} disabled={!isSidebarCollapsed} position="right">
                    <button
                      onClick={() => setCurrentFolder('sent')}
                      className={`sidebar-nav-link ${location.pathname.includes('/memos') && currentFolder === 'sent' ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.includes('/memos') && currentFolder === 'sent' ? 'true' : undefined}
                    >
                      <Send size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === 'sent' ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('sentMemos')}</span>}
                    </button>
                  </Tooltip>
                </li>

                <li className="sidebar-nav-item">
                  <Tooltip content="예약쪽지함" disabled={!isSidebarCollapsed} position="right">
                    <button
                      onClick={() => setCurrentFolder('reserved')}
                      className={`sidebar-nav-link ${location.pathname.includes('/memos') && currentFolder === 'reserved' ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.includes('/memos') && currentFolder === 'reserved' ? 'true' : undefined}
                    >
                      <Clock size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === 'reserved' ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>예약쪽지함</span>}
                    </button>
                  </Tooltip>
                </li>

                <li className="sidebar-nav-item">
                  <Tooltip content="쪽지보관함" disabled={!isSidebarCollapsed} position="right">
                    <button
                      onClick={() => setCurrentFolder('archived')}
                      className={`sidebar-nav-link ${location.pathname.includes('/memos') && currentFolder === 'archived' ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.includes('/memos') && currentFolder === 'archived' ? 'true' : undefined}
                    >
                      <Archive size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === 'archived' ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>쪽지보관함</span>}
                    </button>
                  </Tooltip>
                </li>

                <li className="sidebar-nav-item">
                  <Tooltip content="휴지통" disabled={!isSidebarCollapsed} position="right">
                    <button
                      onClick={() => setCurrentFolder('trash')}
                      className={`sidebar-nav-link ${location.pathname.includes('/memos') && currentFolder === 'trash' ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.includes('/memos') && currentFolder === 'trash' ? 'true' : undefined}
                    >
                      <Trash2 size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === 'trash' ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>휴지통</span>}
                    </button>
                  </Tooltip>
                </li>

                {/* ── 구분선 ── */}
                {!isSidebarCollapsed && <div className="border-t border-[var(--border)] my-3 mx-2" />}

                <li className="sidebar-nav-item">
                  <Tooltip content="수신그룹" disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={location.pathname.includes('/projects/') ? `/projects/${location.pathname.split('/')[2]}/contacts` : "/contacts"}
                      className={`sidebar-nav-link ${location.pathname.endsWith('/contacts') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.endsWith('/contacts') ? 'page' : undefined}
                    >
                      <Users size={16} className={`shrink-0 ${location.pathname.endsWith('/contacts') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>수신그룹</span>}
                    </Link>
                  </Tooltip>
                </li>

                {!isSidebarCollapsed && <div className="border-t border-[var(--border)] my-3 mx-2" />}

                {!isSidebarCollapsed && (
                  <>
                    <div className="sidebar-section-label flex items-center justify-between mb-1 px-1">
                      <span id="custom-folders-label">내 폴더</span>
                      <button
                        onClick={() => setIsAddingFolder(!isAddingFolder)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded text-slate-400 hover:text-[var(--primary)] border-none bg-transparent cursor-pointer flex items-center"
                        title="폴더 추가"
                        aria-label={isAddingFolder ? '폴더 추가 취소' : '새 폴더 추가'}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    
                    {isAddingFolder && (
                      <form onSubmit={handleAddFolder} className="px-3 mb-2 flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="폴더명..."
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          className="w-full h-7 px-2 border border-[var(--border)] rounded bg-white dark:bg-slate-950 text-xs focus:outline-none text-foreground"
                          autoFocus
                          aria-label="새 폴더 이름 입력"
                        />
                        <button
                          type="submit"
                          className="h-7 px-2 bg-[var(--primary)] text-white rounded text-xs font-bold border-none cursor-pointer hover:opacity-90 shrink-0"
                          aria-label="폴더 생성"
                        >
                          생성
                        </button>
                      </form>
                    )}

                    {customFolders.map(folder => (
                      <li key={folder.id} className="sidebar-nav-item">
                        <Tooltip content={folder.name} disabled={!isSidebarCollapsed} position="right">
                          {editingFolderId === folder.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRenameFolder(folder.id);
                              }}
                              className="flex items-center gap-1 w-full px-2 py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingFolderName}
                                onChange={(e) => setEditingFolderName(e.target.value)}
                                onBlur={() => handleRenameFolder(folder.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setEditingFolderId(null);
                                  }
                                }}
                                className="w-full h-7 px-2 border border-[var(--border)] rounded-lg bg-white dark:bg-slate-950 text-xs focus:outline-none text-foreground"
                                autoFocus
                                aria-label="폴더 이름 변경 입력"
                              />
                            </form>
                          ) : (
                            <div
                              onClick={() => setCurrentFolder(`folder_${folder.id}`)}
                              className={`sidebar-nav-link group relative cursor-pointer ${
                                location.pathname.includes('/memos') && currentFolder === `folder_${folder.id}` ? 'active' : ''
                              } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                              role="button"
                              tabIndex={0}
                              aria-current={location.pathname.includes('/memos') && currentFolder === `folder_${folder.id}` ? 'true' : undefined}
                            >
                              <Folder size={16} className={`shrink-0 ${location.pathname.includes('/memos') && currentFolder === ('folder_' + folder.id) ? 'opacity-100' : 'opacity-60'}`} />
                              {!isSidebarCollapsed && <span className="truncate flex-1 pr-10">{folder.name}</span>}
                              {!isSidebarCollapsed && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingFolderId(folder.id);
                                      setEditingFolderName(folder.name);
                                    }}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-[var(--primary)] border-none bg-transparent cursor-pointer flex items-center"
                                    title="이름 변경"
                                    aria-label={`${folder.name} 폴더 이름 변경`}
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                                    className="p-1 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 rounded text-slate-400 border-none bg-transparent cursor-pointer flex items-center"
                                    title="폴더 삭제"
                                    aria-label={`${folder.name} 폴더 삭제`}
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </Tooltip>
                      </li>
                    ))}
                    {customFolders.length === 0 && !isAddingFolder && (
                      <li className="text-xs text-[var(--text-muted)] pl-3 py-1">생성된 폴더가 없습니다.</li>
                    )}
                  </>
                )}
              </ul>
            </div>
          )}

          {location.pathname.startsWith('/boards') && (
            <div className="sidebar-section">
              {!isSidebarCollapsed && <div className="sidebar-section-label">게시판 목록</div>}
              <ul className="sidebar-nav" aria-label="게시판 목록">
                <li className="sidebar-nav-item">
                  <Tooltip content={t('notices')} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to="/boards/notice"
                      className={`sidebar-nav-link ${location.pathname.startsWith('/boards/notice') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.startsWith('/boards/notice') ? 'page' : undefined}
                    >
                      <Bell size={16} className={`shrink-0 ${location.pathname.startsWith('/boards/notice') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('notices')}</span>}
                    </Link>
                  </Tooltip>
                </li>
                
                <li className="sidebar-nav-item">
                  <Tooltip content={t('resources')} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to="/boards/resource"
                      className={`sidebar-nav-link ${location.pathname.startsWith('/boards/resource') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={location.pathname.startsWith('/boards/resource') ? 'page' : undefined}
                    >
                      <Archive size={16} className={`shrink-0 ${location.pathname.startsWith('/boards/resource') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('resources')}</span>}
                    </Link>
                  </Tooltip>
                </li>
              </ul>
            </div>
          )}

          {location.pathname.includes('/board') && !location.pathname.startsWith('/boards') && (
            <div className="sidebar-section">
              {!isSidebarCollapsed && <div className="sidebar-section-label">게시판 목록</div>}
              <ul className="sidebar-nav" aria-label="게시판 목록">
                <li className="sidebar-nav-item">
                  <Tooltip content={t('all') || '전체'} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`${projectBoardBase}/board`}
                      className={`sidebar-nav-link ${isBoardCategoryActive(null) ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={isBoardCategoryActive(null) ? 'page' : undefined}
                    >
                      <FileText size={16} className={`shrink-0 ${isBoardCategoryActive(null) ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('all') || '전체'}</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content={t('notices') || '공지사항'} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`${projectBoardBase}/board?category=notice`}
                      className={`sidebar-nav-link ${isBoardCategoryActive('notice') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={isBoardCategoryActive('notice') ? 'page' : undefined}
                    >
                      <Bell size={16} className={`shrink-0 ${isBoardCategoryActive('notice') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('notices') || '공지사항'}</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content={t('resources') || '자료실'} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`${projectBoardBase}/board?category=resource`}
                      className={`sidebar-nav-link ${isBoardCategoryActive('resource') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={isBoardCategoryActive('resource') ? 'page' : undefined}
                    >
                      <Archive size={16} className={`shrink-0 ${isBoardCategoryActive('resource') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('resources') || '자료실'}</span>}
                    </Link>
                  </Tooltip>
                </li>
                <li className="sidebar-nav-item">
                  <Tooltip content={t('general') || '일반'} disabled={!isSidebarCollapsed} position="right">
                    <Link
                      to={`${projectBoardBase}/board?category=general`}
                      className={`sidebar-nav-link ${isBoardCategoryActive('general') ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                      aria-current={isBoardCategoryActive('general') ? 'page' : undefined}
                    >
                      <FileText size={16} className={`shrink-0 ${isBoardCategoryActive('general') ? 'opacity-100' : 'opacity-60'}`} />
                      {!isSidebarCollapsed && <span>{t('general') || '일반'}</span>}
                    </Link>
                  </Tooltip>
                </li>
              </ul>
            </div>
          )}

          {location.pathname.includes('/chat') && (
            <div className="sidebar-section animate-in fade-in duration-300">
              {!isSidebarCollapsed && (
                <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider select-none">
                    {t('channel')}
                  </span>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open_create_chat_room'))}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-[var(--bg-surface-2)] transition-colors border-none bg-transparent cursor-pointer"
                    title={t('chatNewRoomBtn') || '새 채널 생성'}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}

              <ul className="sidebar-nav" aria-label="채팅 채널 목록">
                {chatRooms.map(room => {
                  const params = new URLSearchParams(location.search);
                  const activeRoomId = params.get('room') ? String(params.get('room')!) : null;
                  const isActive = activeRoomId === String(room.id);
                  const unreadCount = chatUnreadCounts[room.id] || 0;
                  return (
                    <li key={room.id} className="sidebar-nav-item">
                      <Tooltip content={room.name} disabled={!isSidebarCollapsed} position="right">
                        <button
                          onClick={() => navigate(`${location.pathname.split('?')[0]}?room=${room.id}`)}
                          className={`relative w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all cursor-pointer border-none text-left ${
                            isActive
                              ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)] font-medium bg-transparent'
                          } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                          aria-current={isActive ? 'true' : undefined}
                          aria-label={`${room.name}${unreadCount > 0 ? `, 안 읽은 메시지 ${unreadCount}개` : ''}`}
                        >
                          {isActive && !isSidebarCollapsed && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--primary)] rounded-r-full" />
                          )}
                          <MessageSquare size={14} className={isActive ? 'text-[var(--primary)] shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                          {!isSidebarCollapsed && <span className="truncate flex-1">{room.name}</span>}
                          {unreadCount > 0 && (
                            <span className={`min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0 ${isSidebarCollapsed ? 'absolute top-0 right-0' : 'ml-auto'}`}>
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </button>
                      </Tooltip>
                    </li>
                  );
                })}

                {chatRooms.length === 0 && !isSidebarCollapsed && (
                  <div className="flex flex-col items-center text-center py-8 px-3 gap-2">
                    <MessageSquare size={24} className="text-[var(--text-muted)]" />
                    <p className="text-xs text-[var(--text-muted)]">{t('chatNoProjectChannels') || '참여 중인 채널이 없습니다.'}</p>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('open_create_chat_room'))}
                      className="text-xs text-[var(--primary)] hover:underline bg-transparent border-none cursor-pointer font-semibold"
                      aria-label={t('addNewChannel') || '새 채널 추가'}
                    >
                      + {t('addNewChannel') || '채널 추가'}
                    </button>
                  </div>
                )}
              </ul>
            </div>
          )}
          {location.pathname.includes('/wiki') && (
            <div className="sidebar-section animate-in fade-in duration-300">
              {!isSidebarCollapsed && (
                <button
                  onClick={() => {
                    const pathSegments = location.pathname.split('/').filter(Boolean);
                    const projectId = pathSegments[0] === 'projects' ? pathSegments[1] : null;
                    const path = projectId ? `/projects/${projectId}/wiki?id=new` : `/wiki?id=new`;
                    navigate(path);
                  }}
                  className="flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:shadow-lg cursor-pointer border-none hover:opacity-90 w-full mb-4"
                  style={{ background: 'var(--primary)' }}
                >
                  <Plus size={13} />
                  {t('newWikiPage')}
                </button>
              )}

              {!isSidebarCollapsed && <div className="sidebar-section-label">위키 인덱스</div>}

              {!isSidebarCollapsed && (
                <div className="relative w-full mb-2">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder={t('wikiSearchPlaceholder')}
                    value={wikiSearchQuery}
                    onChange={(e) => setWikiSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-[var(--bg-surface-2)] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-[var(--primary)] focus:bg-[var(--bg-surface)] transition-all text-slate-700 dark:text-slate-200"
                  />
                </div>
              )}

              <ul className="sidebar-nav" aria-label="위키 페이지 목록">
                {wikiSearchQuery ? (
                  ((wikiList as WikiPage[]) || [])
                    .filter(page => page.title.toLowerCase().includes(wikiSearchQuery.toLowerCase()))
                    .map(page => (
                      <li key={page.id} className="sidebar-nav-item">
                        <Tooltip content={page.title} disabled={!isSidebarCollapsed} position="right">
                          <Link
                to={`${location.pathname.split('?')[0]}?id=${page.id}`}
                            className={`sidebar-nav-link ${location.search.includes(`id=${page.id}`) ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                          >
                            <FileText size={16} className={`shrink-0 ${location.search.includes(`id=${page.id}`) ? 'opacity-100' : 'opacity-60'}`} />
                            {!isSidebarCollapsed && <span className="truncate">{page.title}</span>}
                          </Link>
                        </Tooltip>
                      </li>
                    ))
                ) : (
                  wikiTree.map(page => (
                    <WikiTreeItem key={page.id} page={page} location={location} isSidebarCollapsed={isSidebarCollapsed} navigate={navigate} t={t} />
                  ))
                )}
                {((wikiList as WikiPage[]) || []).filter(page => page.title.toLowerCase().includes(wikiSearchQuery.toLowerCase())).length === 0 && !isSidebarCollapsed && (
                  <div className="text-xs text-[var(--text-muted)] text-center py-4">
                    {wikiSearchQuery ? t('noMatchingWiki') : t('noWikiPagesRegistered')}
                  </div>
                )}
              </ul>
            </div>
          )}
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
