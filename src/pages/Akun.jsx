import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, Loader2, LogOut, Camera, KeyRound, Mail, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiClient, getImageUrl } from '../utils/api';
import { toast } from 'react-toastify';

const Akun = () => {
  const { user, loading: authLoading, login, register, updateProfile, logout, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'register_otp' | 'forgot_password' | 'reset_password'

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Forgot / Reset password states
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // Profile management states
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // General loading and timer states
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef(null);

  // Check URL parameters for direct reset password links (e.g. /akun?mode=reset_password&email=...&otp=...)
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    const urlEmail = searchParams.get('email');
    const urlOtp = searchParams.get('otp') || searchParams.get('token');

    if (urlMode === 'reset_password' || (urlEmail && urlOtp)) {
      setMode('reset_password');
      if (urlEmail) {
        setResetEmail(urlEmail);
        setMaskedEmail(urlEmail);
      }
      if (urlOtp) {
        setResetOtpCode(urlOtp);
      }
    }
  }, [searchParams]);

  // Countdown timer handler for resending OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendCooldown]);

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

  // Step 1: Send OTP to register
  const handleRequestRegisterOtp = async (e) => {
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
    if (!email.trim()) {
      toast.error('Email wajib diisi untuk verifikasi OTP');
      return;
    }
    if (!password) {
      toast.error('Password wajib diisi');
      return;
    }
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.sendRegisterOtp({
        name: name.trim(),
        username: usernameNormalized,
        email: email.trim(),
        password,
      });

      if (res && res.status) {
        toast.success(res.message || 'Kode OTP telah dikirim ke email Anda.');
        setMode('register_otp');
        setResendCooldown(60);
      } else {
        toast.error(res.error || 'Gagal mengirim kode OTP');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengirim kode OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP & Complete Registration
  const handleVerifyRegisterOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      toast.error('Masukkan 6 digit kode OTP yang diterima di email');
      return;
    }

    const usernameNormalized = username.trim().toLowerCase().replace(/\s+/g, '');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('username', usernameNormalized);
      formData.append('password', password);
      formData.append('email', email.trim());
      formData.append('otp_code', otpCode.trim());

      const result = await register(formData);
      if (result.success) {
        toast.success('Registrasi berhasil! Anda sudah masuk.');
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

  // Resend OTP for Register
  const handleResendRegisterOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const usernameNormalized = username.trim().toLowerCase().replace(/\s+/g, '');
      const res = await apiClient.sendRegisterOtp({
        name: name.trim(),
        username: usernameNormalized,
        email: email.trim(),
        password,
      });
      if (res && res.status) {
        toast.success('Kode OTP baru telah dikirim ke email Anda.');
        setResendCooldown(60);
      } else {
        toast.error(res.error || 'Gagal mengirim ulang OTP');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengirim ulang OTP');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Step 1: Send OTP
  const handleRequestForgotOtp = async (e) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      toast.error('Masukkan email atau username akun Anda');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.forgotPassword(forgotIdentifier.trim());
      if (res && res.status) {
        setResetEmail(res.email || forgotIdentifier.trim());
        setMaskedEmail(res.maskedEmail || res.email || forgotIdentifier.trim());
        setMode('reset_password');
        setResendCooldown(60);
        toast.success(res.message || 'Kode reset password telah dikirim ke email Anda.');
      } else {
        toast.error(res.error || 'Gagal mengirim kode reset password');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengirim kode reset password');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Step 2: Reset with OTP
  const handleVerifyResetPassword = async (e) => {
    e.preventDefault();
    if (!resetOtpCode.trim()) {
      toast.error('Kode OTP wajib diisi');
      return;
    }
    if (!resetNewPassword) {
      toast.error('Password baru wajib diisi');
      return;
    }
    if (resetNewPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error('Konfirmasi password baru tidak cocok');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.resetPassword({
        email: resetEmail,
        otp_code: resetOtpCode.trim(),
        new_password: resetNewPassword,
      });

      if (res && res.status) {
        toast.success(res.message || 'Password berhasil diubah. Silakan masuk.');
        setMode('login');
        setUsername(resetEmail);
        setPassword('');
        setResetOtpCode('');
        setResetNewPassword('');
        setResetConfirmPassword('');
      } else {
        toast.error(res.error || 'Gagal mereset password');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mereset password');
    } finally {
      setLoading(false);
    }
  };

  // Profile Management
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
          /* Profile Page for Logged In Users */
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
          /* Authentication Forms */
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md shadow-2xl sm:p-8">
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {mode === 'login' && 'Masuk Akun'}
                {mode === 'register' && 'Daftar Akun Baru'}
                {mode === 'register_otp' && 'Verifikasi Email'}
                {mode === 'forgot_password' && 'Lupa Password'}
                {mode === 'reset_password' && 'Atur Password Baru'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                {mode === 'login' && 'Masuk untuk mengakses bookmark, histori baca, dan fitur premium.'}
                {mode === 'register' && 'Buat akun KomikNesia gratis untuk pengalaman membaca terbaik.'}
                {mode === 'register_otp' && `Masukkan 6 digit kode OTP yang telah dikirim ke ${email}.`}
                {mode === 'forgot_password' && 'Masukkan username atau email Anda untuk menerima kode reset.'}
                {mode === 'reset_password' && `Masukkan kode OTP yang dikirim ke ${maskedEmail || resetEmail}.`}
              </p>
            </div>

            {/* Mode Switcher Tabs for Login / Register */}
            {(mode === 'login' || mode === 'register') && (
              <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setMode('login')}
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
                  onClick={() => setMode('register')}
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
            )}

            {/* 1. LOGIN FORM */}
            {mode === 'login' && (
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
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="akun-login-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(username || '');
                        setMode('forgot_password');
                      }}
                      className="text-xs font-medium text-red-500 hover:text-red-400 underline transition-colors"
                    >
                      Lupa password?
                    </button>
                  </div>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <LogIn className="h-5 w-5 shrink-0" />
                  )}
                  Masuk Sekarang
                </button>
              </form>
            )}

            {/* 2. REGISTER FORM - STEP 1 */}
            {mode === 'register' && (
              <form onSubmit={handleRequestRegisterOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="akun-reg-name"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Nama Lengkap *
                  </label>
                  <input
                    id="akun-reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="Nama Anda"
                    required
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-reg-username"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Username * (min. 3 karakter)
                  </label>
                  <input
                    id="akun-reg-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="username_kamu"
                    required
                    minLength={3}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-reg-email"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Email Aktif * (untuk verifikasi OTP)
                  </label>
                  <input
                    id="akun-reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="nama@email.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label
                    htmlFor="akun-reg-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Password * (min. 6 karakter)
                  </label>
                  <input
                    id="akun-reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                    ) : (
                      <Mail className="h-5 w-5 shrink-0" />
                    )}
                    Kirim Kode OTP Verifikasi
                  </button>
                </div>
              </form>
            )}

            {/* 3. REGISTER OTP VERIFICATION - STEP 2 */}
            {mode === 'register_otp' && (
              <form onSubmit={handleVerifyRegisterOtp} className="space-y-5">
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                  <Mail className="mx-auto h-8 w-8 text-red-400 mb-2" />
                  <p className="text-xs text-gray-300">
                    Kami telah mengirimkan 6 digit kode OTP ke:
                  </p>
                  <p className="font-semibold text-white mt-1 text-sm">{email}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Cek folder Inbox atau Spam email Anda.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="akun-reg-otp"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200 text-center"
                  >
                    Kode OTP (6 Digit)
                  </label>
                  <input
                    id="akun-reg-otp"
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[8px] font-bold text-red-400 placeholder:text-gray-600 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="••••••"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Tidak menerima kode?</span>
                  <button
                    type="button"
                    onClick={handleResendRegisterOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="font-semibold text-red-500 hover:text-red-400 disabled:text-gray-500 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang OTP'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  )}
                  Verifikasi & Selesaikan Pendaftaran
                </button>

                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="flex w-full items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Ubah data pendaftaran
                </button>
              </form>
            )}

            {/* 4. FORGOT PASSWORD - STEP 1 */}
            {mode === 'forgot_password' && (
              <form onSubmit={handleRequestForgotOtp} className="space-y-5">
                <div>
                  <label
                    htmlFor="akun-forgot-identifier"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Email atau Username Terdaftar
                  </label>
                  <input
                    id="akun-forgot-identifier"
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="nama@email.com atau username"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <Mail className="h-5 w-5 shrink-0" />
                  )}
                  Kirim Kode Reset Password
                </button>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex w-full items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Kembali ke Halaman Login
                </button>
              </form>
            )}

            {/* 5. RESET PASSWORD - STEP 2 */}
            {mode === 'reset_password' && (
              <form onSubmit={handleVerifyResetPassword} className="space-y-4">
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                  <KeyRound className="mx-auto h-7 w-7 text-red-400 mb-1" />
                  <p className="text-xs text-gray-300">
                    Kode verifikasi reset telah dikirim ke:
                  </p>
                  <p className="font-semibold text-white text-sm mt-0.5">{maskedEmail || resetEmail}</p>
                </div>

                <div>
                  <label
                    htmlFor="akun-reset-otp"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Kode OTP (6 Digit) *
                  </label>
                  <input
                    id="akun-reset-otp"
                    type="text"
                    maxLength={6}
                    value={resetOtpCode}
                    onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-center text-xl tracking-[6px] font-bold text-red-400 placeholder:text-gray-600 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="••••••"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="akun-reset-newpw"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Password Baru * (min. 6 karakter)
                  </label>
                  <input
                    id="akun-reset-newpw"
                    type="password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="Password baru Anda"
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="akun-reset-confirmpw"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-gray-200"
                  >
                    Konfirmasi Password Baru *
                  </label>
                  <input
                    id="akun-reset-confirmpw"
                    type="password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-gray-100 placeholder:text-gray-500 outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/25"
                    placeholder="Ulangi password baru"
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <span>Tidak menerima kode?</span>
                  <button
                    type="button"
                    onClick={handleRequestForgotOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="font-semibold text-red-500 hover:text-red-400 disabled:text-gray-500 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang OTP'}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-200 hover:bg-red-700 active:scale-98 disabled:pointer-events-none disabled:opacity-55"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 shrink-0" />
                    )}
                    Simpan Password Baru & Masuk
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex w-full items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Batal & Kembali ke Login
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
