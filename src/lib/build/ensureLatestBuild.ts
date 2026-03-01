/**
 * Sistema de Auto-Heal de Build v2
 * 
 * Detecta se o app está rodando uma versão antiga e força atualização.
 * Isso resolve o problema de cache onde a "versão antiga" reaparece.
 * Inclui Hard Refresh para limpeza completa de caches.
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

// Intervalo mínimo entre checks (1 segundo para preview mais responsivo)
const MIN_CHECK_INTERVAL_MS = 1000;

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
    const text = Object.entries(info)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa absolutamente todos os caches do navegador
 */
export async function clearAllCaches(): Promise<void> {
  console.log("[ensureLatestBuild] Iniciando limpeza agressiva de caches...");
  
  // 1. Limpar Cache Storage
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      console.log("[ensureLatestBuild] Limpando caches:", cacheNames);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (e) {
      console.warn("[ensureLatestBuild] Erro ao limpar caches:", e);
    }
  }
  
  // 2. Limpar IndexedDB
  if ('indexedDB' in window) {
    try {
      const databases = await indexedDB.databases?.() || [];
      for (const db of databases) {
        if (db.name) {
          console.log("[ensureLatestBuild] Deletando IndexedDB:", db.name);
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (e) {
      console.warn("[ensureLatestBuild] Erro ao limpar IndexedDB:", e);
    }
  }
  
  // 3. Limpar localStorage relacionado a build
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (e) {
    console.warn("[ensureLatestBuild] Erro ao limpar localStorage:", e);
  }
  
  console.log("[ensureLatestBuild] Limpeza de caches concluída");
}

/**
 * Força reload agressivo da página
 */
export function forceReload(): void {
  const baseUrl = window.location.origin + window.location.pathname;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  // Limpar sessionStorage também
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn("[ensureLatestBuild] Erro ao limpar sessionStorage:", e);
  }
  
  // Redirect com múltiplos cache-busters
  window.location.replace(`${baseUrl}?_force=${timestamp}&_nc=${random}`);
}

/**
 * Hard refresh - limpa tudo e recarrega
 */
export async function hardRefresh(): Promise<void> {
  console.log("[ensureLatestBuild] Executando Hard Refresh...");
  
  // Limpar caches
  await clearAllCaches();
  
  // Preservar sessão de autenticação do Supabase antes de limpar
  const supabaseAuthKey = Object.keys(localStorage).find(key => 
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );
  const supabaseAuthValue = supabaseAuthKey ? localStorage.getItem(supabaseAuthKey) : null;
  
  console.log("[ensureLatestBuild] Preservando sessão de autenticação:", supabaseAuthKey ? "encontrada" : "não encontrada");
  
  // Limpar localStorage (exceto auth que será restaurado)
  try {
    localStorage.clear();
  } catch (e) {
    console.warn("[ensureLatestBuild] Erro ao limpar localStorage:", e);
  }
  
  // Restaurar sessão de autenticação para evitar logout
  if (supabaseAuthKey && supabaseAuthValue) {
    try {
      localStorage.setItem(supabaseAuthKey, supabaseAuthValue);
      console.log("[ensureLatestBuild] Sessão de autenticação restaurada");
    } catch (e) {
      console.warn("[ensureLatestBuild] Erro ao restaurar sessão:", e);
    }
  }
  
  // Limpar sessionStorage (não afeta auth do Supabase que usa localStorage)
  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn("[ensureLatestBuild] Erro ao limpar sessionStorage:", e);
  }
  
  // Forçar reload
  forceReload();
}

// Função auxiliar removida - usar forceReload() acima

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
    // Tenta buscar build-id do HTML com cache-bust agressivo
    const timestamp = Date.now();
    const response = await fetch(`/index.html?_cb=${timestamp}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.warn("[ensureLatestBuild] Falha ao buscar index.html:", response.status);
      return null;
    }
    
    const html = await response.text();
    const match = html.match(/<meta\s+name="app-build-id"\s+content="([^"]+)"/i);
    
    if (match && match[1] && match[1] !== '__BUILD_PLACEHOLDER__') {
      return match[1];
    }
    
    // FALLBACK: Usar ETag ou Last-Modified do response
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    
    if (etag) {
      console.log("[ensureLatestBuild] Usando ETag como fallback:", etag);
      return `etag-${etag}`;
    }
    
    if (lastModified) {
      console.log("[ensureLatestBuild] Usando Last-Modified como fallback:", lastModified);
      return `lm-${lastModified}`;
    }
    
    // FALLBACK 2: Hash do conteúdo HTML
    const contentHash = await hashContent(html);
    console.log("[ensureLatestBuild] Usando hash do conteúdo como fallback:", contentHash);
    return `hash-${contentHash}`;
    
  } catch (error) {
    console.error("[ensureLatestBuild] Erro ao buscar versão:", error);
    return null;
  }
}

/**
 * Gera hash simples do conteúdo para comparação
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Função principal: verifica e atualiza se necessário
 */
/**
 * Função principal: verifica build mas NÃO faz reload automático
 * O refresh automático foi desativado para não interromper o trabalho do usuário
 * Usuários podem atualizar manualmente pelo botão no SidebarVersionIndicator
 */
export async function ensureLatestBuild(): Promise<boolean> {
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
    return false;
  }
  
  // Marca timestamp do check
  localStorage.setItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());
  
  // Busca build mais recente do servidor
  const latestBuildId = await fetchLatestBuildId();
  
  if (!latestBuildId) {
    console.log('[BuildCheck] ℹ️ Não foi possível verificar build remoto, continuando...');
    return false;
  }
  
  // Compara builds - apenas loga, NÃO faz reload automático
  if (latestBuildId !== currentBuildId) {
    console.warn('[BuildCheck] ⚠️ Nova versão disponível (sem reload automático)');
    console.warn('[BuildCheck] Atual:', currentBuildId);
    console.warn('[BuildCheck] Servidor:', latestBuildId);
    return true; // Indica que há atualização disponível
  }
  
  console.log('[BuildCheck] ✅ Build atualizado!');
  sessionStorage.removeItem(STORAGE_KEYS.FORCE_UPDATE_COUNT);
  return false;
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
