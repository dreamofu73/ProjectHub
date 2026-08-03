import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { logsApi } from 'shared/lib/api';
import { Button } from 'ui/Button';
import {
  FileText,
  Search,
  Eye,
  EyeOff,
  Trash2,
  Save,
  ChevronRight,
  HardDrive,
  Calendar,
  Filter,
  Activity,
  Settings,
} from 'lucide-react';
import type { LogFileInfo, LogSearchResult, LogConfig } from 'shared/types';

type Tab = 'realtime' | 'search' | 'settings';

export default function LogsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('realtime');

  // ── Shared state ──
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState('pms.log');

  // ── Realtime tab state ──
  const [logContent, setLogContent] = useState<string[]>([]);
  const [tailOffset, setTailOffset] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loadingTail, setLoadingTail] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── Search tab state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFileFilter, setSearchFileFilter] = useState('');
  const [searchResults, setSearchResults] = useState<LogSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // ── Settings tab state ──
  const [config, setConfig] = useState<LogConfig>({
    max_size_mb: 10,
    max_files: 5,
    retention_days: 30,
  });
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [currentLogLevel, setCurrentLogLevel] = useState('INFO');
  const [loadingLevel, setLoadingLevel] = useState(false);

  // ── Fetch log files ──
  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await logsApi.listFiles();
      if (res.success) {
        setFiles(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ── Tail / viewer ──
  const loadTail = useCallback(async () => {
    if (selectedFile !== 'pms.log') return;
    try {
      const res = await logsApi.tail(tailOffset);
      if (res.success && res.data) {
        if (res.data.content) {
          const lines = res.data.content.split('\n').filter(Boolean);
          setLogContent(prev => [...prev, ...lines]);
        }
        setTailOffset(res.data.new_offset);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTail(false);
    }
  }, [selectedFile, tailOffset]);

  // Load initial content when file changes
  useEffect(() => {
    setLogContent([]);
    setLoadingTail(true);

    if (selectedFile === 'pms.log') {
      // Get current file size and set offset there, so only new logs appear
      logsApi.tail(0).then(res => {
        if (res.success && res.data) {
          setTailOffset(res.data.file_size);
        } else {
          setTailOffset(0);
        }
        setLoadingTail(false);
      });
    } else {
      // Load entire file (or last 500 lines)
      setTailOffset(0);
      logsApi.getFile(selectedFile, 500).then(res => {
        if (res.success && res.data) {
          setLogContent(res.data.content.split('\n').filter(Boolean));
        }
        setLoadingTail(false);
      });
    }
  }, [selectedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling for pms.log
  useEffect(() => {
    if (selectedFile !== 'pms.log' || !isPolling) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = undefined;
      }
      return;
    }

    pollTimerRef.current = setInterval(() => {
      loadTail();
    }, 2000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = undefined;
      }
    };
  }, [selectedFile, isPolling, loadTail]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logContent, autoScroll]);

  // ── Fetch config ──
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await logsApi.getConfig();
      if (res.success && res.data) {
        setConfig(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const fetchLevel = useCallback(async () => {
    setLoadingLevel(true);
    try {
      const res = await logsApi.getLevel();
      if (res.success && res.data) {
        setCurrentLogLevel(res.data.level);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLevel(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchConfig();
      fetchLevel();
    }
  }, [activeTab, fetchConfig, fetchLevel]);

  // ── Search ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await logsApi.search(
        searchQuery.trim(),
        searchFileFilter || undefined
      );
      if (res.success) {
        setSearchResults(res.data || []);
      }
    } catch {
      showToast(t('serverCommunicationError'), 'error');
    } finally {
      setSearching(false);
    }
  };

  // ── Save config ──
  const handleSetLevel = async (level: string) => {
    try {
      const res = await logsApi.setLevel(level);
      if (res.success && res.data) {
        setCurrentLogLevel(res.data.level);
        showToast(t('logsLevelChanged') || `Log level changed to ${level}`, 'success');
      }
    } catch {
      showToast(t('serverCommunicationError'), 'error');
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await logsApi.updateConfig(config);
      if (res.success) {
        showToast(t('logsConfigSaved') || 'Log settings saved.', 'success');
      } else {
        showToast(t('serverCommunicationError'), 'error');
      }
    } catch {
      showToast(t('serverCommunicationError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Clear viewer ──
  const handleClear = () => {
    setLogContent([]);
    setLoadingTail(true);
    if (selectedFile === 'pms.log') {
      // Jump to current file size so only new logs appear
      logsApi.tail(0).then(res => {
        if (res.success && res.data) {
          setTailOffset(res.data.file_size);
        } else {
          setTailOffset(0);
        }
        setLoadingTail(false);
      });
    } else {
      setTailOffset(0);
      logsApi.getFile(selectedFile, 500).then(res => {
        if (res.success && res.data) {
          setLogContent(res.data.content.split('\n').filter(Boolean));
        }
        setLoadingTail(false);
      });
    }
  };

  // ── Jump to file from search result ──
  const handleSearchResultClick = (result: LogSearchResult) => {
    setSelectedFile(result.file);
    setActiveTab('realtime');
  };

  // ── Tabs ──
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'realtime', label: t('logsRealtime') || 'Real-time Logs', icon: Activity },
    { key: 'search', label: t('logsSearch') || 'Search Logs', icon: Search },
    { key: 'settings', label: t('logsSettings') || 'Log Settings', icon: Settings },
  ];

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t('logs') || 'Log Management'}</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-6 pt-4 pb-0 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/10">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-xl transition-all border -mb-px ${
                isActive
                  ? 'text-[var(--primary)] bg-[var(--bg-surface)] border-[var(--border)] border-b-[var(--bg-surface)] shadow-[0_-4px_12px_rgba(0,0,0,0.03)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--primary)]' : 'opacity-60'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* ── Realtime Tab ── */}
        {activeTab === 'realtime' && (
          <div className="flex flex-col h-full">
            {/* File selector + controls */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/20">
              {/* File chips */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
                <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mr-1 shrink-0">
                  {t('logsSelectFile') || 'File'}:
                </span>
                {loadingFiles ? (
                  <span className="text-xs text-[var(--text-muted)]">{t('logsLoading')}</span>
                ) : files.length === 0 ? (
                  <span className="text-xs text-[var(--text-muted)]">{t('logsNoFiles')}</span>
                ) : (
                  files.map(f => (
                    <button
                      key={f.name}
                      onClick={() => setSelectedFile(f.name)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                        selectedFile === f.name
                          ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30'
                          : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedFile === 'pms.log' && (
                  <button
                    onClick={() => setIsPolling(!isPolling)}
                    className={`p-1.5 rounded-md transition-colors ${
                      isPolling
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                    title={isPolling ? t('logsPause') : t('logsResume')}
                  >
                    {isPolling ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`p-1.5 rounded-md transition-colors ${
                    autoScroll
                      ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title={t('logsAutoScroll')}
                >
                  <ChevronRight className={`w-4 h-4 ${autoScroll ? 'rotate-90' : ''}`} />
                </button>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title={t('logsClear')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Log viewer */}
            <div
              ref={viewerRef}
              className="flex-1 overflow-y-auto min-h-0 p-4 bg-[var(--bg-app)] font-mono text-xs leading-relaxed custom-scrollbar"
            >
              {loadingTail && logContent.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
                </div>
              ) : logContent.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                  {t('logsNoResults')}
                </div>
              ) : (
                logContent.map((line, i) => (
                  <div key={i} className="hover:bg-[var(--bg-surface-2)]/30 px-2 py-0.5 rounded whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>

            {/* Connection status */}
            {selectedFile === 'pms.log' && (
              <div className="flex items-center gap-2 px-6 py-1.5 border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/20">
                <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="text-xs text-[var(--text-muted)]">
                  {isPolling ? t('logsConnected') : t('logsDisconnected')}
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {logContent.length} lines
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Search Tab ── */}
        {activeTab === 'search' && (
          <div className="flex flex-col h-full">
            {/* Search controls */}
            <div className="px-6 py-4 border-b border-[var(--border)] shrink-0 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={t('logsSearchPlaceholder') || 'Enter search term'}
                    className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <select
                    value={searchFileFilter}
                    onChange={(e) => setSearchFileFilter(e.target.value)}
                    className="h-9 pl-8 pr-8 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] appearance-none cursor-pointer"
                  >
                    <option value="">{t('all') || 'All files'}</option>
                    {files.map(f => (
                      <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="gap-1.5 h-9"
                >
                  {searching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {t('search')}
                </Button>
              </div>
            </div>

            {/* Search results */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              {!searched ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                  <Search className="w-8 h-8 mr-2 opacity-40" />
                  {t('logsSearchPlaceholder')}
                </div>
              ) : searching ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                  {t('logsNoResults')}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    {(t('logsSearchResults') || 'Results ({count})').replace('{count}', searchResults.length.toString())}
                  </p>
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearchResultClick(r)}
                      className="w-full text-left flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-2)]/40 transition-colors cursor-pointer border border-transparent hover:border-[var(--border)]"
                    >
                      <span className="shrink-0 text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded">
                        {r.file}:{r.line}
                      </span>
                      <span className="text-xs text-[var(--text-primary)] break-all min-w-0">
                        {r.content}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-6">
            {loadingConfig ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="max-w-lg space-y-6">
                {/* Log Level section — runtime control */}
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
                    <Filter className="w-4 h-4 text-[var(--primary)]" />
                    {t('logsConfigLogLevel') || 'Log Level'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mb-4">
                    {t('logsConfigLogLevelDesc') || 'Change the log level at runtime. Resets to default on restart.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentLogLevel}
                      onChange={(e) => handleSetLevel(e.target.value)}
                      disabled={loadingLevel}
                      className="h-10 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] appearance-none cursor-pointer"
                    >
                      <option value="ERROR">ERROR</option>
                      <option value="WARN">WARN</option>
                      <option value="INFO">INFO</option>
                      <option value="DEBUG">DEBUG</option>
                      <option value="TRACE">TRACE</option>
                    </select>
                    {loadingLevel && (
                      <div className="w-4 h-4 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
                    )}
                  </div>
                </div>

                <hr className="border-[var(--border)]" />

                {/* Rotation settings section */}
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
                    <HardDrive className="w-4 h-4 text-[var(--primary)]" />
                    {t('logsConfigRotation') || 'Rotation Settings'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mb-5">
                    {t('logsConfigMaxSizeDesc') || 'Files rotate when reaching the configured size.'}
                  </p>

                  <div className="space-y-5">
                    {/* Max size */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        {t('logsConfigMaxSize') || 'Max File Size'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={config.max_size_mb}
                          onChange={(e) => setConfig(prev => ({ ...prev, max_size_mb: Number(e.target.value) || 10 }))}
                          className="w-28 h-10 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                        />
                        <span className="text-sm text-[var(--text-muted)]">
                          {t('logsConfigMB') || 'MB'}
                        </span>
                      </div>
                    </div>

                    {/* Max files */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        {t('logsConfigMaxFiles') || 'Max Archive Files'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={config.max_files}
                          onChange={(e) => setConfig(prev => ({ ...prev, max_files: Number(e.target.value) || 5 }))}
                          className="w-28 h-10 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                        />
                        <span className="text-sm text-[var(--text-muted)]">
                          {t('logsConfigFiles') || 'files'}
                        </span>
                      </div>
                    </div>

                    {/* Retention days */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                        <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                        {t('logsConfigRetention') || 'Retention Period'}
                      </label>
                      <p className="text-xs text-[var(--text-muted)] mb-3">
                        {t('logsConfigRetentionDesc') || 'Old log files are auto-deleted after this period.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={config.retention_days}
                          onChange={(e) => setConfig(prev => ({ ...prev, retention_days: Number(e.target.value) || 30 }))}
                          className="w-28 h-10 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
                        />
                        <span className="text-sm text-[var(--text-muted)]">
                          {t('logsConfigDays') || 'days'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t border-[var(--border)]">
                  <Button
                    variant="primary"
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="gap-2 h-10 px-5 text-sm font-bold"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('logsConfigSave') || 'Save Settings'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
