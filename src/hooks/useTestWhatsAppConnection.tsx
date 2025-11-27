import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TestConnectionParams {
  instance_id: string;
}

interface TestResult {
  success: boolean;
  status?: number;
  latency: number;
  errorType?: 'cors' | 'mixed_content' | 'auth' | 'not_found' | 'network' | 'timeout';
  errorMessage?: string;
  technicalDetails?: string;
}

export function useTestWhatsAppConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instance_id }: TestConnectionParams): Promise<TestResult> => {
      const startTime = Date.now();

      try {
        // Usar proxy server-side para evitar CORS e Mixed Content
        const { data: result, error } = await supabase.functions.invoke('whatsapp-proxy', {
          body: {
            instance_id,
            endpoint: '/instance/fetchInstances',
            method: 'GET',
          }
        });

        const latency = Date.now() - startTime;

        if (error) {
          console.error('[useTestWhatsAppConnection] Proxy error:', error);
          
          // Erro de autenticação (token inválido)
          if (error.message.includes('401') || error.message.includes('403')) {
            return {
              success: false,
              latency,
              errorType: 'auth',
              errorMessage: 'Token de API inválido ou sem permissão',
              technicalDetails: error.message,
            };
          }

          // Erro 404 (endpoint não encontrado)
          if (error.message.includes('404')) {
            return {
              success: false,
              latency,
              errorType: 'not_found',
              errorMessage: 'Endpoint não encontrado',
              technicalDetails: error.message,
            };
          }

          // Timeout ou erro de rede
          if (error.message.includes('timeout') || error.message.includes('fetch')) {
            return {
              success: false,
              latency,
              errorType: 'timeout',
              errorMessage: 'Timeout: A API não respondeu',
              technicalDetails: error.message,
            };
          }

          // Erro genérico
          return {
            success: false,
            latency,
            errorType: 'network',
            errorMessage: 'Erro de Conexão',
            technicalDetails: error.message,
          };
        }

        // Sucesso
        return {
          success: true,
          status: 200,
          latency,
        };
      } catch (error: any) {
        const latency = Date.now() - startTime;
        console.error('[useTestWhatsAppConnection] Error:', error);
        
        return {
          success: false,
          latency,
          errorType: 'network',
          errorMessage: 'Erro desconhecido',
          technicalDetails: error.message,
        };
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "✅ Conexão OK",
          description: `API respondeu em ${result.latency}ms`,
        });
      }
    },
  });
}
