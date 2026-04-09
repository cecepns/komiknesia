import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Loader2, MessageCircle, UserPlus } from 'lucide-react';
import { apiClient } from '../utils/api';

const normalizeUsername = (value) => value.toLowerCase().replace(/\s+/g, '');

const Login = () => {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const data = await apiClient.getContactInfo(true);
        if (data?.whatsapp) {
          setAdminWhatsapp(String(data.whatsapp));
        }
      } catch (fetchError) {
        // Silent fail: fallback without forgot-password CTA.
      }
    };
    fetchContactInfo();
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        const from = location.state?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Login gagal');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const usernameNormalized = normalizeUsername(username.trim());

    if (!name.trim()) {
      setError('Nama wajib diisi');
      return;
    }
    if (usernameNormalized.length < 3) {
      setError('Username minimal 3 karakter');
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(usernameNormalized)) {
      setError('Username hanya boleh huruf kecil, angka, titik, underscore, atau dash (tanpa spasi).');
      return;
    }
    if (!password) {
      setError('Password wajib diisi');
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
        const from = location.state?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Registrasi gagal');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat registrasi');
    } finally {
      setLoading(false);
    }
  };

  const whatsappHref = adminWhatsapp
    ? `https://wa.me/${adminWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        'Halo admin, saya lupa password akun KomikNesia.'
      )}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Helmet>
        <title>Login | KomikNesia</title>
        <meta name="description" content="Masuk ke panel administrasi KomikNesia untuk mengelola konten dan pengaturan website." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full mb-4">
              <LogIn className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Komiknesia Admin
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Masuk ke panel administrasi
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mb-6 flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-6">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nama
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Nama lengkap"
                  disabled={loading}
                />
              </div>
            )}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {mode === 'login' ? 'Username atau Email' : 'Username'}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(mode === 'register' ? normalizeUsername(e.target.value) : e.target.value)
                }
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder={mode === 'login' ? 'Masukkan username atau email' : 'contoh: user_keren'}
                disabled={loading}
              />
              {mode === 'register' && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Username otomatis huruf kecil, tanpa spasi, dan harus unik.
                </p>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email (opsional)
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="email@contoh.com"
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Masukkan password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  {mode === 'login' ? <LogIn className="h-5 w-5 mr-2" /> : <UserPlus className="h-5 w-5 mr-2" />}
                  {mode === 'login' ? 'Masuk' : 'Daftar'}
                </>
              )}
            </button>
          </form>

          {whatsappHref && (
            <div className="mt-4 text-right">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Lupa sandi? Hubungi admin
              </a>
            </div>
          )}

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              ← Kembali ke halaman utama
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

