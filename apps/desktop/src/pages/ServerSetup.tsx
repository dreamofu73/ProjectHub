/**
 * ServerSetup – Desktop 앱 최초 실행 시 백엔드 서버 주소를 입력받는 페이지.
 *
 * Tauri 컨텍스트에서만 사용됩니다. 브라우저에서는 이 페이지가 렌더링되지 않습니다.
 */

import { useState, useEffect } from 'react';
import { Layers3, Check, AlertCircle, Server, Loader2 } from 'lucide-react';
import { Button } from 'ui/shadcn/button';
import { Input } from 'ui/shadcn/input';
import { Label } from 'ui/shadcn/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'ui/shadcn/card';
import { getBackendUrl, setBackendUrl, isTauri } from 'shared/lib/desktop-config';

import { useLanguage } from 'shared/hooks/LanguageContext';
const CSS = `
.setup-bg {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 24px;
  background: radial-gradient(circle at 10% 20%, var(--primary-bg) 0%, transparent 40%),
              radial-gradient(circle at 90% 80%, var(--primary-bg) 0%, transparent 40%),
              var(--bg-app);
}
.setup-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.15;
  pointer-events: none;
}
.setup-card-wrap {
  position: relative; z-index: 1;
  width: 100%; max-width: 440px;
  animation: setup-card-in 0.65s cubic-bezier(0.16,1,0.3,1) both;
}
.setup-icon-ring {
  display: inline-flex; align-items: center; justify-content: center;
  width: 50px; height: 50px; border-radius: 13px;
  background: var(--primary);
  box-shadow: 0 8px 24px var(--primary-bg);
}
.setup-field { animation: setup-item-in 0.4s both; }
.setup-field:nth-child(1) { animation-delay: 0.15s; }

@keyframes setup-card-in {
  from { opacity: 0; transform: translateY(28px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes setup-item-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Connection status indicator */
.connection-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.connection-dot.ok    { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.5); }
.connection-dot.fail  { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }
.connection-dot.idle  { background: var(--border-strong); }
`;

export default function ServerSetup() {
  const { t } = useLanguage();
  const [url, setUrl] = useState('http://localhost:8000');
  const [error, setError] = useState('');
  const [checkStatus, setCheckStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [isSaving, setIsSaving] = useState(false);

  // On mount, check if already configured
  useEffect(() => {
    if (!isTauri()) return;
    getBackendUrl().then(stored => {
      if (stored) setUrl(stored);
    });
  }, []);

  const testConnection = async () => {
    const trimmed = url.replace(/\/+$/, '');
    setUrl(trimmed);
    setError('');
    setCheckStatus('testing');

    try {
      const res = await fetch(`${trimmed}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: '', password: '' }),
        signal: AbortSignal.timeout(5000),
      });
      // Any response (even 4xx) means the server is reachable
      if (res.status >= 200 && res.status < 600) {
        setCheckStatus('ok');
      } else {
        setCheckStatus('fail');
        setError(t('serverConnectionError'));
      }
    } catch {
      setCheckStatus('fail');
      setError(t('serverConnectionError'));
    }
  };

  const handleSave = async () => {
    const trimmed = url.replace(/\/+$/, '');
    setUrl(trimmed);
    if (!trimmed) {
      setError(t('enterServerAddress'));
      return;
    }

    // Test connection before saving
    setCheckStatus('testing');
    setError('');
    try {
      const res = await fetch(`${trimmed}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: '', password: '' }),
        signal: AbortSignal.timeout(5000),
      });
      if (!(res.status >= 200 && res.status < 600)) {
        setCheckStatus('fail');
        setError(t('serverConnectionError'));
        return;
      }
    } catch {
      setCheckStatus('fail');
      setError(t('serverConnectionError'));
      return;
    }

    setIsSaving(true);
    try {
      await setBackendUrl(trimmed);
      // Navigate to login (full reload so api.ts picks up the new URL)
      window.location.href = '/login';
    } catch {
      setError(t('settingsSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="setup-bg">
        <div className="setup-grid" />

        <div className="setup-card-wrap">
          <Card className="shadow-2xl border border-border bg-card/95 backdrop-blur-md">
            <CardHeader className="text-center pb-3 pt-7">
              <div className="flex justify-center mb-3">
                <div className="setup-icon-ring">
                  <Layers3 size={22} color="white" strokeWidth={2} />
                </div>
              </div>
              <CardTitle className="text-xl font-extrabold tracking-tight">
                {t('serverSetupTitle')}
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                {t('serverSetupDesc')}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-8 pb-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="setup-field space-y-1.5">
                <Label htmlFor="server-url">{t('serverAddress')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="server-url"
                    type="url"
                    placeholder="http://localhost:8000"
                    value={url}
                    onChange={e => {
                      setUrl(e.target.value);
                      setCheckStatus('idle');
                      setError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSave();
                    }}
                    required
                    disabled={isSaving}
                    autoFocus
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testConnection}
                    disabled={isSaving || !url}
                    className="shrink-0 gap-1.5"
                  >
                    {checkStatus === 'testing' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Server size={14} />
                    )}
                    {t('confirm')}
                  </Button>
                </div>

                {/* Connection status indicator */}
                {checkStatus !== 'idle' && (
                  <div className="flex items-center gap-2 text-xs mt-1.5">
                    <span className={`connection-dot ${checkStatus === 'testing' ? 'idle' : checkStatus}`} />
                    {checkStatus === 'testing' && <span className="text-muted-foreground">{t('checkingConnection')}</span>}
                    {checkStatus === 'ok' && <span className="text-emerald-600 dark:text-emerald-400">{t('serverConnectSuccess')}</span>}
                    {checkStatus === 'fail' && <span className="text-red-600 dark:text-red-400">{t('serverConnectFail')}</span>}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-2 pb-7 pt-1">
              <Button
                type="button"
                className="w-full h-11 text-sm font-semibold shadow-lg transition-all gap-2"
                onClick={handleSave}
                disabled={isSaving || !url}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {t('saveAndStart')}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center leading-relaxed mt-1">
                {t('serverAddressSavedHint')}
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
