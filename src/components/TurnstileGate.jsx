import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import Logo from '../assets/logo.png';
import { API_BASE_URL } from '../utils/api';

const TURNSTILE_SITE_KEY = '0x4AAAAAAEWaUoa7oc3vFoJo';
const STORAGE_KEY = 'cf_turnstile_passed';

export default function TurnstileGate({ children }) {
  const [isVerified, setIsVerified] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [isVerifyingWithBackend, setIsVerifyingWithBackend] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const widgetContainerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    // 1. Cek apakah sudah ada session token (JWT) valid di browser
    try {
      const savedToken = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      // Token valid harus berformat JWT (3 bagian dipisahkan titik)
      if (savedToken && savedToken.split('.').length === 3) {
        setIsVerified(true);
        setCheckingStorage(false);
      } else {
        // Hapus token lama/raw yang tidak valid
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
        setCheckingStorage(false);
      }
    } catch {
      setCheckingStorage(false);
    }

    // 2. Listener jika backend mengabarkan token kedaluwarsa
    const handleExpired = () => {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      setIsVerified(false);
      setCheckingStorage(false);
    };
    window.addEventListener('turnstile-expired', handleExpired);

    // 3. Tunggu script Turnstile siap
    const checkTurnstileReady = setInterval(() => {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        setTurnstileLoaded(true);
        clearInterval(checkTurnstileReady);
      }
    }, 200);

    return () => {
      window.removeEventListener('turnstile-expired', handleExpired);
      clearInterval(checkTurnstileReady);
    };
  }, []);

  // 3. Render widget saat Turnstile ready dan kontainer tersedia
  useEffect(() => {
    if (isVerified || checkingStorage || !turnstileLoaded || !widgetContainerRef.current) {
      return;
    }

    if (widgetIdRef.current !== null) {
      return;
    }

    try {
      const widgetId = window.turnstile.render(widgetContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        size: 'normal',
        callback: async (token) => {
          setIsVerifyingWithBackend(true);
          setErrorMsg('');

          try {
            const res = await fetch(`${API_BASE_URL}/auth/verify-turnstile`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token }),
            });

            const data = await res.json();

            if (res.ok && data.status && data.gateToken) {
              try {
                sessionStorage.setItem(STORAGE_KEY, data.gateToken);
                localStorage.setItem(STORAGE_KEY, data.gateToken);
              } catch {
                // ignore
              }
              setIsVerified(true);
            } else {
              setErrorMsg(data.error || 'Verifikasi keamanan gagal. Silakan coba lagi.');
              if (widgetIdRef.current !== null && window.turnstile) {
                window.turnstile.reset(widgetIdRef.current);
              }
            }
          } catch (err) {
            console.error('Turnstile backend error:', err);
            setErrorMsg('Gagal memvalidasi sesi keamanan ke server. Silakan coba lagi.');
            if (widgetIdRef.current !== null && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          } finally {
            setIsVerifyingWithBackend(false);
          }
        },
        'error-callback': () => {
          setErrorMsg('Verifikasi gagal. Silakan coba lagi atau muat ulang halaman.');
        },
        'expired-callback': () => {
          setErrorMsg('Waktu verifikasi habis. Silakan centang kembali.');
          if (widgetIdRef.current !== null && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      });

      widgetIdRef.current = widgetId;
    } catch (err) {
      console.error('Turnstile render error:', err);
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup error
        }
        widgetIdRef.current = null;
      }
    };
  }, [turnstileLoaded, isVerified, checkingStorage]);

  if (checkingStorage) {
    return null;
  }

  // Jika sudah lolos, tampilkan seluruh website
  if (isVerified) {
    return <>{children}</>;
  }

  // Tampilan Layar Verifikasi Modern & Clean
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#070b14]/95 text-gray-100 p-4 select-none backdrop-blur-md">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-red-600/15 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md bg-[#0f172a]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl flex flex-col items-center text-center overflow-hidden">
        {/* Subtle accent border on top */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent"></div>

        {/* Logo KomikNesia */}
        <div className="mb-4 flex items-center justify-center">
          <img
            src={Logo}
            alt="KomikNesia Logo"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-md"
          />
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-base sm:text-lg font-semibold text-white tracking-normal mb-1">
          Pemeriksaan Keamanan
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed max-w-xs">
          Harap selesaikan verifikasi di bawah untuk memastikan Anda bukan robot.
        </p>

        {/* Turnstile Widget Container */}
        <div className="w-full flex flex-col items-center justify-center min-h-[70px] mb-4">
          {(!turnstileLoaded || isVerifyingWithBackend) && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              <span>{isVerifyingWithBackend ? 'Memvalidasi sesi keamanan...' : 'Memuat modul keamanan...'}</span>
            </div>
          )}
          <div ref={widgetContainerRef} className={`flex justify-center w-full ${isVerifyingWithBackend ? 'hidden' : ''}`}></div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 mb-4 w-full text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer info */}
        <div className="w-full pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-gray-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Verifikasi aman oleh Cloudflare Turnstile</span>
        </div>
      </div>
    </div>
  );
}
