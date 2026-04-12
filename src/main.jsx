import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import './index.css'

const hostname = window.location.hostname;
const isLocalhost =
  hostname === 'localhost' || hostname === '127.0.0.1';

const allowedHosts = ['02.komiknesia.asia', 'komiknesia.vercel.app'];
const isAllowedHost =
  isLocalhost ||
  allowedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`)) ||
  /^komiknesia-.+\.vercel\.app$/i.test(hostname);

if (!isAllowedHost) {
  document.body.innerHTML = '<h1>Unauthorized domain</h1>';
  throw new Error('Blocked domain');
}

// Initialize theme before app renders
const savedTheme = localStorage.getItem('komiknesia-theme');
const theme = savedTheme || 'dark'; // Default to dark
if (theme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
