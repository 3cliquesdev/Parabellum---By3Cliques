import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReconfigureResult {
  success: boolean;
  message?: string;
  webhookUrl?: string;
  currentConfig?: any;
  error?: string;
}

interface DiagnosticsResult {
  instanceId: string;
  instanceName: string;
  instanceStatus: string;
  overallStatus: "pass" | "warn" | "fail";
  summary: string;
  checks: Array<{
    name: string;
    status: "pass" | "warn" | "fail" | "error" | "info";
    details: Record<string, any>;
  }>;
  webhookConfig?: any;
  connectionState?: any;
}

export function useReconfigureWebhook() {
  return useMutation({
    mutationFn: async (instanceId: string): Promise<ReconfigureResult> => {
      const { data, error } = await supabase.functions.invoke('reconfigure-whatsapp-webhook', {
        body: { instance_id: instanceId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Webhook reconfigurado!", {
          description: data.message,
        });
      } else {
        toast.error("Falha ao reconfigurar webhook", {
          description: data.error,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Erro ao reconfigurar webhook", {
        description: error.message,
      });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (instanceId: string): Promise<DiagnosticsResult> => {
      const { data, error } = await supabase.functions.invoke('test-whatsapp-webhook', {
        body: { instance_id: instanceId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const statusEmoji = data.overallStatus === "pass" ? "✅" : data.overallStatus === "warn" ? "⚠️" : "❌";
      
      toast[data.overallStatus === "fail" ? "error" : data.overallStatus === "warn" ? "warning" : "success"](
        `${statusEmoji} Diagnóstico do Webhook`,
        { description: data.summary }
      );
    },
    onError: (error: Error) => {
      toast.error("Erro ao testar webhook", {
        description: error.message,
      });
    },
  });
}
