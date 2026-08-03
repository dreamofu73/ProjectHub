import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layers3, UserPlus, User, Lock, Mail, IdCard, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from 'ui/shadcn/button';
import { Input } from 'ui/shadcn/input';
import { Label } from 'ui/shadcn/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'ui/shadcn/card';
import { Separator } from 'ui/shadcn/separator';
import { useLanguage } from '../context/LanguageContext';
import AuthControls from '@/components/AuthControls';

const CSS = `
.reg-bg {
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
.reg-orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.reg-orb-1 {
  width: 560px; height: 560px;
  background: radial-gradient(circle, var(--primary-bg) 0%, transparent 70%);
  top: -180px; right: -100px;
  animation: reg-drift 25s ease-in-out infinite;
  opacity: 0.8;
}
.reg-orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, var(--primary-bg) 0%, transparent 70%);
  bottom: -100px; left: -80px;
  animation: reg-drift 30s ease-in-out infinite reverse;
  animation-delay: -10s;
  opacity: 0.6;
}
.reg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.15;
  pointer-events: none;
}
.reg-card-wrap {
  position: relative; z-index: 1;
  width: 100%; max-width: 500px;
  animation: reg-card-in 0.65s cubic-bezier(0.16,1,0.3,1) both;
}
.reg-icon-ring {
  display: inline-flex; align-items: center; justify-content: center;
  width: 50px; height: 50px; border-radius: 13px;
  background: var(--primary);
  box-shadow: 0 8px 24px var(--primary-bg);
}
.reg-input-wrap { position: relative; }
.reg-input-icon {
  position: absolute; left: 10px; top: 50%;
  transform: translateY(-50%);
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}
.reg-input-wrap input { padding-left: 34px; }
.reg-input-wrap .right-btn {
  position: absolute; right: 8px; top: 50%;
  transform: translateY(-50%);
}
.reg-field { animation: reg-item-in 0.4s both; }
.reg-field:nth-child(1) { animation-delay: 0.15s; }
.reg-field:nth-child(2) { animation-delay: 0.23s; }
.reg-field:nth-child(3) { animation-delay: 0.31s; }
.reg-field:nth-child(4) { animation-delay: 0.39s; }
.reg-field:nth-child(5) { animation-delay: 0.47s; }

@keyframes reg-drift {
  0%, 100% { transform: translate(0,0) scale(1); }
  33%       { transform: translate(-35px,45px) scale(1.05); }
  66%       { transform: translate(20px,-25px) scale(0.95); }
}
@keyframes reg-card-in {
  from { opacity: 0; transform: translateY(28px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes reg-item-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    login: '', email: '', password: '', passwordConfirm: '', firstname: '', lastname: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showPwC, setShowPwC] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.passwordConfirm) { setError(t('pwMismatchError')); return; }
    if (form.password.length < 6) { setError(t('pwLengthError')); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: form.login, email: form.email, password: form.password, firstname: form.firstname, lastname: form.lastname }),
      });
      const data = await res.json();
      if (res.ok && data.success) navigate('/login?registered=true');
      else setError(data.error || t('registerFail'));
    } catch { setError(t('networkError')); }
    finally { setIsLoading(false); }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="reg-bg">
        <div className="reg-grid" />
        <div className="reg-orb reg-orb-1" />
        <div className="reg-orb reg-orb-2" />

        {/* Language & Theme selector in the top-right corner */}
        <AuthControls />

        <div className="reg-card-wrap">
          <Card className="shadow-2xl border border-border bg-card/95 backdrop-blur-md">
            <CardHeader className="text-center pb-3 pt-7">
              <div className="flex justify-center mb-3">
                <div className="reg-icon-ring">
                  <Layers3 size={22} color="white" strokeWidth={2} />
                </div>
              </div>
              <CardTitle className="text-xl font-extrabold tracking-tight">
                <h1 className="inline-block text-xl font-extrabold tracking-tight">ProjectHub</h1> {t('register')}
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                {t('registerDesc')}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-8 pb-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 이름 */}
                <div className="reg-field">
                  <div className="flex items-center gap-2 mb-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground font-medium px-2">{t('nameOptional')}</span>
                    <Separator className="flex-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="lastname">{t('lastName')}</Label>
                      <div className="reg-input-wrap">
                        <IdCard size={14} className="reg-input-icon" />
                        <Input id="lastname" type="text" placeholder="Hong" value={form.lastname} onChange={set('lastname')} disabled={isLoading} className="pl-8" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="firstname">{t('firstName')}</Label>
                      <Input id="firstname" type="text" placeholder="Gildong" value={form.firstname} onChange={set('firstname')} disabled={isLoading} />
                    </div>
                  </div>
                </div>

                {/* 아이디 */}
                <div className="reg-field space-y-1.5">
                  <Label htmlFor="login">{t('loginId')} <span className="text-red-500">*</span></Label>
                  <div className="reg-input-wrap">
                    <User size={14} className="reg-input-icon" />
                    <Input id="login" type="text" placeholder={t('loginIdPlaceholder')} value={form.login} onChange={set('login')} required disabled={isLoading} autoFocus className="pl-8" />
                  </div>
                </div>

                {/* 이메일 */}
                <div className="reg-field space-y-1.5">
                  <Label htmlFor="email">{t('email')} <span className="text-red-500">*</span></Label>
                  <div className="reg-input-wrap">
                    <Mail size={14} className="reg-input-icon" />
                    <Input id="email" type="email" placeholder="example@email.com" value={form.email} onChange={set('email')} required disabled={isLoading} className="pl-8" />
                  </div>
                </div>

                {/* 비밀번호 */}
                <div className="reg-field">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="password">{t('password')} <span className="text-red-500">*</span></Label>
                      <div className="reg-input-wrap">
                        <Lock size={14} className="reg-input-icon" />
                        <Input id="password" type={showPw ? 'text' : 'password'} placeholder={t('pwMinLengthHint')} value={form.password} onChange={set('password')} required disabled={isLoading} className="pl-8 pr-8" />
                        <button type="button" className="right-btn p-1.5 rounded border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                          {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="passwordConfirm">{t('passwordConfirm')} <span className="text-red-500">*</span></Label>
                      <div className="reg-input-wrap">
                        <Lock size={14} className="reg-input-icon" />
                        <Input id="passwordConfirm" type={showPwC ? 'text' : 'password'} placeholder={t('passwordConfirmPlaceholder')} value={form.passwordConfirm} onChange={set('passwordConfirm')} required disabled={isLoading} className="pl-8 pr-8" />
                        <button type="button" className="right-btn p-1.5 rounded border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowPwC(!showPwC)} tabIndex={-1}>
                          {showPwC ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="reg-field pt-1">
                  <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-lg transition-all" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('processing')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus size={16} />
                        {t('registerBtn')}
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>

            <CardFooter className="justify-center pb-7 pt-1">
              <p className="text-sm text-muted-foreground">
                {t('alreadyHaveAccount')}{' '}
                <Link to="/login" className="text-primary font-semibold hover:underline transition-colors">
                  {t('loginBtn')}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
