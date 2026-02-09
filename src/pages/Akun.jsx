import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, Loader2, LogOut, Camera } from 'lucide-react';
import { getImageUrl } from '../utils/api';

const Akun = () => {
  const { user, loading: authLoading, login, register, updateProfile, logout, isAuthenticated } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
      setProfileEmail(user.email || '');
    } else {
      setProfileUsername('');
      setProfileEmail('');
    }
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) setSuccess('Berhasil masuk.');
      else setError(result.error || 'Login gagal');
    } catch (err) {
      setError(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!username.trim()) {
      setError('Username wajib diisi');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username minimal 3 karakter');
      return;
    }
    if (!password) {
      setError('Password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', username.trim());
      formData.append('password', password);
      if (email.trim()) formData.append('email', email.trim());
      const result = await register(formData);
      if (result.success) setSuccess('Registrasi berhasil. Anda sudah masuk.');
      else setError(result.error || 'Registrasi gagal');
    } catch (err) {
      setError(err.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfileImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('profile_image', file);
      const result = await updateProfile(formData);
      if (result.success) setSuccess('Foto profil diperbarui.');
      else setError(result.error || 'Gagal memperbarui foto');
    } catch (err) {
      setError(err.message || 'Gagal memperbarui foto');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfileInfo = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedUsername = profileUsername.trim();
    const trimmedEmail = profileEmail.trim();

    if (!trimmedUsername) {
      setError('Username wajib diisi');
      return;
    }
    if (trimmedUsername.length < 3) {
      setError('Username minimal 3 karakter');
      return;
    }

    setProfileLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', trimmedUsername);
      if (trimmedEmail) {
        formData.append('email', trimmedEmail);
      }
      const result = await updateProfile(formData);
      if (result.success) {
        setSuccess('Profil berhasil diperbarui.');
      } else {
        setError(result.error || 'Gagal memperbarui profil');
      }
    } catch (err) {
      setError(err.message || 'Gagal memperbarui profil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword) {
      setError('Password lama dan password baru wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama');
      return;
    }

    setPasswordLoading(true);
    try {
      const formData = new FormData();
      formData.append('current_password', currentPassword);
      formData.append('new_password', newPassword);
      const result = await updateProfile(formData);
      if (result.success) {
        setSuccess('Password berhasil diperbarui.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || 'Gagal memperbarui password');
      }
    } catch (err) {
      setError(err.message || 'Gagal memperbarui password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <Loader2 className="h-10 w-10 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Helmet>
        <title>Akun | KomikNesia</title>
        <meta name="description" content="Kelola akun KomikNesia: login, daftar, dan profil." />
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-14 md:py-24">
        {isAuthenticated ? (
          /* Profile */
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-6">Profil</h1>
            <div className="relative inline-block mb-4">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 border-4 border-red-500 flex items-center justify-center">
                {user?.profile_image ? (
                  <img
                    src={getImageUrl(user.profile_image)}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-gray-500">
                    {(user?.username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-red-600 text-white rounded-full p-2 cursor-pointer hover:bg-red-700 shadow-lg">
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
            <form onSubmit={handleUpdateProfileInfo} className="mt-4 space-y-3 text-left">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  disabled={profileLoading}
                  minLength={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  disabled={profileLoading}
                  placeholder="email@contoh.com"
                />
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan Profil
              </button>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-left">
              <h2 className="text-sm font-semibold mb-3">Ubah Password</h2>
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Password Lama</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    disabled={passwordLoading}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Password Baru</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                      disabled={passwordLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                      disabled={passwordLoading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan Password
                </button>
              </form>
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            {success && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{success}</p>}
            <button
              type="button"
              onClick={() => { setError(''); setSuccess(''); logout(); }}
              className="mt-8 w-full py-3 px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="h-5 w-5" />
              Keluar
            </button>
          </div>
        ) : (
          /* Login / Register */
          <>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-md font-medium flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
              >
                <LogIn className="h-4 w-4" />
                Login
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-md font-medium flex items-center justify-center gap-2 ${mode === 'register' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
              >
                <UserPlus className="h-4 w-4" />
                Daftar
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
                {success}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username atau Email</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    placeholder="Username atau email"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    placeholder="Password"
                    required
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  Masuk
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username (unik, minimal 3 karakter)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    placeholder="Username"
                    required
                    minLength={3}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email (opsional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    placeholder="email@contoh.com"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    placeholder="Password"
                    required
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                  Daftar
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Akun;
