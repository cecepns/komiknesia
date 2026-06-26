import { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../utils/api';

const AuthContext = createContext(null);
const USER_CACHE_KEY = 'auth_user_cache';

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(nextUser) {
  try {
    if (nextUser) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = apiClient.getAuthToken();
      if (!token) {
        writeCachedUser(null);
        setLoading(false);
        return;
      }

      const cachedUser = readCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
      }

      try {
        const response = await apiClient.getMe();
        if (response.status && response.data) {
          setUser(response.data);
          writeCachedUser(response.data);
        } else {
          apiClient.logout();
          writeCachedUser(null);
          setUser(null);
        }
      } catch (error) {
        const status = error?.status;
        if (status === 401 || status === 403) {
          apiClient.logout();
          writeCachedUser(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await apiClient.login(username, password);
      if (response.status && response.data) {
        setUser(response.data.user);
        writeCachedUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (formData) => {
    try {
      const response = await apiClient.register(formData);
      if (response.status && response.data) {
        setUser(response.data.user);
        writeCachedUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response.error || 'Registrasi gagal' };
    } catch (err) {
      return { success: false, error: err.message || 'Registrasi gagal' };
    }
  };

  const updateProfile = async (formData) => {
    try {
      const response = await apiClient.updateProfile(formData);
      if (response.status && response.data) {
        setUser(response.data);
        writeCachedUser(response.data);
        return { success: true };
      }
      return { success: false, error: response.error || 'Update gagal' };
    } catch (error) {
      return { success: false, error: error.message || 'Update gagal' };
    }
  };

  const logout = () => {
    apiClient.logout();
    writeCachedUser(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    updateProfile,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

