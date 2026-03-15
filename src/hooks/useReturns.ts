import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdminReturn {
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
  contacts: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

export function useAdminReturns(statusFilter?: string) {
  return useQuery({
    queryKey: ["admin-returns", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("returns")
        .select("*, contacts(first_name, last_name, email)")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdminReturn[];
    },
  });
}

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("returns")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      toast({ title: "✅ Status atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

export function useCreateAdminReturn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      external_order_id: string;
      tracking_code_return?: string;
      reason: string;
      description?: string;
      status?: string;
    }) => {
      const { error } = await supabase.from("returns").insert({
        external_order_id: data.external_order_id,
        tracking_code_return: data.tracking_code_return || null,
        reason: data.reason,
        description: data.description || null,
        status: data.status || "pending",
        created_by: "admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      toast({ title: "✅ Devolução criada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });
}
