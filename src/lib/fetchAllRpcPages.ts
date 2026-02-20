import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PAGE_SIZE = 1000;
const SAFETY_LIMIT = 50000;

interface FetchAllOptions {
  /** RPC function name */
  rpcName: string;
  /** Parameters to pass (without p_limit/p_offset) */
  params: Record<string, any>;
  /** Show progress toasts (default true) */
  showProgress?: boolean;
}

/**
 * Fetches ALL rows from a Supabase RPC that supports p_limit/p_offset,
 * paginating automatically in batches of 2 000.
 *
 * The RPC must return rows that include a `total_count` field (bigint)
 * so we can show progress and know when to stop.
 */
export async function fetchAllRpcPages<T = any>(
  options: FetchAllOptions
): Promise<T[]> {
  const { rpcName, params, showProgress = true } = options;
  let allRows: T[] = [];
  let offset = 0;
  let totalCount: number | null = null;
  let toastId: string | number | undefined;

  while (true) {
    const { data, error } = await supabase.rpc(rpcName as any, {
      ...params,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    } as any);

    if (error) throw error;

    const rows = (data as T[]) || [];
    if (rows.length === 0) break;

    allRows = allRows.concat(rows);

    // Extract total_count from first row of first page
    if (totalCount === null) {
      totalCount = Number((rows[0] as any)?.total_count) || null;
    }

    // Progress feedback
    if (showProgress && totalCount && totalCount > PAGE_SIZE) {
      const msg = `Buscando dados... ${allRows.length.toLocaleString("pt-BR")} de ~${totalCount.toLocaleString("pt-BR")}`;
      if (toastId) {
        toast.loading(msg, { id: toastId });
      } else {
        toastId = toast.loading(msg);
      }
    }

    // Stop if we got fewer rows than page size (last page)
    if (rows.length < PAGE_SIZE) break;

    // Safety limit
    if (allRows.length >= SAFETY_LIMIT) break;

    offset += PAGE_SIZE;
  }

  // Dismiss progress toast
  if (toastId) {
    toast.dismiss(toastId);
  }

  return allRows;
}
