import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WhatsAppMetaInstance {
  id: string;
  name: string;
  phone_number: string;
  phone_number_id: string;
  business_account_id: string;
  access_token: string;
  verify_token: string;
  app_secret: string | null;
  status: string;
  webhook_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticResult {
  instance: {
    id: string;
    phone_number_id: string;
    stored_waba_id: string;
  };
  phone_number: {
    id: string;
    display: string;
    verified_name: string;
    actual_waba_id: string;
  } | null;
  waba: {
    id: string;
    name: string;
  } | null;
  subscribed_apps: Array<{
    id: string;
    name: string;
    link: string;
  }>;
  issues: string[];
  fix_needed: boolean;
  correct_waba_id: string | null;
  token_valid: boolean;
}

export function useWhatsAppMetaInstances() {
  return useQuery({
    queryKey: ["whatsapp-meta-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_meta_instances")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WhatsAppMetaInstance[];
    },
    staleTime: 30000,
  });
}

export function useUpdateWhatsAppMetaToken() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instanceId, accessToken }: { instanceId: string; accessToken: string }) => {
      const { data, error } = await supabase
        .from("whatsapp_meta_instances")
        .update({ 
          access_token: accessToken,
          updated_at: new Date().toISOString()
        })
        .eq("id", instanceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-instances"] });
      toast({
        title: "✅ Token atualizado",
        description: "O access token foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar token",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDiagnoseMetaInstance() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (instanceId: string): Promise<DiagnosticResult> => {
      const { data, error } = await supabase.functions.invoke('diagnose-meta-whatsapp', {
        body: { instance_id: instanceId }
      });

      if (error) throw error;
      return data as DiagnosticResult;
    },
    onError: (error: any) => {
      toast({
        title: "Erro no diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
