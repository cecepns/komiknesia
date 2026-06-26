import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const labelClass =
  'mb-2 block text-xs font-semibold uppercase tracking-wider text-sky-800/90 dark:text-cyan-100/85';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3.5 text-[15px] text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 dark:border-cyan-200/20 dark:bg-[#0a2d52]/90 dark:text-cyan-50 dark:placeholder:text-cyan-200/40 dark:focus:border-cyan-300/50 dark:focus:ring-cyan-400/20';

const primaryBtnClass =
  'mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-600 py-3.5 text-[15px] font-semibold text-white shadow-[0_7px_0_0_#0369a1] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_0_#0369a1] active:translate-y-0.5 active:shadow-[0_4px_0_0_#0369a1] disabled:pointer-events-none disabled:opacity-55 dark:border-cyan-200/20 dark:bg-[#0a2d52] dark:text-cyan-50 dark:shadow-[0_7px_0_0_#42a5f5] dark:hover:shadow-[0_8px_0_0_#60a5fa] dark:active:shadow-[0_4px_0_0_#3b82f6] dark:hover:brightness-110';

const LoginModal = ({ open, onClose, onSuccess, title, description }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const scrollY = window.scrollY;
    const { style: htmlStyle } = document.documentElement;
    const { style: bodyStyle } = document.body;

    const prevHtmlOverflow = htmlStyle.overflow;
    const prevBodyOverflow = bodyStyle.overflow;
    const prevBodyPosition = bodyStyle.position;
    const prevBodyTop = bodyStyle.top;
    const prevBodyWidth = bodyStyle.width;

    htmlStyle.overflow = 'hidden';
    bodyStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = '100%';

    return () => {
      htmlStyle.overflow = prevHtmlOverflow;
      bodyStyle.overflow = prevBodyOverflow;
      bodyStyle.position = prevBodyPosition;
      bodyStyle.top = prevBodyTop;
      bodyStyle.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMode('login');
      setUsername('');
      setName('');
      setPassword('');
      setEmail('');
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        toast.success('Berhasil masuk.');
        setUsername('');
        setPassword('');
        onSuccess?.();
        onClose?.();
      } else {
        toast.error(result.error || 'Login gagal');
      }
    } catch (err) {
      toast.error(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    if (!username.trim()) {
      toast.error('Username wajib diisi');
      return;
    }
    const usernameNormalized = username.trim().toLowerCase().replace(/\s+/g, '');
    if (usernameNormalized.length < 3) {
      toast.error('Username minimal 3 karakter');
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(usernameNormalized)) {
      toast.error('Username hanya boleh huruf kecil, angka, titik, underscore, atau dash (tanpa spasi).');
      return;
    }
    if (!password) {
      toast.error('Password wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('username', usernameNormalized);
      formData.append('password', password);
      if (email.trim()) formData.append('email', email.trim());

      const result = await register(formData);
      if (result.success) {
        toast.success('Registrasi berhasil. Anda sudah masuk.');
        onSuccess?.();
        onClose?.();
      } else {
        toast.error(result.error || 'Registrasi gagal');
      }
    } catch (err) {
      toast.error(err.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm dark:bg-black/75"
        aria-label="Tutup"
        onClick={onClose}
      />

      <div className="pointer-events-none fixed inset-0 opacity-[0.35] dark:opacity-45" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(14,165,233,0.12),transparent_42%),radial-gradient(circle_at_88%_78%,rgba(250,204,21,0.1),transparent_40%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.14),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(250,204,21,0.08),transparent_38%)]" />
      </div>

      <div className="relative z-[1] flex min-h-[100dvh] min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        {/* Padding bawah ekstra agar shadow offset 7px kartu & tombol tidak terpotong */}
        <div className="relative w-full max-w-md pb-5">
          <div className="relative overflow-visible rounded-3xl border border-sky-200/80 bg-white/95 p-6 shadow-[0_7px_0_0_#38bdf8] backdrop-blur-sm dark:border-cyan-200/25 dark:bg-[#0b355f]/95 dark:shadow-[0_7px_0_0_#facc15] sm:p-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl border border-slate-200/90 bg-white/90 p-2 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-cyan-200/20 dark:bg-[#0a2d52]/90 dark:text-cyan-100 dark:hover:bg-[#0a2d52]"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 pr-10 text-center">
            <h2
              id="login-modal-title"
              className="text-2xl font-extrabold tracking-tight text-[#163a5f] dark:text-cyan-50 sm:text-3xl"
            >
              {title || 'Login diperlukan'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sky-900/75 dark:text-cyan-100/80">
              {description ||
                'Chapter terbaru dapat dibaca setelah login. Setelah 2 jam dari rilis, chapter ini bisa dibaca tanpa login.'}
            </p>
          </div>

          <div className="mb-6 flex gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-cyan-200/15 dark:bg-[#0a2d52]/60">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-white text-sky-800 shadow-[0_4px_0_0_#38bdf8] dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#42a5f5]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-cyan-200/70 dark:hover:text-cyan-100'
              }`}
            >
              <LogIn className="h-4 w-4 shrink-0" />
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-white text-sky-800 shadow-[0_4px_0_0_#38bdf8] dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#42a5f5]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-cyan-200/70 dark:hover:text-cyan-100'
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              Daftar
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-modal-username" className={labelClass}>
                  Username atau email
                </label>
                <input
                  id="login-modal-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                  placeholder="Username atau email"
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="login-modal-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="login-modal-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              <p className="text-center text-sm leading-relaxed text-slate-600 dark:text-cyan-100/75">
                Lupa sandi?{' '}
                <Link
                  to="/contact"
                  onClick={onClose}
                  className="font-semibold text-sky-700 underline decoration-sky-600/40 underline-offset-2 transition-colors hover:text-sky-800 dark:text-cyan-300 dark:decoration-cyan-400/40 dark:hover:text-cyan-200"
                >
                  Hubungi admin
                </Link>
                .
              </p>
              <div className="pb-1">
                <button type="submit" disabled={loading} className={primaryBtnClass}>
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <LogIn className="h-5 w-5 shrink-0" />
                  )}
                  Masuk
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="login-modal-name" className={labelClass}>
                  Nama
                </label>
                <input
                  id="login-modal-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Nama lengkap"
                  required
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="login-modal-reg-username" className={labelClass}>
                  Username (unik, min. 3 karakter)
                </label>
                <input
                  id="login-modal-reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className={inputClass}
                  placeholder="username_unik"
                  required
                  minLength={3}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="login-modal-email" className={labelClass}>
                  Email (opsional)
                </label>
                <input
                  id="login-modal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="email@contoh.com"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="login-modal-reg-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="login-modal-reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              <div className="pb-1">
                <button type="submit" disabled={loading} className={primaryBtnClass}>
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <UserPlus className="h-5 w-5 shrink-0" />
                  )}
                  Daftar
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default LoginModal;
