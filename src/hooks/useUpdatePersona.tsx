import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useUpdatePersona = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        role?: string;
        system_prompt?: string;
        temperature?: number;
        max_tokens?: number;
        knowledge_base_paths?: string[] | null;
        is_active?: boolean;
        use_priority_instructions?: boolean;
      };
    }) => {
      console.log('[useUpdatePersona] Updating persona:', id, data);
      
      const { data: persona, error } = await supabase
        .from("ai_personas")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error('[useUpdatePersona] Error:', error);
        throw error;
      }
      
      console.log('[useUpdatePersona] Success:', persona);
      return persona;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-personas"] });
      toast({
        title: "Persona atualizada",
        description: "A persona foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      console.error('[useUpdatePersona] onError:', error);
      toast({
        title: "Erro ao atualizar persona",
        description: error.message || "Erro desconhecido. Verifique as permissões RLS.",
        variant: "destructive",
      });
    },
  });
};
