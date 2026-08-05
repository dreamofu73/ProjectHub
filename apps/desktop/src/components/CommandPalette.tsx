import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, FolderKanban, Bug, BookOpen, 
  MessageSquare, LayoutDashboard, Moon, Sun, 
  Sparkles, CornerDownLeft, type LucideIcon
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';
import type { Project, Issue, WikiPage } from 'shared/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  toggleTheme: () => void;
}

interface PaletteItem {
  type: 'command' | 'project' | 'issue' | 'wiki';
  category: string;
  name: string;
  icon: LucideIcon;
  handler: () => void;
  globalIndex?: number;
}

export default function CommandPalette({ isOpen, onClose, isDark, toggleTheme }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [results, setResults] = useState<{
    issues: Issue[];
    projects: Project[];
    wiki: (WikiPage & { project_identifier?: string })[];
  }>({ issues: [], projects: [], wiki: [] });
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle global search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ issues: [], projects: [], wiki: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success) {
          setResults(json.data);
        }
      } catch (err) {
        console.error('Command Palette Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Navigation shortcuts
  const navigationCommands = [
    { name: t('cpCmdDashboard'), action: () => navigate('/dashboard'), icon: LayoutDashboard, category: t('cpCategoryGo') },
    { name: t('cpCmdProjects'), action: () => navigate('/projects'), icon: FolderKanban, category: t('cpCategoryGo') },
    { name: t('cpCmdIssues'), action: () => navigate('/issues'), icon: Bug, category: t('cpCategoryGo') },
    { name: t('cpCmdChat'), action: () => navigate('/chat'), icon: MessageSquare, category: t('cpCategoryGo') },
    { name: t('cpCmdWiki'), action: () => navigate('/wiki'), icon: BookOpen, category: t('cpCategoryGo') },
  ];

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSysAdmin = currentUser?.role === 'admin';

  // Actions
  const actionCommands = [
    { 
      name: isDark ? t('cpCmdLightMode') : t('cpCmdDarkMode'), 
      action: () => { toggleTheme(); onClose(); }, 
      icon: isDark ? Sun : Moon, 
      category: t('cpCategorySettings') 
    },
    ...(isSysAdmin ? [{ 
      name: t('cpCmdNewProject'), 
      action: () => navigate('/projects/new'), 
      icon: FolderKanban, 
      category: t('cpCategoryAction') 
    }] : [])
  ];

  // Filter commands by query
  const filteredCommands = [...navigationCommands, ...actionCommands].filter(cmd => 
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  // Combine commands and search results
  const items: PaletteItem[] = [];
  
  // Add filtered local commands
  filteredCommands.forEach(cmd => {
    items.push({
      type: 'command',
      category: cmd.category,
      name: cmd.name,
      icon: cmd.icon,
      handler: cmd.action
    });
  });

  // Add search results
  results.projects.forEach(p => {
    items.push({
      type: 'project',
      category: t('cpCategoryProject'),
      name: p.name,
      icon: FolderKanban,
      handler: () => { navigate(`/projects/${p.identifier}`); onClose(); }
    });
  });

  results.issues.forEach(i => {
    items.push({
      type: 'issue',
      category: t('cpCategoryIssue'),
      name: `#${i.id}: ${i.subject}`,
      icon: Bug,
      handler: () => { navigate(`/projects/${i.project_identifier}/issues/${i.id}`); onClose(); }
    });
  });

  results.wiki.forEach(w => {
    items.push({
      type: 'wiki',
      category: t('cpCategoryWiki'),
      name: w.title,
      icon: BookOpen,
      handler: () => { navigate(`/projects/${w.project_identifier}/wiki?id=${w.id}`); onClose(); }
    });
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].handler();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  if (!isOpen) return null;

  // Group items by category
  const categories: { [key: string]: (PaletteItem & { globalIndex: number })[] } = {};
  items.forEach((item, index) => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push({ ...item, globalIndex: index });
  });

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Palette Body */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-zoom-in flex flex-col max-h-[60vh]">
        
        {/* Search Input Container */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="text-slate-400 dark:text-slate-500 shrink-0" size={20} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder={t('cpPlaceholder')}
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          {isLoading && (
            <div className="spinner text-primary" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
          )}
          <kbd className="hidden sm:inline-flex items-center h-5 select-none rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-1.5 font-mono text-xs font-medium text-slate-400 dark:text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {items.length > 0 ? (
            Object.keys(categories).map(catName => (
              <div key={catName} className="mb-3 last:mb-0">
                <div className="px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {catName}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {categories[catName].map((item) => {
                    const isSelected = selectedIndex === item.globalIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={`${item.type}-${item.name}-${item.globalIndex}`}
                        onClick={() => item.handler()}
                        onMouseEnter={() => setSelectedIndex(item.globalIndex)}
                        className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl border-none cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${
                            isSelected 
                              ? 'bg-white dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            <Icon size={16} />
                          </div>
                          <span className="truncate text-sm">{item.name}</span>
                        </div>
                        
                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-500 dark:text-indigo-400">
                            {t('cpSelect')} <CornerDownLeft size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Sparkles className="mx-auto mb-2 opacity-30 text-indigo-500" size={32} />
              <p className="text-sm">{t('cpNoResults')}</p>
              <p className="text-xs mt-1 opacity-70">{t('cpTryAgain')}</p>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm font-mono font-bold">↑↓</kbd> {t('cpCategoryGo')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm font-mono font-bold">Enter</kbd> {t('save')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm font-mono font-bold">Esc</kbd> {t('cancel')}
            </span>
          </div>
          <span className="font-semibold text-indigo-500/80 dark:text-indigo-400/80 flex items-center gap-1">
            ProjectHub Command Palette
          </span>
        </div>
      </div>
    </div>
  );
}
