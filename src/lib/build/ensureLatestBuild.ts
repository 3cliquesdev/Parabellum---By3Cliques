/**
 * Sistema de Auto-Heal de Build
 * 
 * Detecta se o app está rodando uma versão antiga e força atualização.
 * Isso resolve o problema de cache onde a "versão antiga" reaparece.
 */

// Declaração global do BUILD_ID injetado pelo Vite
declare const __BUILD_ID__: string;
declare const __BUILD_MODE__: string;

// Chaves de storage
const STORAGE_KEYS = {
  BUILD_ID: 'app_build_id',
  LAST_CHECK: 'app_build_last_check',
  FORCE_UPDATE_COUNT: 'app_force_update_count',
} as const;

// Intervalo mínimo entre checks (5 segundos para evitar loop)
const MIN_CHECK_INTERVAL_MS = 5000;

// Máximo de force updates consecutivos para evitar loop infinito
const MAX_FORCE_UPDATES = 3;

/**
 * Obtém o BUILD_ID atual do app
 */
export function getCurrentBuildId(): string {
  try {
    return __BUILD_ID__;
  } catch {
    return 'unknown';
  }
}

/**
 * Obtém o modo de build (development/production)
 */
export function getBuildMode(): string {
  try {
    return __BUILD_MODE__;
  } catch {
    return 'unknown';
  }
}

/**
 * Obtém informações completas do build
 */
export function getBuildInfo() {
  return {
    buildId: getCurrentBuildId(),
    mode: getBuildMode(),
    userAgent: navigator.userAgent,
    currentUrl: window.location.href,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Copia informações do build para clipboard
 */
export async function copyBuildInfo(): Promise<boolean> {
  try {
    const info = getBuildInfo();
    const text = `Build ID: ${info.buildId}\nMode: ${info.mode}\nURL: ${info.currentUrl}\nTimestamp: ${info.timestamp}\nUser Agent: ${info.userAgent}`;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa todos os caches do browser
 */
async function clearAllCaches(): Promise<void> {
  console.log('[BuildCheck] 🧹 Limpando caches...');
  
  // 1. Limpa Cache Storage
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[BuildCheck] ✅ Cache Storage limpo:', cacheNames.length, 'caches');
    } catch (e) {
      console.warn('[BuildCheck] ⚠️ Erro ao limpar Cache Storage:', e);
    }
  }
  
  // 2. Remove service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      console.log('[BuildCheck] ✅ Service Workers removidos:', registrations.length);
    } catch (e) {
      console.warn('[BuildCheck] ⚠️ Erro ao remover Service Workers:', e);
    }
  }
  
  // 3. Limpa IndexedDB conhecido
  if ('indexedDB' in window) {
    try {
      indexedDB.deleteDatabase('CRMChatDB');
      console.log('[BuildCheck] ✅ IndexedDB CRMChatDB limpo');
    } catch (e) {
      console.warn('[BuildCheck] ⚠️ Erro ao limpar IndexedDB:', e);
    }
  }
}

/**
 * Força reload com cache-bust
 */
function forceReload(): void {
  // Incrementa contador de force updates
  const count = parseInt(sessionStorage.getItem(STORAGE_KEYS.FORCE_UPDATE_COUNT) || '0', 10);
  sessionStorage.setItem(STORAGE_KEYS.FORCE_UPDATE_COUNT, String(count + 1));
  
  // Gera URL com cache-bust
  const url = new URL(window.location.href);
  url.searchParams.set('_cb', Date.now().toString());
  
  console.log('[BuildCheck] 🔄 Forçando reload para:', url.toString());
  
  // Usa replace para não poluir histórico
  window.location.replace(url.toString());
}

/**
 * Verifica se deve fazer check (evita loops)
 */
function shouldCheck(): boolean {
  // Verifica contador de force updates
  const forceCount = parseInt(sessionStorage.getItem(STORAGE_KEYS.FORCE_UPDATE_COUNT) || '0', 10);
  if (forceCount >= MAX_FORCE_UPDATES) {
    console.warn('[BuildCheck] ⚠️ Máximo de force updates atingido, pulando check');
    return false;
  }
  
  // Verifica intervalo mínimo
  const lastCheck = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_CHECK) || '0', 10);
  const now = Date.now();
  if (now - lastCheck < MIN_CHECK_INTERVAL_MS) {
    console.log('[BuildCheck] ⏳ Check recente, pulando');
    return false;
  }
  
  return true;
}

