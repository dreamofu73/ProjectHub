import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  BookOpen, Edit2, X, Save, Paperclip, 
  Trash2, Calendar, User, Clock, RotateCcw,
  HelpCircle, ChevronRight
} from 'lucide-react';
import { HTMLEditor, createHTMLEditorLabels } from 'ui/HTMLEditor';
import { Button } from 'ui/Button';
import { Input } from 'ui/Input';
import { useLanguage } from '../../context/LanguageContext';
import { api } from 'shared/lib/api';
import { FileUploader } from "ui/FileUploader";
import { AttachmentList } from "ui/AttachmentList";
import { uploadFilesWithProgress } from "shared/lib/upload";
import { sanitizeHtml } from 'shared/lib/sanitize';
import { WikiComments } from './WikiComments';

import type { Project, WikiPage as ActiveWikiPage, Attachment, CreateWikiPageRequest, UpdateWikiPageRequest } from 'shared/types';

interface WikiVersion {
  id: string;
  wiki_page_id: string;
  title: string;
  content: string;
  author_id: string;
  author_login: string;
  author_name: string;
  version: number;
  created_at: string;
}

interface WikiClientProps {
  project?: Project;
  wikiList: ActiveWikiPage[];
  activePage: ActiveWikiPage | null;
  initialId: string | null;
  isArchived?: boolean;
}

interface TocItem {
  text: string;
  level: number;
  id: string;
}

/** Inject id attributes into <h1>/<h2>/<h3> tags so TOC links can scroll precisely */
function injectHeadingIds(html: string): string {
  return html.replace(/<h([1-3])(?:\s[^>]*)?>(.+?)<\/h\1>/gi, (match, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '');
    const id = text.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣-]/g, '');
    // If heading already has an id attribute, keep it; otherwise add one
    if (/id\s*=/.test(match)) return match;
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

