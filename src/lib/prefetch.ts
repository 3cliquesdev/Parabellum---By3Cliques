import { useRef, useCallback } from "react";
import { useQueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Enterprise prefetch hook — debounced, one-shot per item.
 * Usage: const handlers = usePrefetchOnHover(['ticket', id], queryFn);
 *        <div {...handlers}>...</div>
 */
export function usePrefetchOnHover(
  queryKey: QueryKey,
  queryFn: () => Promise<unknown>,
  staleTime = 60_000
) {
  const queryClient = useQueryClient();
  const prefetched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const onMouseEnter = useCallback(() => {
    if (prefetched.current) return;
    timer.current = setTimeout(() => {
      prefetched.current = true;
      queryClient.prefetchQuery({ queryKey, queryFn, staleTime });
    }, 150);
  }, [queryClient, queryKey, queryFn, staleTime]);

  const onMouseLeave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { onMouseEnter, onMouseLeave };
}

/**
 * Performance logger — logs mount-to-data-ready time in dev.
 * Call usePerformanceLog('TicketDetail', !isLoading) at the top of your page.
 */
export function usePerformanceLog(routeName: string, dataReady: boolean) {
  const start = useRef(performance.now());
  const logged = useRef(false);

  if (dataReady && !logged.current) {
    logged.current = true;
    const elapsed = Math.round(performance.now() - start.current);
    if (import.meta.env.DEV) {
      console.log(`[Perf] ${routeName} → data ready in ${elapsed}ms`);
    }
  }
}
