/**
 * Limpa todos os caches do Service Worker e recarrega a página
 */
export const clearAllCaches = async (): Promise<void> => {
  try {
    // Limpar Service Worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
      console.log('All caches cleared:', cacheNames);
    }

    // Desregistrar Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(reg => reg.unregister())
      );
      console.log('Service workers unregistered:', registrations.length);
    }

    // Recarregar página
    window.location.reload();
  } catch (error) {
    console.error('Error clearing caches:', error);
    // Tentar recarregar mesmo assim
    window.location.reload();
  }
};

/**
 * Verifica se há uma nova versão do Service Worker disponível
 */
export const checkForUpdates = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        return registration.waiting !== null;
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }
  return false;
};
