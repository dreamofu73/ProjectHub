import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Button } from 'ui/shadcn/button';
import { Input } from 'ui/shadcn/input';
import { Label } from 'ui/shadcn/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'ui/shadcn/card';
import { useLanguage } from '../context/LanguageContext';
import { ProjectHubLogo } from 'ui/ProjectHubLogo';
import AuthControls from '@/components/AuthControls';
import { api } from 'shared/lib/api';

const CSS = `
.login-bg {
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
  transition: background 0.3s ease;
}
.login-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.15;
  pointer-events: none;
}
.login-card-wrap {
  position: relative; z-index: 1;
  width: 100%; max-width: 400px;
  animation: login-card-in 0.65s cubic-bezier(0.16,1,0.3,1) both;
}
.login-icon-ring {
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.3s ease;
}
.login-input-wrap { position: relative; }
.login-input-icon {
  position: absolute; left: 12px; top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.login-input-wrap input { padding-left: 36px; }
.login-input-wrap .right-btn {
  position: absolute; right: 8px; top: 50%;
  transform: translateY(-50%);
}
.login-field { animation: login-item-in 0.4s both; }
.login-field:nth-child(1) { animation-delay: 0.15s; }
.login-field:nth-child(2) { animation-delay: 0.23s; }

@keyframes login-card-in {
  from { opacity: 0; transform: translateY(28px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes login-item-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  const registered = searchParams.get('registered') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKey('');
    setIsLoading(true);
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: identifier, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        else localStorage.setItem('user', JSON.stringify({ id: '1', login: 'admin', role: 'admin' }));
        navigate('/dashboard');
      } else {
        setErrorKey('loginErrorInvalid');
      }
    } catch {
      setErrorKey('loginErrorConnection');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="login-bg">
        <div className="login-grid" />

        {/* Language & Theme selector in the top-right corner */}
        <AuthControls />

        <div className="login-card-wrap">
          <Card className="shadow-2xl border border-border bg-card/95 backdrop-blur-md">
            <CardHeader className="text-center pb-3 pt-7">
              <div className="flex justify-center mb-3">
                <div className="login-icon-ring">
                  <ProjectHubLogo size={42} className="text-[var(--primary)]" />
                </div>
              </div>
              <CardTitle className="text-xl font-extrabold tracking-tight">
                <h1 className="inline-block text-xl font-extrabold tracking-tight text-[var(--primary)]">ProjectHub</h1> {t('loginTitle')}
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                {t('loginDesc')}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-8 pb-4">
              {registered && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-4 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                  {t('registerSuccessMsg')}
                </div>
              )}
              {errorKey && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900">
                  <AlertCircle size={15} className="shrink-0" />
                  {t(errorKey)}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* ID / Email */}
                <div className="login-field space-y-1.5">
                  <Label htmlFor="identifier">{t('idOrEmail')}</Label>
                  <div className="login-input-wrap">
                    <User size={14} className="login-input-icon" />
                    <Input
                      id="identifier"
                      type="text"
                      placeholder={t('idOrEmailPlaceholder')}
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      required
                      disabled={isLoading}
                      autoFocus
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="login-field space-y-1.5">
                  <Label htmlFor="password">{t('password')}</Label>
                  <div className="login-input-wrap">
                    <Lock size={14} className="login-input-icon" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-8 pr-8"
                    />
                    <button
                      type="button"
                      className="right-btn p-1.5 rounded border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className="login-field pt-1">
                  <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-lg transition-all" disabled={isLoading || !identifier || !password}>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('processing')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn size={16} />
                        {t('loginBtn')}
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>

            <CardFooter className="justify-center pb-7 pt-1">
              <p className="text-sm text-muted-foreground">
                {t('noAccount')}{' '}
                <Link to="/register" className="text-primary font-semibold hover:underline transition-colors">
                  {t('register')}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
