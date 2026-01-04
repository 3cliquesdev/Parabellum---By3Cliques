import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export const useServiceWorkerUpdate = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 30 seconds
      r && setInterval(() => {
        r.update();
      }, 30 * 1000);
    },
    onNeedRefresh() {
      // Auto-update immediately when new version is available
      toast.info('Nova versão disponível, atualizando...', { duration: 2000 });
      setTimeout(() => {
        updateServiceWorker(true);
      }, 1000);
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

  const update = () => {
    updateServiceWorker(true);
  };

  const dismiss = () => {
    setNeedRefresh(false);
  };

  return { needRefresh, update, dismiss };
};