/**
 * Busca o BUILD_ID mais recente do servidor
 */
async function fetchLatestBuildId(): Promise<string | null> {
  try {
    // Fetch do index.html com cache-bust
    const response = await fetch(`/index.html?_cb=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    
    if (!response.ok) {
      console.warn('[BuildCheck] ⚠️ Falha ao buscar index.html:', response.status);
      return null;
    }
    
    const html = await response.text();
    
    // Extrai o build-id do meta tag
    const match = html.match(/<meta\s+name="app-build-id"\s+content="([^"]+)"/);
    if (match && match[1] && match[1] !== '__BUILD_PLACEHOLDER__') {
      return match[1];
    }
    
    console.log('[BuildCheck] ℹ️ Build ID não encontrado no HTML (placeholder ou ausente)');
    return null;
  } catch (e) {
    console.warn('[BuildCheck] ⚠️ Erro ao buscar latest build:', e);
    return null;
  }
}

/**
 * Função principal: verifica e atualiza se necessário
 */
export async function ensureLatestBuild(): Promise<void> {
  const currentBuildId = getCurrentBuildId();
  console.log('[BuildCheck] 🔍 Build atual:', currentBuildId);
  
  // Salva build atual no storage
  const storedBuildId = localStorage.getItem(STORAGE_KEYS.BUILD_ID);
  
  // Se o build mudou desde a última visita, reseta contador de force updates
  if (storedBuildId && storedBuildId !== currentBuildId) {
    console.log('[BuildCheck] ✨ Novo build detectado! Anterior:', storedBuildId);
    sessionStorage.removeItem(STORAGE_KEYS.FORCE_UPDATE_COUNT);
  }
  
  // Salva build atual
  localStorage.setItem(STORAGE_KEYS.BUILD_ID, currentBuildId);
  
  // Verifica se deve fazer check
  if (!shouldCheck()) {
    return;
  }
  
  // Marca timestamp do check
  localStorage.setItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());
  
  // Busca build mais recente do servidor
  const latestBuildId = await fetchLatestBuildId();
  
  if (!latestBuildId) {
    console.log('[BuildCheck] ℹ️ Não foi possível verificar build remoto, continuando...');
    return;
  }
  
  // Compara builds
  if (latestBuildId !== currentBuildId) {
    console.warn('[BuildCheck] ⚠️ BUILD DESATUALIZADO!');
    console.warn('[BuildCheck] Atual:', currentBuildId);
    console.warn('[BuildCheck] Servidor:', latestBuildId);
    
    // Limpa caches e força reload
    await clearAllCaches();
    forceReload();
    return;
  }
  
  console.log('[BuildCheck] ✅ Build atualizado!');
  // Reseta contador de force updates em caso de sucesso
  sessionStorage.removeItem(STORAGE_KEYS.FORCE_UPDATE_COUNT);
}

/**
 * Força atualização manual (chamada pelo usuário)
 */
export async function forceUpdate(): Promise<void> {
  console.log('[BuildCheck] 🔄 Forçando atualização manual...');
  
  // Reseta contadores para permitir force update
  sessionStorage.removeItem(STORAGE_KEYS.FORCE_UPDATE_COUNT);
  localStorage.removeItem(STORAGE_KEYS.LAST_CHECK);
  
  await clearAllCaches();
  forceReload();
}

/**
 * Verifica se há atualização disponível (sem fazer reload)
 * Retorna true se há uma versão mais nova no servidor
 */
export async function checkForUpdate(): Promise<boolean> {
  try {
    const currentBuildId = getCurrentBuildId();
    const latestBuildId = await fetchLatestBuildId();
    
    if (!latestBuildId) {
      return false;
    }
    
    const hasUpdate = latestBuildId !== currentBuildId;
    
    if (hasUpdate) {
      console.log('[BuildCheck] 🆕 Nova versão disponível!');
      console.log('[BuildCheck] Atual:', currentBuildId);
      console.log('[BuildCheck] Nova:', latestBuildId);
    }
    
    return hasUpdate;
  } catch (e) {
    console.warn('[BuildCheck] ⚠️ Erro ao verificar atualização:', e);
    return false;
  }
}
