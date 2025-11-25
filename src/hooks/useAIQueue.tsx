import { useRef, useCallback } from 'react';

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
}

export function useAIQueue() {
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const lastRequestTimeRef = useRef<number>(0);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift();
      if (!item) break;

      try {
        // Garantir mínimo de 4s entre requisições
        const timeSinceLastRequest = Date.now() - lastRequestTimeRef.current;
        const minDelay = 4000;
        if (timeSinceLastRequest < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
        }

        lastRequestTimeRef.current = Date.now();
        const result = await item.fn();
        item.resolve(result);
      } catch (error: any) {
        // Rate limit detection com exponential backoff
        if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
          const maxRetries = 3;
          if (item.retryCount < maxRetries) {
            // Exponential backoff: 5s, 15s, 30s
            const backoffDelay = Math.min(5000 * Math.pow(3, item.retryCount), 30000);
            console.warn(`[AIQueue] Rate limited, retrying in ${backoffDelay / 1000}s (attempt ${item.retryCount + 1}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            
            // Re-adicionar à fila com retry incrementado
            queueRef.current.unshift({
              ...item,
              retryCount: item.retryCount + 1
            });
            continue;
          } else {
            console.error('[AIQueue] Max retries reached, failing request');
            item.reject(error);
          }
        } else {
          item.reject(error);
        }
      }

      // Delay adicional entre requisições (4s base)
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    processingRef.current = false;
  }, []);

  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queueRef.current.push({
        fn,
        resolve,
        reject,
        retryCount: 0
      });
      processQueue();
    });
  }, [processQueue]);

  return { enqueue };
}