export default function WikiClient({ project, wikiList, activePage, initialId, isArchived }: WikiClientProps) {
  const { formatDateTime, t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(
    activePage ? 'view' : 'create'
  );
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [title, setTitle] = useState(activePage?.title || (!initialId ? 'Home' : ''));
  const [content, setContent] = useState(activePage?.content || '');
  const [parentId, setParentId] = useState<string | null>(
    activePage?.parent_id || searchParams.get('parent_id') || null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Version history state
  const [versions, setVersions] = useState<WikiVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<WikiVersion | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // New States for TOC and Navigation
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    if (activePage?.id) {
      fetchAttachments(activePage.id);
    }
  }, [activePage]);

  // Extract headings from HTML content for TOC
  useEffect(() => {
    if (mode === 'view' && content) {
      const extractedToc: TocItem[] = [];
      // Parse HTML headings using regex
      const headingRegex = /<h([1-3])(?:\s[^>]*)?>(.+?)<\/h\1>/gi;
      let match;
      while ((match = headingRegex.exec(content)) !== null) {
        const level = Number(match[1]);
        const text = match[2].replace(/<[^>]+>/g, ''); // strip inner HTML tags
        const id = text.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣-]/g, '');
        extractedToc.push({ text, level, id });
      }
      setToc(extractedToc);
      if (extractedToc.length > 0) {
        setShowToc(true);
      } else {
        setShowToc(false);
      }
    } else {
      setToc([]);
      setShowToc(false);
    }
  }, [content, mode]);

  // Sync scroll position to highlight currently viewed TOC section
  useEffect(() => {
    if (mode !== 'view') return;

    const handleScroll = () => {
      const previewEl = document.querySelector('.md-preview');
      const scrollContainer = document.getElementById('page-scroll-container') || window;
      if (!previewEl) return;

      const headers = Array.from(previewEl.querySelectorAll('h1, h2, h3'));
      const scrollTop = scrollContainer === window ? window.scrollY : (scrollContainer as HTMLElement).scrollTop;
      const scrollPosition = scrollTop + 120; // 120px offset from viewport top

      let currentActive = '';
      for (let i = 0; i < headers.length; i++) {
        const el = headers[i] as HTMLElement;
        if (el.offsetTop <= scrollPosition) {
          currentActive = el.innerText.trim();
        } else {
          break;
        }
      }

      if (headers.length > 0 && (headers[0] as HTMLElement).offsetTop > scrollPosition) {
        currentActive = '';
      }

      setActiveHeading(currentActive);
    };

    const scrollContainer = document.getElementById('page-scroll-container') || window;
    scrollContainer.addEventListener('scroll', handleScroll);
    // Trigger initially
    const timer = setTimeout(handleScroll, 300);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [mode, content]);

  const scrollToHeading = (text: string) => {
    const scrollContainer = document.getElementById('page-scroll-container') || window;
    
    // First try precise id lookup (headings have injected ids)
    const id = text.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣-]/g, '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        if (scrollContainer === window) {
          window.scrollBy({ top: -80, behavior: 'smooth' });
        } else {
          (scrollContainer as HTMLElement).scrollBy({ top: -80, behavior: 'smooth' });
        }
      }, 100);
      return;
    }

    // Fallback: text matching inside .md-preview
    const previewEl = document.querySelector('.md-preview');
    if (!previewEl) return; 

    const headers = previewEl.querySelectorAll('h1, h2, h3');
    for (let i = 0; i < headers.length; i++) {
      const el = headers[i] as HTMLElement;
      if (el.innerText.trim() === text.trim()) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Compensate for top fixed navbar offset
        setTimeout(() => {
          if (scrollContainer === window) {
            window.scrollBy({ top: -80, behavior: 'smooth' });
          } else {
            (scrollContainer as HTMLElement).scrollBy({ top: -80, behavior: 'smooth' });
          }
        }, 100);
        break;
      }
    }
  };

  const fetchAttachments = async (pageId: string) => {
    try {
      const res = await api(`/api/wiki/${pageId}/attachments`);
      const json = await res.json();
      if (res.ok && json.success) {
        setAttachments(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    }
  };

  const getBreadcrumbs = (pageId: string | null, allPages: ActiveWikiPage[]): ActiveWikiPage[] => {
    const breadcrumbs: ActiveWikiPage[] = [];
    let currentId = pageId;
    
    while (currentId) {
      const page = allPages.find(p => p.id === currentId);
      if (!page) break;
      breadcrumbs.unshift(page);
      currentId = page.parent_id || null;
    }
    
    return breadcrumbs;
  };

  const handleEditClick = () => {
    if (!activePage) return;
    setTitle(activePage.title);
    setContent(activePage.content || '');
    setParentId(activePage.parent_id || null);
    setMode('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!title.trim()) {
      setError(t('wikiTitleRequired'));
      setIsLoading(false);
      return;
    }

    try {
      if (mode === 'create') {
        const payload: CreateWikiPageRequest = {
          project_id: project?.id ?? null,
          title,
          content,
          parent_id: parentId,
        };
        const res = await api('/api/wiki', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          if (newFiles.length > 0) {
            try {
              await uploadFilesWithProgress(
                "/api/attachments",
                newFiles,
                { wiki_page_id: json.data.id.toString() },
                setUploadProgress
              );
            } catch (err) {
              console.error("Wiki attachment upload failed:", err);
            }
          }
          const path = project ? `/projects/${project.identifier}/wiki?id=${json.data.id}` : `/wiki?id=${json.data.id}`;
          navigate(path);
          window.location.reload();
        } else {
          setError(json.error || t('wikiCreateFail'));
        }
      } else if (mode === 'edit' && activePage) {
        const payload: UpdateWikiPageRequest = {
          title,
          content,
          parent_id: parentId,
        };
        const res = await api(`/api/wiki/${activePage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          if (newFiles.length > 0) {
            try {
              await uploadFilesWithProgress(
                "/api/attachments",
                newFiles,
                { wiki_page_id: activePage.id.toString() },
                setUploadProgress
              );
            } catch (err) {
              console.error("Wiki attachment upload failed:", err);
            }
          }
          setMode('view');
          window.location.reload();
        } else {
          setError(t('wikiUpdateFail'));
        }
      }
    } catch {
      setError(t('serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWiki = async (id: string, slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slug === 'home') {
      alert(t('cannotDeleteHomeWiki'));
      return;
    }

    if (!window.confirm(t('confirmDeleteWiki'))) {
      return;
    }

    try {
      const res = await api(`/api/wiki/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Redirection
        const path = project ? `/projects/${project.identifier}/wiki` : `/wiki`;
        navigate(path);
        window.location.reload();
      } else {
        alert(json.error || t('wikiDeleteFail'));
      }
    } catch (err) {
      console.error('Failed to delete wiki:', err);
      alert(t('deleteCommunicationError'));
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!window.confirm(t('confirmDeleteAttachment'))) return;
    
    try {
      const res = await api(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAttachments(attachments.filter(a => a.id !== attachmentId));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // ── Version history handlers ──
  const handleShowHistory = async () => {
    if (!activePage) return;
    setSelectedVersion(null);
    if (versions.length === 0) {
      setVersionsLoading(true);
      try {
        const res = await api(`/api/wiki/${activePage.id}/versions`);
        const json = await res.json();
        if (json.success) {
          setVersions(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch versions:', err);
      } finally {
        setVersionsLoading(false);
      }
    }
    setActiveTab('history');
  };

  const handlePreviewVersion = (version: WikiVersion) => {
    setSelectedVersion(version);
  };

  const handleBackToVersionList = () => {
    setSelectedVersion(null);
  };

  const handleRestoreVersion = async (version: WikiVersion) => {
    if (!window.confirm(t('confirmRestoreWikiVersion'))) return;
    try {
      const res = await api(`/api/wiki/${activePage!.id}/versions/${version.id}/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const json = await res.json();
        alert(json.error || t('wikiRestoreFail'));
      }
    } catch (err) {
      console.error('Restore failed:', err);
      alert(t('deleteCommunicationError'));
    }
  };

  return (
    <div className="flex w-full relative">
      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {mode === 'view' && activePage ? (
            <div className="grid grid-cols-1 gap-6 p-6">
              
              {/* Document Panel */}
              <div className="flex flex-col min-w-0">
                {/* Breadcrumbs */}
                {activePage && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    {getBreadcrumbs(activePage.parent_id || null, wikiList).map((p, i) => (
                      <React.Fragment key={p.id}>
                        <Link to={`/wiki?id=${p.id}`} className="hover:text-indigo-600">{p.title}</Link>
                        {i < getBreadcrumbs(activePage.parent_id || null, wikiList).length - 1 && <span>/</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {/* Meta details Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 mb-5">
                  <div className="flex flex-col gap-1.5">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white m-0 tracking-tight">{activePage.title}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={13} className="text-slate-400 dark:text-slate-500" />
                        <span>{t('author')}: <strong className="text-slate-700 dark:text-slate-200 font-medium">{activePage.author_name}</strong></span>
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 hidden sm:inline"></span>
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400 dark:text-slate-500" />
                        <span>{t('lastModified')}: {formatDateTime(activePage.updated_at)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {toc.length > 0 && (
                      <Button
                        onClick={() => setShowToc(!showToc)}
                        variant="secondary"
                        size="sm"
                        icon={BookOpen}
                        className={`rounded-xl font-semibold border-slate-200 dark:border-slate-700 shadow-xs transition-all active:scale-[0.98] ${
                          showToc
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800'
                        }`}
                      >
                        {t('tocHeader')}
                      </Button>
                    )}
                    {!isArchived && (
                      <Button 
                        onClick={handleEditClick} 
                        variant="secondary" 
                        size="sm"
                        icon={Edit2}
                        className="rounded-xl font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-[0.98]"
                      >
                        {t('edit')}
                      </Button>
                    )}
                    {activePage.slug !== 'home' && !isArchived && (
                      <Button 
                        onClick={(e) => handleDeleteWiki(activePage.id, activePage.slug, e)} 
                        variant="secondary" 
                        size="sm"
                        icon={Trash2}
                        className="rounded-xl font-semibold border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-xs hover:border-red-200 dark:hover:border-red-800 transition-all active:scale-[0.98]"
                      >
                        {t('delete')}
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Content View */}
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none md-preview"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(injectHeadingIds(content || '')) }}
                  />
                
                {/* Attachments Section - Card view */}
                <AttachmentList 
                  attachments={attachments} 
                  className="mt-8" 
                  onDownloadAll={() => window.open(`/api/attachments/batch-download?wiki_page_id=${activePage?.id}`, "_blank")} 
                />

                {/* Tabs: Comments / History */}
                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
                  {/* Tab bar */}
                  <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700 mb-6">
                    <button
                      onClick={() => setActiveTab('comments')}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer bg-transparent ${
                        activeTab === 'comments'
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        {t('wikiComments')}
                      </span>
                    </button>
                    <button
                      onClick={handleShowHistory}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer bg-transparent ${
                        activeTab === 'history'
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {t('wikiVersionHistory')}
                      </span>
                    </button>
                  </div>

                  {/* Comments tab */}
                  {activeTab === 'comments' && activePage && (
                    <WikiComments wikiPageId={activePage.id} />
                  )}

                  {/* History tab — always shows list; preview in overlay */}
                  {activeTab === 'history' && (
                    <div>
                      {versionsLoading ? (
                        <div className="flex items-center justify-center h-48">
                          <div className="spinner text-primary" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
                        </div>
                      ) : versions.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                          {t('noWikiVersions')}
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                          {versions.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between py-3.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition-colors cursor-pointer"
                              onClick={() => handlePreviewVersion(v)}
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-slate-500 dark:text-slate-400 shrink-0">
                                  v{v.version}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{v.title}</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                    {v.author_name} · {formatDateTime(v.created_at)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                onClick={(e) => { e.stopPropagation(); handleRestoreVersion(v); }}
                                variant="secondary"
                                size="sm"
                                icon={RotateCcw}
                                className="rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs shrink-0 ml-2"
                              >
                                {t('restore')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            // Edit / Create Forms
            <form onSubmit={handleSave} className="flex flex-col">
              <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 dark:bg-slate-800/40">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white m-0">
                  {mode === 'create' ? t('newWikiPageTitle') : t('editWikiPageTitle')}
                </h2>
                {activePage && (
                  <button 
                    type="button" 
                    onClick={() => setMode('view')} 
                    className="p-1.5 hover:bg-slate-200/60 dark:bg-slate-700/60 rounded-full border-none bg-transparent cursor-pointer text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <X size={20}/>
                  </button>
                )}
              </div>

              {error && (
                <div className="mx-6 mt-6 bg-red-50 dark:bg-red-900/30 text-red-600 text-sm font-medium p-3.5 rounded-xl border border-red-100 dark:border-red-900/50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {error}
                </div>
              )}

              <div className="p-6 flex flex-col gap-6">
                <Input
                  type="text"
                  placeholder={t('wikiTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={(mode === 'edit' && activePage?.slug === 'home') || isLoading}
                  required
                  fullWidth
                  label={t('title')}
                  className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />

                {project && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('parentPage') || 'Parent Page'}</label>
                  {mode === 'create' && searchParams.get('parent_id') ? (
                    <div className="form-control text-sm w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-70">
                      {wikiList.find(p => p.id === parentId)?.title || ''}
                    </div>
                  ) : (
                    <select
                      className="form-control text-sm w-full"
                      value={parentId || ''}
                      onChange={(e) => setParentId(e.target.value || null)}
                      disabled={isLoading}
                    >
                      <option value="">{t('noParent') || 'No Parent'}</option>
                      {wikiList.filter(p => p.id !== activePage?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  )}
                </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('content')}</label>
                  <HTMLEditor
                    value={content}
                    onChange={setContent}
                    height={500}
                    labels={createHTMLEditorLabels(t, language)}
                  />
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pl-1">
                    <HelpCircle size={12} />
                    <span>{t('imageUploadWarning')}</span>
                  </p>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-slate-800/70 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <Paperclip size={16} className="text-indigo-600 dark:text-indigo-400" />
                      <span>{t('attachFile')}</span>
                    </div>
                    <FileUploader files={newFiles} onChange={setNewFiles} />
                    {mode === 'edit' && attachments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-xs font-semibold text-slate-500 mb-2">{t('existingAttachments')}</div>
                        <div className="flex flex-wrap gap-2">
                          {attachments.map(file => (
                            <div key={file.id} className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs shadow-2xs">
                              <span className="truncate max-w-[150px] font-medium text-slate-700 dark:text-slate-200">{file.filename}</span>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteAttachment(file.id)}
                                className="text-slate-400 dark:text-slate-500 hover:text-red-600 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
              </div>

                            {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="px-6 py-2">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
              <div className="px-6 py-4 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 dark:bg-slate-800/40">
                {activePage && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => setMode('view')}
                    disabled={isLoading}
                    className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-800 font-semibold shadow-xs"
                  >
                    {t('cancel')}
                  </Button>
                )}
                <Button 
                  type="submit" 
                  isLoading={isLoading} 
                  icon={Save}
                  disabled={isLoading || !title.trim()}
                  className="rounded-xl font-bold bg-linear-to-r from-indigo-600 to-violet-600 text-white border-0 hover:from-indigo-700 hover:to-violet-700 shadow-sm active:scale-[0.98] transition-all"
                >
                  {t('saveBtn')}
                </Button>
              </div>
            </form>
          )}
      </div>

      {/* TOC Sidebar */}
      {mode === 'view' && (
        <div className={`shrink-0 border-l border-[var(--border)] flex flex-col absolute right-0 top-0 bottom-0 z-10 lg:sticky lg:top-0 lg:h-[calc(100vh-var(--header-height))] shadow-xl lg:shadow-none transition-all duration-300 bg-white dark:bg-transparent ${showToc ? 'w-64 translate-x-0' : 'w-0 translate-x-full lg:translate-x-0'}`}>
          <div className={`flex flex-col h-full w-full transition-opacity duration-300 ${showToc ? 'opacity-100' : 'opacity-0 overflow-hidden pointer-events-none'}`}>
            <button onClick={() => setShowToc(false)} className="lg:hidden absolute top-2 right-2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-[var(--text-muted)] transition-colors z-20">
              <X size={16} />
            </button>
            <div className="px-4 pt-5 pb-4 mb-2 flex items-center gap-1.5 text-[var(--text-primary)] shrink-0 border-b border-[var(--border)] bg-white dark:bg-slate-950">
              <BookOpen size={14} className="text-[var(--primary)]" />
              <span className="text-sm font-bold">{t('tocHeader')}</span>
            </div>
            <nav className="overflow-y-auto px-4 pb-4 flex flex-col gap-1 custom-scrollbar">
              {toc.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] py-2 px-1">
                  {t('noToc')}
                </div>
              ) : (
                toc.map((item, idx) => {
                  const isHeadingActive = activeHeading === item.text;
                  return (
                    <button
                      key={idx}
                      onClick={() => scrollToHeading(item.text)}
                      className={`text-left text-xs border-none bg-transparent cursor-pointer transition-all py-1.5 hover:text-[var(--primary)] truncate ${
                        item.level === 1 ? 'font-semibold pl-0' : item.level === 2 ? 'pl-3 text-[var(--text-secondary)]' : 'pl-6 text-[var(--text-muted)]'
                      } ${
                        isHeadingActive
                          ? 'text-[var(--primary)] font-bold border-l-2 border-[var(--primary)] pl-2 -ml-1 bg-[var(--primary-bg)] rounded-r-md py-1'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.text}
                    </button>
                  );
                })
              )}
            </nav>
          </div>
          
          {/* Toggle Button on the left edge */}
          {toc.length > 0 && (
            <button 
              onClick={() => setShowToc(!showToc)}
              className="absolute -left-[12px] top-[20px] w-[24px] h-[24px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-full flex items-center justify-center shadow-sm text-[var(--text-muted)] hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] z-20 hidden lg:flex cursor-pointer transition-all"
              aria-label={showToc ? t('collapseToc') : t('expandToc')}
            >
              <ChevronRight size={14} className={showToc ? '' : 'rotate-180 transition-transform'} />
            </button>
          )}
        </div>
      )}

      {/* ── Version preview overlay ── */}
      {selectedVersion && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pt-12"
          onClick={handleBackToVersionList}
        >
          {/* Backdrop removed as requested */}

          {/* Panel */}
          <div
            className="relative w-[90vw] max-w-6xl bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('wikiVersionComparison')}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => handleRestoreVersion(selectedVersion)}
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  className="rounded-xl font-semibold border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 shadow-xs whitespace-nowrap"
                >
                  {t('restoreThisVersion')}
                </Button>
                <button
                  onClick={handleBackToVersionList}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Comparison Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Historical Version */}
              <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  v{selectedVersion.version} - {formatDateTime(selectedVersion.created_at)}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedVersion.content || '') }}
                  />
                </div>
              </div>

              {/* Current Version */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  {t('currentVersion')}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(activePage?.content || '') }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

