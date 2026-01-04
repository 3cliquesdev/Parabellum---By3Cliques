import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export const useServiceWorkerUpdate = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check immediately on registration
      r && r.update();
      
      // Check for updates every 10 seconds (more aggressive)
      r && setInterval(() => {
        r.update();
      }, 10 * 1000);
    },
    onNeedRefresh() {
      // Auto-update immediately when new version is available (no delay)
      toast.info('Nova versão disponível, atualizando...', { duration: 2000 });
      updateServiceWorker(true);
    },
    onOfflineReady() {
      console.log('App ready for offline use');
    },
  });

  // Force update if needRefresh is true on mount
  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

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
  };

  const dismiss = () => {
    setNeedRefresh(false);
  };

  return { needRefresh, update, dismiss };
};
