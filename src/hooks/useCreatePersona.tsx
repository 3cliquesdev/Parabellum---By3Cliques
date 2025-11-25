import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCreatePersona = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      role: string;
      system_prompt: string;
      temperature?: number;
      max_tokens?: number;
      knowledge_base_paths?: string[];
      is_active?: boolean;
    }) => {
      const { data: persona, error } = await supabase
        .from("ai_personas")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return persona;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-personas"] });
      toast({
        title: "Persona criada",
        description: "A persona foi criada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar persona",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
