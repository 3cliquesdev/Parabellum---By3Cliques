import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type ErrorType = 'runtime' | 'network' | 'edge_function' | 'chunk' | 'unhandled_rejection';

interface ErrorEntry {
  type: ErrorType;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

const DEBOUNCE_MS = 5000; // Max 1 error per type per 5s
const SPIKE_THRESHOLD = 10; // errors in window
const SPIKE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Global error tracker hook — captures frontend errors and persists to database.
 * Should be mounted once at App level.
 */
export function useErrorTracker() {
  const lastSentByType = useRef<Map<string, number>>(new Map());
  const recentErrors = useRef<number[]>([]);
  const spikeNotified = useRef(false);

  const persistError = useCallback(async (entry: ErrorEntry) => {
    const key = `${entry.type}:${entry.message.slice(0, 100)}`;
    const now = Date.now();
    const lastSent = lastSentByType.current.get(key) || 0;

    // Debounce: skip if same error type+message sent within 5s
    if (now - lastSent < DEBOUNCE_MS) return;
    lastSentByType.current.set(key, now);

    // Track for spike detection
    recentErrors.current.push(now);
    recentErrors.current = recentErrors.current.filter(t => now - t < SPIKE_WINDOW_MS);

    // Get user id if available
    let userId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id || null;
    } catch { /* ignore */ }

    // Persist to database
    try {
      await supabase.from('client_error_logs').insert([{
        user_id: userId,
        error_type: entry.type,
        message: entry.message.slice(0, 2000),
        stack: entry.stack?.slice(0, 5000) || null,
        metadata: {
          url: window.location.href,
          user_agent: navigator.userAgent,
          build_id: String(((window as unknown) as Record<string, unknown>).__APP_SCHEMA_VERSION || 'unknown'),
          timestamp: new Date().toISOString(),
          ...entry.metadata,
        },
      }]);
    } catch (err) {
      // Silently fail — don't create error loops
      console.warn('[ErrorTracker] Failed to persist error:', err);
    }

    // Spike detection — show toast for admins
    if (recentErrors.current.length >= SPIKE_THRESHOLD && !spikeNotified.current) {
      spikeNotified.current = true;
      // Reset after 10 minutes
      setTimeout(() => { spikeNotified.current = false; }, 10 * 60 * 1000);
      
      // Dispatch custom event for admin toast
      window.dispatchEvent(new CustomEvent('error-spike', {
        detail: { count: recentErrors.current.length, windowMinutes: 5 }
      }));
    }
  }, []);

  useEffect(() => {
    // 1. window.onerror — runtime errors
    const handleError = (event: ErrorEvent) => {
      // Skip chunk loading errors (handled separately)
      if (event.message?.includes('Loading chunk') || event.message?.includes('dynamically imported module')) {
        persistError({
          type: 'chunk',
          message: event.message,
          stack: event.error?.stack,
          metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        });
        return;
      }

      persistError({
        type: 'runtime',
        message: event.message || 'Unknown runtime error',
        stack: event.error?.stack,
        metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      });
    };

    // 2. unhandledrejection — promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;

      // Detect edge function failures
      const isEdgeFunction = message.includes('FunctionsHttpError') || 
                             message.includes('FunctionsRelayError') ||
                             message.includes('edge-function') ||
                             message.includes('503');

      persistError({
        type: isEdgeFunction ? 'edge_function' : 'unhandled_rejection',
        message: message.slice(0, 2000),
        stack,
      });
    };

    // 3. Intercept fetch for network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Track edge function failures (5xx)
        if (response.status >= 500) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
          if (url.includes('/functions/v1/') || url.includes('supabase')) {
            persistError({
              type: 'edge_function',
              message: `HTTP ${response.status} on ${url.split('?')[0]}`,
              metadata: { status: response.status, url: url.split('?')[0] },
            });
          }
        }
        
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        persistError({
          type: 'network',
          message,
          stack: err instanceof Error ? err.stack : undefined,
          metadata: { url: typeof args[0] === 'string' ? args[0].split('?')[0] : '' },
        });
        throw err;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.fetch = originalFetch;
    };
  }, [persistError]);
}
