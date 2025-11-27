import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSyncWhatsAppInstances() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Buscar todas as instâncias existentes no banco
      const { data: localInstances, error: localError } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, api_url, api_token");

      if (localError) throw localError;

      // Para cada instância local, buscar status da API
      const syncPromises = (localInstances || []).map(async (local) => {
        try {
          // Normalizar URL base
          let baseUrl = local.api_url;
          if (baseUrl.includes('/manager')) {
            baseUrl = baseUrl.split('/manager')[0];
          }
          baseUrl = baseUrl.replace(/\/$/, '');

          // Buscar detalhes diretamente da Evolution API
          const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
            method: "GET",
            headers: {
              "apikey": local.api_token.trim(),
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            console.error(`[Sync] API error for ${local.instance_name}:`, response.status);
            return { success: false, instance_name: local.instance_name };
          }

          const apiData = await response.json();

          // Procurar a instância específica no array retornado
          const apiInstance = Array.isArray(apiData) 
            ? apiData.find((inst: any) => inst.instance?.instanceName === local.instance_name)
            : null;

          if (!apiInstance) {
            console.log(`[Sync] Instance ${local.instance_name} not found in API response`);
            return { success: false, instance_name: local.instance_name };
          }

          // Mapear status da API para nosso banco
          const apiStatus = apiInstance.instance?.state || 'close';
          const mappedStatus = apiStatus === 'open' ? 'connected' : 'disconnected';
          const phoneNumber = apiInstance.instance?.owner || null;

          // Atualizar status no banco
          const { error: updateError } = await supabase
            .from("whatsapp_instances")
            .update({
              status: mappedStatus,
              phone_number: phoneNumber,
            })
            .eq("id", local.id);

          if (updateError) {
            console.error(`[Sync] Error updating ${local.instance_name}:`, updateError);
            return { success: false, instance_name: local.instance_name };
          }

          console.log(`[Sync] ✅ Updated ${local.instance_name}: ${mappedStatus}`);
          return { success: true, instance_name: local.instance_name, status: mappedStatus };
        } catch (err) {
          console.error(`[Sync] Exception for ${local.instance_name}:`, err);
          return { success: false, instance_name: local.instance_name };
        }
      });

      const results = await Promise.all(syncPromises);
      const successCount = results.filter((r) => r.success).length;
      const totalCount = results.length;

      return { successCount, totalCount, results };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "✅ Sincronização concluída",
        description: `${data.successCount} de ${data.totalCount} instâncias atualizadas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
