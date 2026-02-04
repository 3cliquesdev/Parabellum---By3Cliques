import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role:
    | "admin"
    | "general_manager"
    | "manager"
    | "sales_rep"
    | "consultant"
    | "support_agent"
    | "support_manager"
    | "financial_manager"
    | "financial_agent"
    | "cs_manager"
    | "ecommerce_analyst";
  full_name?: string;
  job_title?: string;
  avatar_url?: string;
  is_blocked?: boolean;
  blocked_at?: string;
  block_reason?: string;
  is_archived?: boolean;
  archived_at?: string;
  availability_status?: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-users");

      // BOOT_ERROR (503) pode ocorrer de forma intermitente no cold start da função.
      // Para evitar tela em branco, tratamos como fallback seguro.
      if (error) {
        const status = (error as any)?.status;
        const message = (error as any)?.message || "";
        const isBootError = status === 503 || message.includes("BOOT_ERROR");

        if (isBootError) return [] as UserWithRole[];
        throw error;
      }

      return (data as any)?.users as UserWithRole[];
    },
    // Evita tela em branco quando a função falha intermitentemente.
    // Componentes que fazem `users.map(...)` continuam funcionando com array vazio.
    placeholderData: [] as UserWithRole[],
    retry: (failureCount, error: any) => {
      // Só faz retries agressivos para BOOT_ERROR/503; outros erros mantém baixo.
      const status = error?.status;
      const message = error?.message || "";
      const isBootError = status === 503 || String(message).includes("BOOT_ERROR");
      return isBootError ? failureCount < 5 : failureCount < 2;
    },
    retryDelay: (attempt) => {
      // Backoff com teto curto para não travar telas que dependem disso.
      const base = Math.min(750 * 2 ** attempt, 6000);
      const jitter = Math.floor(Math.random() * 250);
      return base + jitter;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 20,
  });
}
