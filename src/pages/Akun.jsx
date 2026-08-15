import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, Loader2, LogOut, Camera } from 'lucide-react';
import { getImageUrl } from '../utils/api';
import { toast } from 'react-toastify';

const Akun = () => {
  const { user, loading: authLoading, login, register, updateProfile, logout, isAuthenticated } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sync editable profile fields with current user
  useEffect(() => {
    if (user) {
      setProfileUsername(user.username || '');
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
      setProfileBio(user.bio || '');
    } else {
      setProfileUsername('');
      setProfileName('');
      setProfileEmail('');
      setProfileBio('');
    }
  }, [user]);

  const formatMembershipDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        toast.success('Berhasil masuk.');
      } else {
        const message = result.error || 'Login gagal';
        toast.error(message);
      }
    } catch (err) {
      const message = err.message || 'Login gagal';
      toast.error(message);
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
      } else {
        const message = result.error || 'Registrasi gagal';
        toast.error(message);
      }
    } catch (err) {
      const message = err.message || 'Registrasi gagal';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfileImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileLoading(true);
    try {
      const formData = new FormData();
      formData.append('profile_image', file);
      const result = await updateProfile(formData);
      if (result.success) {
        toast.success('Foto profil diperbarui.');
      } else {
        const message = result.error || 'Gagal memperbarui foto';
        toast.error(message);
      }
    } catch (err) {
      const message = err.message || 'Gagal memperbarui foto';
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfileInfo = async (e) => {
    e.preventDefault();

    const trimmedName = profileName.trim();
    const trimmedUsername = profileUsername.trim();
    const trimmedEmail = profileEmail.trim();
    const trimmedBio = profileBio.trim();

    if (!trimmedName) {
      toast.error('Nama wajib diisi');
      return;
    }
    if (!trimmedUsername) {
      toast.error('Username wajib diisi');
      return;
    }
    const normalizedUsername = trimmedUsername.toLowerCase().replace(/\s+/g, '');
    if (normalizedUsername.length < 3) {
      toast.error('Username minimal 3 karakter');
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
      toast.error('Username hanya boleh huruf kecil, angka, titik, underscore, atau dash (tanpa spasi).');
      return;
    }

    setProfileLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', trimmedName);
      formData.append('username', normalizedUsername);
      formData.append('email', trimmedEmail);
      formData.append('bio', trimmedBio);
      const result = await updateProfile(formData);
      if (result.success) {
        toast.success('Profil berhasil diperbarui.');
      } else {
        const message = result.error || 'Gagal memperbarui profil';
        toast.error(message);
      }
    } catch (err) {
      const message = err.message || 'Gagal memperbarui profil';
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      toast.error('Password lama dan password baru wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password baru tidak sama');
      return;
    }

    setPasswordLoading(true);
    try {
      const formData = new FormData();
      formData.append('current_password', currentPassword);
      formData.append('new_password', newPassword);
      const result = await updateProfile(formData);
      if (result.success) {
        toast.success('Password berhasil diperbarui.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const message = result.error || 'Gagal memperbarui password';
        toast.error(message);
      }
    } catch (err) {
      const message = err.message || 'Gagal memperbarui password';
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-transparent">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600 dark:text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-gray-900 dark:bg-transparent dark:text-gray-100">
      <Helmet>
        <title>Akun | KomikNesia</title>
        <meta name="description" content="Kelola akun KomikNesia: login, daftar, dan profil." />
      </Helmet>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-45"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(14,165,233,0.12),transparent_42%),radial-gradient(circle_at_88%_78%,rgba(250,204,21,0.1),transparent_40%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.14),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(250,204,21,0.08),transparent_38%)]" />
        <div className="absolute inset-0 [--grid:rgba(14,165,233,0.07)] [background-image:linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] [background-size:40px_40px] dark:[--grid:rgba(56,189,248,0.1)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 py-14 md:py-24">
        {isAuthenticated ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md shadow-2xl sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Profil
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Kelola foto, data akun, dan keamanan password.
              </p>
            </div>

            <div className="mb-6 flex flex-col items-center">
              <div className="relative inline-block">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-4 ring-red-500/40">
                  {user?.profile_image ? (
                    <img
                      src={getImageUrl(user.profile_image)}
                      alt={user.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-red-400">
                      {(user?.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 cursor-pointer rounded-full border border-red-500/50 bg-red-600 p-2.5 text-white shadow-lg transition-all duration-200 hover:bg-red-700 active:scale-95">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpdateProfileImage}
                    disabled={profileLoading}
                  />
                  {profileLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </label>
              </div>
              <p className="mt-3 text-xs text-gray-400">Tap ikon kamera untuk ganti foto</p>
            </div>

            {user?.membership_active && (
              <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200 shadow-md">
                <p className="font-semibold text-amber-300">Premium Member</p>
                <p className="mt-0.5 text-amber-200/90">
                  Aktif sampai{' '}
                  {formatMembershipDate(user?.membership_expires_at) || 'waktu yang tidak ditentukan'}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
              <h2 className="mb-4 text-left text-sm font-bold uppercase tracking-wide text-white">
                Data profil
              </h2>
              <form onSubmit={handleUpdateProfileInfo} className="space-y-5 text-left">
                <div>
                  <label
                    htmlFor="akun-profile-name"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Nama
                  </label>
                  <input
                    id="akun-profile-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    disabled={profileLoading}
                    required
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-profile-username"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Username
                  </label>
                  <input
                    id="akun-profile-username"
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    disabled={profileLoading}
                    minLength={3}
                    required
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-profile-email"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Email
                  </label>
                  <input
                    id="akun-profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    disabled={profileLoading}
                    placeholder="email@contoh.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-profile-bio"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Bio
                  </label>
                  <textarea
                    id="akun-profile-bio"
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    className="min-h-[7rem] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    disabled={profileLoading}
                    rows={4}
                    maxLength={500}
                    placeholder="Tulis bio singkat tentang kamu..."
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    {profileBio.length}/500 karakter
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {profileLoading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : null}
                  Simpan profil
                </button>
              </form>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
              <h2 className="mb-4 text-left text-sm font-bold uppercase tracking-wide text-white">
                Ubah password
              </h2>
              <form onSubmit={handleUpdatePassword} className="space-y-5 text-left">
                <div>
                  <label
                    htmlFor="akun-pw-current"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                  >
                    Password lama
                  </label>
                  <input
                    id="akun-pw-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    disabled={passwordLoading}
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="akun-pw-new"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                    >
                      Password baru
                    </label>
                    <input
                      id="akun-pw-new"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                      disabled={passwordLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="akun-pw-confirm"
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                    >
                      Konfirmasi password baru
                    </label>
                    <input
                      id="akun-pw-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                      disabled={passwordLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {passwordLoading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : null}
                  Simpan password
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                toast.success('Berhasil keluar.');
              }}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[15px] font-bold text-gray-200 shadow-md transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-98"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Keluar
            </button>
          </div>
        ) : (
          /* Login / Register */
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md shadow-2xl sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Akun
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Masuk dengan akun yang ada atau daftar akun baru.
              </p>
            </div>

            <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <LogIn className="h-4 w-4 shrink-0" />
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                  mode === 'register'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                Daftar
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="akun-login-username"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Username atau email
                  </label>
                  <input
                    id="akun-login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="Username atau email"
                    required
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-login-password"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Password
                  </label>
                  <input
                    id="akun-login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
                <p className="text-center text-sm leading-relaxed text-slate-600 dark:text-gray-300">
                  Lupa sandi?{' '}
                  <Link
                    to="/contact"
                    className="font-semibold text-red-600 underline decoration-red-600/40 underline-offset-2 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Hubungi admin
                  </Link>
                  .
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <LogIn className="h-5 w-5 shrink-0" />
                  )}
                  Masuk
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label
                    htmlFor="akun-reg-name"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Nama
                  </label>
                  <input
                    id="akun-reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="Nama lengkap"
                    required
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-reg-username"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Username (unik, min. 3 karakter)
                  </label>
                  <input
                    id="akun-reg-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="username_unik"
                    required
                    minLength={3}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-reg-email"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Email (opsional)
                  </label>
                  <input
                    id="akun-reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="email@contoh.com"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-reg-password"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Password
                  </label>
                  <input
                    id="akun-reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <UserPlus className="h-5 w-5 shrink-0" />
                  )}
                  Daftar
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Akun;
