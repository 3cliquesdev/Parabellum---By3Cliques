import { useEffect, useRef, useCallback } from 'react';

interface VersionInfo {
  version: string;
  buildTime: string;
}

const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutos (mais frequente)

export function useVersionCheck() {
  const initialVersionRef = useRef<VersionInfo | null>(null);
  const hasReloadedRef = useRef(false);

  const forceReload = useCallback(async () => {
    console.log('[VersionCheck] 🔄 Forçando reload completo...');
    
    try {
      // 1. Limpa todos os caches do browser
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[VersionCheck] ✅ Browser caches limpos');
      }
      
      // 2. Limpa localStorage de versão
      localStorage.removeItem('app_version');
      localStorage.removeItem('last_version_check');
      
      // 3. Limpa sessionStorage
      sessionStorage.clear();
      
      console.log('[VersionCheck] ✅ Storage limpo, recarregando...');
    } catch (e) {
      console.warn('[VersionCheck] Erro ao limpar caches:', e);
    }
    
    // 4. Força reload do servidor (não do cache)
    window.location.reload();
  }, []);

  const checkVersion = useCallback(async () => {
    // Previne múltiplos reloads
    if (hasReloadedRef.current) return;
    
    try {
      // Adiciona timestamp para evitar cache
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        console.log('[VersionCheck] version.json não encontrado (ok no dev)');
        return;
      }
      
      const currentVersion: VersionInfo = await response.json();
      
      // Salva versão inicial na primeira execução
      if (!initialVersionRef.current) {
        initialVersionRef.current = currentVersion;
        console.log('[VersionCheck] 📌 Versão inicial:', currentVersion.version);
        return;
      }
      
      // Compara versões
      const hasNewVersion = 
        currentVersion.version !== initialVersionRef.current.version ||
        currentVersion.buildTime !== initialVersionRef.current.buildTime;
      
      if (hasNewVersion) {
        console.log('[VersionCheck] 🆕 Nova versão detectada!', {
          atual: initialVersionRef.current.version,
          nova: currentVersion.version
        });
        
        hasReloadedRef.current = true;
        
        // Auto-reload IMEDIATO sem esperar interação do usuário
        await forceReload();
      }
    } catch (error) {
      // Silencioso - não logamos erro pois version.json pode não existir em dev
    }
  }, [forceReload]);

  useEffect(() => {
    // Verifica imediatamente ao montar
    checkVersion();
    
    // Configura intervalo para verificações periódicas
    const intervalId = setInterval(checkVersion, CHECK_INTERVAL);
    
    // Também verifica quando a janela ganha foco (usuário volta para a aba)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion]);

  // Retorna vazio - não precisa mais de modal, reload é automático
  return { showUpdateModal: false, handleUpdate: forceReload };
}
