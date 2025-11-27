import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WhatsAppInstance {
  id: string;
  name: string;
  instance_name: string;
  api_url: string;
  api_token: string;
  phone_number: string | null;
  status: 'disconnected' | 'qr_pending' | 'connected';
  qr_code_base64: string | null;
  ai_mode: 'autopilot' | 'copilot' | 'disabled';
  department_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppInstances() {
  return useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select(`
          *,
          department:departments(id, name, color),
          user:profiles(id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWhatsAppInstance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instance: Omit<WhatsAppInstance, 'id' | 'created_at' | 'updated_at' | 'phone_number' | 'qr_code_base64' | 'status'>) => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .insert(instance)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "Instância criada",
        description: "Instância WhatsApp criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateWhatsAppInstance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppInstance> & { id: string }) => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "Instância atualizada",
        description: "Configurações atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteWhatsAppInstance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "Instância removida",
        description: "Instância WhatsApp removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useConnectWhatsAppInstance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceId: string) => {
      // Chamar Edge Function para evitar CORS
      const { data, error } = await supabase.functions.invoke('connect-whatsapp-instance', {
        body: { instance_id: instanceId }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "QR Code gerado",
        description: "Escaneie o QR Code com seu WhatsApp.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useResetWhatsAppInstance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await supabase.functions.invoke('reset-whatsapp-instance', {
        body: { instance_id: instanceId }
      });

      if (error) {
        console.error('Reset error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "🔄 Instância Resetada",
        description: "Sessão limpa. Pode criar uma nova conexão agora.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao resetar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useWhatsAppAPIStatus(apiUrl: string, apiToken: string) {
  return useQuery({
    queryKey: ["whatsapp-api-status", apiUrl],
    queryFn: async () => {
      if (!apiUrl || !apiToken) return { status: 'unknown', latency: 0 };

      let baseUrl = apiUrl;
      if (baseUrl.includes('/manager')) {
        baseUrl = baseUrl.split('/manager')[0];
      }
      baseUrl = baseUrl.replace(/\/$/, '');

      const startTime = Date.now();
      
      try {
        const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: { "apikey": apiToken.trim() },
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        const latency = Date.now() - startTime;

        if (!response.ok) {
          return { status: 'error', latency };
        }

        return { 
          status: latency > 2000 ? 'slow' : 'online', 
          latency 
        };
      } catch (error) {
        return { 
          status: 'offline', 
          latency: Date.now() - startTime 
        };
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });
}
