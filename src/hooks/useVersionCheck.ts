import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface VersionInfo {
  version: string;
  buildTime: string;
}

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function useVersionCheck() {
  const initialVersionRef = useRef<VersionInfo | null>(null);
  const hasNotifiedRef = useRef(false);

  const checkVersion = useCallback(async () => {
    try {
      // Adiciona timestamp para evitar cache
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) return;
      
      const currentVersion: VersionInfo = await response.json();
      
      // Salva versão inicial na primeira execução
      if (!initialVersionRef.current) {
        initialVersionRef.current = currentVersion;
        console.log('[VersionCheck] Versão inicial:', currentVersion.version);
        return;
      }
      
      // Compara versões
      const hasNewVersion = 
        currentVersion.version !== initialVersionRef.current.version ||
        currentVersion.buildTime !== initialVersionRef.current.buildTime;
      
      if (hasNewVersion && !hasNotifiedRef.current) {
        hasNotifiedRef.current = true;
        console.log('[VersionCheck] Nova versão detectada:', currentVersion.version);
        
        toast('🚀 Nova versão disponível!', {
          description: 'Atualize agora para ter as últimas melhorias e correções',
          duration: Infinity,
          position: 'bottom-center',
          action: {
            label: '🔄 Atualizar',
            onClick: async () => {
              // Limpa cache do service worker e caches
              if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
              }
              // Força reload sem cache
              window.location.reload();
            }
          },
          onDismiss: () => {
            setTimeout(() => {
              hasNotifiedRef.current = false;
            }, CHECK_INTERVAL);
          }
        });
      }
    } catch (error) {
      console.error('[VersionCheck] Erro ao verificar versão:', error);
    }
  }, []);

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
}
