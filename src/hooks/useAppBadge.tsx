import { useCallback } from 'react';

export function useAppBadge() {
  const setUnreadCount = useCallback(async (count: number) => {
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.error('Error setting app badge:', error);
      }
    }
  }, []);

  const clearBadge = useCallback(async () => {
    if ('clearAppBadge' in navigator) {
      try {
        await (navigator as any).clearAppBadge();
      } catch (error) {
        console.error('Error clearing app badge:', error);
      }
    }
  }, []);

  return { setUnreadCount, clearBadge };
}
