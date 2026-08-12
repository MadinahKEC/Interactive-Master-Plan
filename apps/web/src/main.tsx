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
