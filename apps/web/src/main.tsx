import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useApp } from './store';
import { useOverrides } from './lib/overrides';
import './lib/auth'; // registers the Firebase auth listener (which starts Firestore sync post-login)
import './styles/tokens.css';
import './styles/app.css';
import './styles/admin.css';

// dev-only test hooks
if (import.meta.env.DEV) {
  (window as any).__app = useApp;
  (window as any).__ov = useOverrides;
  import('./lib/auth').then((m) => ((window as any).__auth = m.useAuth));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Hand off from the static boot splash to React's own branded splash, then remove it.
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('boot--gone');
  setTimeout(() => boot.remove(), 400);
});

// Progressive Web App: installable + offline (production only, so dev HMR is untouched).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => { /* offline support optional */ });
  });
}
