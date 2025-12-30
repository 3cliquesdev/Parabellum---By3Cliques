import { useRegisterSW } from 'virtual:pwa-register/react';

export const useServiceWorkerUpdate = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 60 seconds
      r && setInterval(() => {
        r.update();
      }, 60 * 1000);
    },
    onNeedRefresh() {
      console.log('New version available!');
    },
    onOfflineReady() {
      console.log('App ready for offline use');
    },
  });

  const update = () => {
    updateServiceWorker(true);
  };

  const dismiss = () => {
    setNeedRefresh(false);
  };

  return { needRefresh, update, dismiss };
};
