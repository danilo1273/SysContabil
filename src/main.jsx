import "./fetchAdapter";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Trata automaticamente atualizações de versão na nuvem (Vercel / Vite chunk mismatch)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Nova versão do sistema detectada na nuvem. Recarregando componentes...', event);
  window.location.reload();
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload') || '0', 10);
    const now = Date.now();
    if (now - lastReload > 8000) {
      sessionStorage.setItem('last_chunk_reload', String(now));
      console.warn('Módulo dinâmico desatualizado no cache do navegador. Recarregando aplicação...', msg);
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
