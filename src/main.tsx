import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";

// ============================================
// LIMPEZA AGRESSIVA DE CACHE NO STARTUP
// ============================================

// 1. Remove service workers residuais (PWA antigo)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('[Main] 🗑️ Service Worker removido');
    });
  });
}

// 2. Limpa IndexedDB antigo (cache Dexie)
if ('indexedDB' in window) {
  try {
    indexedDB.deleteDatabase('CRMChatDB');
    console.log('[Main] 🗑️ IndexedDB CRMChatDB limpo');
  } catch (e) {
    console.warn('[Main] Erro ao limpar IndexedDB:', e);
  }
}

// 3. Listener global para erros de chunk/módulo dinâmico corrompido
window.addEventListener('error', (event) => {
  const message = event.message || '';
  const isChunkError = 
    message.includes('dynamically imported module') ||
    message.includes('Failed to fetch') ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError');
  
  if (isChunkError) {
    console.error('[Main] ❌ Chunk corrompido detectado, forçando reload...', message);
    
    // Limpa caches antes de reload
    const hasCaches = 'caches' in window;
    if (hasCaches) {
      caches.keys().then((names: string[]) => {
        Promise.all(names.map((name: string) => caches.delete(name))).then(() => {
          location.reload();
        });
      });
    } else {
      location.reload();
    }
  }
});

// 4. Handler para rejeições de promise não tratadas (também pode ser chunk error)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason) || '';
  const isChunkError = 
    reason.includes('dynamically imported module') ||
    reason.includes('Failed to fetch') ||
    reason.includes('Loading chunk');
  
  if (isChunkError) {
    console.error('[Main] ❌ Promise de chunk rejeitada, forçando reload...', reason);
    location.reload();
  }
});

console.log('[Main] 🚀 App iniciando (cache limpo)');

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
