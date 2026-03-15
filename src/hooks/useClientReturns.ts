import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ClientReturn {
  id: string;
  contact_id: string | null;
  external_order_id: string;
  tracking_code_original: string | null;
  tracking_code_return: string | null;
  reason: string;
  description: string | null;
  status: string;
  created_by: string;
  registered_email: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientReturns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-returns", user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ClientReturn[];
    },
    enabled: !!user,
  });
}

interface RegisterReturnData {
  email: string;
  external_order_id: string;
  tracking_code_return?: string;
  reason: string;
  description?: string;
}

export function useRegisterReturn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RegisterReturnData) => {
      const { data: result, error } = await supabase.functions.invoke("register-return", {
        body: data,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-returns"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar devolução",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useLinkReturn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { return_id: string; email: string }) => {
      const { data: result, error } = await supabase.functions.invoke("link-return", {
        body: data,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-returns"] });
      toast({
        title: "✅ Devolução vinculada",
        description: "A devolução foi vinculada ao seu perfil com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao vincular devolução",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export const REASON_LABELS: Record<string, string> = {
  defeito: "Defeito no produto",
  arrependimento: "Arrependimento",
  troca: "Troca",
  nao_recebido: "Não recebi",
  outro: "Outro",
};

export const STATUS_CONFIG: Record<string, { label: string; variant: "warning" | "success" | "destructive" | "info" }> = {
  pending: { label: "Pendente", variant: "warning" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  refunded: { label: "Reembolsada", variant: "info" },
};
