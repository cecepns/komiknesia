import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = await storage.getAuthToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Read cached user first for instant UI response
      const cached = await storage.getUser();
      if (cached) {
        setUser(cached);
      }

      // Fetch fresh user data from server
      const response = await apiClient.getMe();
      if (response?.status && response?.data) {
        setUser(response.data);
        await storage.setUser(response.data);
      } else {
        await storage.clearAuth();
        setUser(null);
      }
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        await storage.clearAuth();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    try {
      const response = await apiClient.login(username, password);
      if (response?.status && response?.data?.user) {
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response?.error || 'Login gagal' };
    } catch (error) {
      return { success: false, error: error.message || 'Login gagal' };
    }
  };

  const register = async (formData) => {
    try {
      const response = await apiClient.register(formData);
      if (response?.status && response?.data?.user) {
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response?.error || 'Registrasi gagal' };
    } catch (err) {
      return { success: false, error: err.message || 'Registrasi gagal' };
    }
  };

  const sendRegisterOtp = async (payload) => {
    try {
      const response = await apiClient.sendRegisterOtp(payload);
      return response;
    } catch (err) {
      return { status: false, error: err.message || 'Gagal mengirim OTP' };
    }
  };

  const forgotPassword = async (identifier) => {
    try {
      const response = await apiClient.forgotPassword(identifier);
      return response;
    } catch (err) {
      return { status: false, error: err.message || 'Gagal mengirim permintaan reset password' };
    }
  };

  const resetPassword = async (payload) => {
    try {
      const response = await apiClient.resetPassword(payload);
      return response;
    } catch (err) {
      return { status: false, error: err.message || 'Gagal mereset password' };
    }
  };

  const updateProfile = async (formDataOrObject) => {
    try {
      const response = await apiClient.updateProfile(formDataOrObject);
      if (response?.status && response?.data) {
        setUser(response.data);
        await storage.setUser(response.data);
        return { success: true };
      }
      return { success: false, error: response?.error || 'Update profil gagal' };
    } catch (error) {
      return { success: false, error: error.message || 'Update profil gagal' };
    }
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await apiClient.getMe();
      if (response?.status && response?.data) {
        setUser(response.data);
        await storage.setUser(response.data);
      }
    } catch {
      // ignore
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    sendRegisterOtp,
    forgotPassword,
    resetPassword,
    updateProfile,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
