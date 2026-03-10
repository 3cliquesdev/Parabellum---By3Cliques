import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useOrganizationPhones(orgId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const phonesQuery = useQuery({
    queryKey: ["organization-phones", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_phones")
        .select("id, label, phone, created_at")
        .eq("organization_id", orgId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const addPhone = useMutation({
    mutationFn: async ({ label, phone }: { label: string; phone: string }) => {
      const { error } = await supabase
        .from("organization_phones")
        .insert({ organization_id: orgId!, label, phone });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-phones", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "Telefone adicionado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar telefone", description: err.message, variant: "destructive" });
    },
  });

  const removePhone = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase
        .from("organization_phones")
        .delete()
        .eq("id", phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-phones", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "Telefone removido" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover telefone", description: err.message, variant: "destructive" });
    },
  });

  return { phones: phonesQuery, addPhone, removePhone };
}
