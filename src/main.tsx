import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { getCurrentBuildId, forceUpdate } from "./lib/build/ensureLatestBuild";
import { toast } from "sonner";

// ============================================
// SISTEMA DE AUTO-HEAL DE BUILD + LIMPEZA
// ============================================

// Log do build atual para diagnóstico
console.log('[Main] 🏗️ Build ID:', getCurrentBuildId());

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
    console.error('[Main] ❌ Chunk corrompido detectado (auto-reload desativado):', message);

    // IMPORTANTE: não interromper o trabalho do usuário com reload automático.
    // Mostra um toast com ação manual para atualizar.
    const shownKey = 'app_chunk_error_toast_shown';
    if (!sessionStorage.getItem(shownKey)) {
      sessionStorage.setItem(shownKey, '1');
      toast.warning('Nova versão pode estar disponível', {
        description: 'Para evitar perder seu trabalho, a página não recarrega sozinha. Clique em “Atualizar” quando puder.',
        duration: 15000,
        action: {
          label: 'Atualizar',
          onClick: () => {
            // mantém o update como ação do usuário
            setTimeout(() => forceUpdate(), 200);
          },
        },
      });
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
    console.error('[Main] ❌ Promise de chunk rejeitada (auto-reload desativado):', reason);

    const shownKey = 'app_chunk_error_toast_shown';
    if (!sessionStorage.getItem(shownKey)) {
      sessionStorage.setItem(shownKey, '1');
      toast.warning('Nova versão pode estar disponível', {
        description: 'A página não recarrega automaticamente. Clique em “Atualizar” quando for conveniente.',
        duration: 15000,
        action: {
          label: 'Atualizar',
          onClick: () => setTimeout(() => forceUpdate(), 200),
        },
      });
    }
  }
});

// 5. Verificação de build desativada - usuário atualiza manualmente pelo SidebarVersionIndicator
// (evita refresh automático que pode interromper o trabalho do usuário)

console.log('[Main] 🚀 App iniciando');

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
