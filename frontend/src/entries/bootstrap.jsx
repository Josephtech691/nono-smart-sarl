import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { setAppTarget } from '../appTarget';
import '../index.css';

// Démarre une application. `target` : 'all' | 'client' | 'admin' | 'driver'.
export default function bootstrap(App, target = 'all') {
  setAppTarget(target);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );

  // PWA : enregistre le service worker en production uniquement (pas de gêne pour le hot-reload de Vite).
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
