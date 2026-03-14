import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BusinessMessage {
  id: string;
  message_key: string;
  message_template: string;
  description: string | null;
  after_hours_tag_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useBusinessMessages() {
  return useQuery({
    queryKey: ["business-messages-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_messages_config")
        .select("*")
        .order("message_key");
      if (error) throw error;
      return (data || []) as BusinessMessage[];
    },
    staleTime: 60_000,
  });
}

export function useUpdateBusinessMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, message_template }: { id: string; message_template: string }) => {
      const { error } = await supabase
        .from("business_messages_config")
        .update({ message_template, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-messages-config"] });
      toast.success("Mensagem atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar mensagem: ${err.message}`);
    },
  });
}
