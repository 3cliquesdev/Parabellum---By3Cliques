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
      // Debug completo para RLS
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('=== DEBUG RLS CREATE PERSONA ===');
      console.log('User ID:', user?.id);
      console.log('User Email:', user?.email);
      console.log('Session Token:', session?.access_token ? 'PRESENTE' : 'AUSENTE');
      
      // Testar has_role diretamente
      const { data: hasRoleAdmin, error: roleError } = await supabase.rpc('has_role', { 
        _user_id: user?.id, 
        _role: 'admin' 
      });
      console.log('has_role(admin) result:', hasRoleAdmin);
      console.log('has_role error:', roleError);

      const { data: persona, error } = await supabase
        .from("ai_personas")
        .insert(data)
        .select()
        .single();

      console.log('Insert error:', error);
      console.log('Insert error details:', JSON.stringify(error, null, 2));

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
