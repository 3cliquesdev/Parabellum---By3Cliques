import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpsertContactData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company?: string;
  organization_id?: string;
  source?: 'form' | 'manual' | 'api' | 'import';
}

interface UpsertContactResponse {
  contact_id: string;
  is_new_contact: boolean;
  previous_status: string | null;
  message: string;
}

export function useUpsertContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpsertContactData): Promise<UpsertContactResponse> => {
      const { data: result, error } = await supabase.functions.invoke('upsert-contact', {
        body: data,
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error || 'Erro ao processar contato');

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["customer-timeline", result.contact_id] });

      if (result.is_new_contact) {
        toast({
          title: "✅ Novo contato criado",
          description: "Contato adicionado e interação registrada.",
        });
      } else {
        toast({
          title: "🔄 Contato atualizado",
          description: result.message,
        });
      }
    },
    onError: (error: Error) => {
      console.error('[useUpsertContact] Error:', error);
      toast({
        title: "Erro ao processar contato",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
