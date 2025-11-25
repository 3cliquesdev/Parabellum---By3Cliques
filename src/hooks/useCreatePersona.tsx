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
      // DEBUG: Verificar autenticação
      const { data: { user } } = await supabase.auth.getUser();
      console.log("🔐 [DEBUG] User creating persona:", {
        user_id: user?.id,
        email: user?.email,
        metadata: user?.user_metadata
      });

      // DEBUG: Verificar role do usuário
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .single();
      
      console.log("👤 [DEBUG] User role check:", {
        role: userRole?.role,
        error: roleError?.message
      });

      // DEBUG: Verificar se has_role funciona
      const { data: hasRoleResult, error: hasRoleError } = await supabase
        .rpc("has_role", { _user_id: user?.id, _role: "admin" });
      
      console.log("✅ [DEBUG] has_role function result:", {
        hasRole: hasRoleResult,
        error: hasRoleError?.message
      });

      console.log("📝 [DEBUG] Attempting to insert persona:", data);

      const { data: persona, error } = await supabase
        .from("ai_personas")
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error("❌ [DEBUG] Insert error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      console.log("✅ [DEBUG] Persona created successfully:", persona);
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
