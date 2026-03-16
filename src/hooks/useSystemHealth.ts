import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthData {
  totalErrors24h: number;
  errorsByType: Record<string, number>;
  errorsPerHour: number;
  topErrors: Array<{ message: string; count: number; type: string }>;
  edgeFunctionFailures: Array<{ url: string; count: number }>;
  healthStatus: 'green' | 'yellow' | 'red';
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemHealthData> => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Fetch errors from last 24h
      const { data: errors, error } = await supabase
        .from('client_error_logs')
        .select('error_type, message, created_at, metadata')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const allErrors = errors || [];
      const totalErrors24h = allErrors.length;

      // Errors by type
      const errorsByType: Record<string, number> = {};
      allErrors.forEach(e => {
        errorsByType[e.error_type] = (errorsByType[e.error_type] || 0) + 1;
      });

      // Errors in last hour
      const errorsLastHour = allErrors.filter(e => e.created_at >= since1h);
      const errorsPerHour = errorsLastHour.length;

      // Top errors (grouped by message prefix)
      const msgCounts: Record<string, { count: number; type: string }> = {};
      allErrors.forEach(e => {
        const key = e.message.slice(0, 100);
        if (!msgCounts[key]) msgCounts[key] = { count: 0, type: e.error_type };
        msgCounts[key].count++;
      });
      const topErrors = Object.entries(msgCounts)
        .map(([message, { count, type }]) => ({ message, count, type }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Edge function failures
      const efErrors = allErrors.filter(e => e.error_type === 'edge_function');
      const efCounts: Record<string, number> = {};
      efErrors.forEach(e => {
        const url = (e.metadata as Record<string, unknown>)?.url as string || e.message;
        const shortUrl = url.replace(/.*\/functions\/v1\//, '');
        efCounts[shortUrl] = (efCounts[shortUrl] || 0) + 1;
      });
      const edgeFunctionFailures = Object.entries(efCounts)
        .map(([url, count]) => ({ url, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Health status (semaphore)
      let healthStatus: 'green' | 'yellow' | 'red' = 'green';
      if (errorsPerHour > 20) healthStatus = 'red';
      else if (errorsPerHour > 5) healthStatus = 'yellow';

      return {
        totalErrors24h,
        errorsByType,
        errorsPerHour,
        topErrors,
        edgeFunctionFailures,
        healthStatus,
      };
    },
    refetchInterval: 60_000, // Refresh every minute
    staleTime: 30_000,
  });
}
