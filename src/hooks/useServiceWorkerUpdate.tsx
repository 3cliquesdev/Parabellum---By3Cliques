import { useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

const clearAllCaches = async () => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('All caches cleared');
  }
};

export const useServiceWorkerUpdate = () => {
  const forceReload = useCallback(async () => {
    // Evitar loop infinito
    const lastReload = sessionStorage.getItem('sw-reload-time');
    const now = Date.now();
    
    if (lastReload && now - parseInt(lastReload) < 5000) {
      console.log('Reload recente, ignorando para evitar loop');
      return;
    }
    
    sessionStorage.setItem('sw-reload-time', now.toString());
    
    // Limpar todos os caches antes de recarregar
    await clearAllCaches();
    
    // Força reload do browser
    window.location.reload();
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check immediately on registration
      r && r.update();
      
      // Check for updates every 10 seconds
      r && setInterval(() => {
        r.update();
      }, 10 * 1000);
    },
    onNeedRefresh() {
      // Atualização instantânea e silenciosa
      toast.info('Atualizando...', { duration: 1000 });
      updateServiceWorker(true);
      
      // Força reload após breve delay para SW ativar
      setTimeout(() => {
        clearAllCaches().then(() => window.location.reload());
      }, 500);
    },
    onOfflineReady() {
      console.log('App ready for offline use');
    },
  });

  // Force update if needRefresh is true on mount
  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
      forceReload();
    }
  }, [needRefresh, updateServiceWorker, forceReload]);

  // Force SW update check on app mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.update();
      });
    }
  }, []);

  const update = () => {
    updateServiceWorker(true);
    forceReload();
  };

  const dismiss = () => {
    setNeedRefresh(false);
  };

  return { needRefresh, update, dismiss };
};
