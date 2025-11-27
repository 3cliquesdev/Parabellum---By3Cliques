import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface TestConnectionParams {
  api_url: string;
  api_token: string;
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
    mutationFn: async ({ api_url, api_token }: TestConnectionParams): Promise<TestResult> => {
      let baseUrl = api_url;
      if (baseUrl.includes('/manager')) {
        baseUrl = baseUrl.split('/manager')[0];
      }
      baseUrl = baseUrl.replace(/\/$/, '');

      const testUrl = `${baseUrl}/instance/fetchInstances`;
      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(testUrl, {
          method: "GET",
          headers: {
            "apikey": api_token.trim(),
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (response.ok) {
          return {
            success: true,
            status: response.status,
            latency,
          };
        }

        // Erro HTTP específico
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            status: response.status,
            latency,
            errorType: 'auth',
            errorMessage: 'Token de API inválido ou sem permissão',
            technicalDetails: `HTTP ${response.status}: Chave de API rejeitada pelo servidor`,
          };
        }

        if (response.status === 404) {
          return {
            success: false,
            status: response.status,
            latency,
            errorType: 'not_found',
            errorMessage: 'Endpoint não encontrado',
            technicalDetails: `HTTP 404: A URL ${testUrl} não existe na Evolution API`,
          };
        }

        return {
          success: false,
          status: response.status,
          latency,
          errorType: 'network',
          errorMessage: `Erro HTTP ${response.status}`,
          technicalDetails: await response.text(),
        };
      } catch (error: any) {
        const latency = Date.now() - startTime;

        // Timeout
        if (error.name === 'AbortError') {
          return {
            success: false,
            latency,
            errorType: 'timeout',
            errorMessage: 'Tempo limite de conexão excedido (>10s)',
            technicalDetails: 'A API não respondeu dentro de 10 segundos. Servidor pode estar offline ou com alta latência.',
          };
        }

        // Failed to fetch = CORS ou Mixed Content
        if (error.message.includes('Failed to fetch')) {
          const isMixedContent = window.location.protocol === 'https:' && baseUrl.startsWith('http:');
          
          return {
            success: false,
            latency,
            errorType: isMixedContent ? 'mixed_content' : 'cors',
            errorMessage: isMixedContent 
              ? 'Bloqueio de Mixed Content (HTTPS → HTTP)'
              : 'Bloqueio de CORS',
            technicalDetails: isMixedContent
              ? `Seu app está em HTTPS mas a API está em HTTP (${baseUrl}). Navegadores bloqueiam isso. Solução: Adicione SSL (HTTPS) na sua Evolution API.`
              : `A API não permite requisições deste domínio. Configure CORS_ORIGIN=* no .env da Evolution API e reinicie.`,
          };
        }

        return {
          success: false,
          latency,
          errorType: 'network',
          errorMessage: 'Erro de rede desconhecido',
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
