import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { getCurrentBuildId, forceUpdate } from "./lib/build/ensureLatestBuild";
import { APP_SCHEMA_VERSION } from "./lib/build/schemaVersion";
import { toast } from "sonner";

// ============================================
// SISTEMA DE VERSIONAMENTO DE SCHEMA
// ============================================

const SCHEMA_VERSION_KEY = 'app_schema_version';
const storedVersion = localStorage.getItem(SCHEMA_VERSION_KEY);

if (storedVersion !== APP_SCHEMA_VERSION) {
  console.warn('[Main] ⚠️ Schema version mismatch — resetting client state');
  console.warn('[Main] Stored:', storedVersion, '→ Current:', APP_SCHEMA_VERSION);
  
  // Preservar auth token do Supabase
  const supabaseAuthKey = Object.keys(localStorage).find(key => 
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );
  const supabaseAuthValue = supabaseAuthKey ? localStorage.getItem(supabaseAuthKey) : null;
  
  // Limpar localStorage
  localStorage.clear();
  
  // Restaurar auth
  if (supabaseAuthKey && supabaseAuthValue) {
    localStorage.setItem(supabaseAuthKey, supabaseAuthValue);
  }
  
  // Salvar nova versão
  localStorage.setItem(SCHEMA_VERSION_KEY, APP_SCHEMA_VERSION);
  
  // Limpar sessionStorage (exceto a flag de reload)
  const reloadKey = 'app_schema_reload_done';
  const alreadyReloaded = sessionStorage.getItem(reloadKey);
  sessionStorage.clear();
  
  // Limpar IndexedDB (assíncrono, não bloqueia)
  if ('indexedDB' in window && indexedDB.databases) {
    indexedDB.databases().then(dbs => {
      dbs.forEach(db => {
        if (db.name && !db.name.startsWith('sb-')) {
          indexedDB.deleteDatabase(db.name);
          console.log('[Main] 🗑️ IndexedDB deletado:', db.name);
        }
      });
    }).catch(e => console.warn('[Main] Erro ao limpar IndexedDB:', e));
  }
  
  // Reload único e controlado
  if (!alreadyReloaded) {
    sessionStorage.setItem(reloadKey, '1');
    console.log('[Main] 🔄 Recarregando para aplicar nova versão de schema...');
    window.location.reload();
  }
}

// ============================================
// SISTEMA DE AUTO-HEAL DE BUILD + LIMPEZA
// ============================================

// Log do build atual para diagnóstico
console.log('[Main] 🏗️ Build ID:', getCurrentBuildId());
console.log('[Main] 📋 Schema Version:', APP_SCHEMA_VERSION);

// 1. Remove service workers residuais (PWA antigo)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('[Main] 🗑️ Service Worker removido');
    });
  });
}

// 2. Limpa IndexedDB antigo (cache Dexie) - apenas se não foi limpo acima
if ('indexedDB' in window && storedVersion === APP_SCHEMA_VERSION) {
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
        description: 'Para evitar perder seu trabalho, a página não recarrega sozinha. Clique em "Atualizar" quando puder.',
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
        description: 'A página não recarrega automaticamente. Clique em "Atualizar" quando for conveniente.',
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
