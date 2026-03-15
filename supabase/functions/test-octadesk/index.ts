import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    baseUrl: string;
    apiKeyConfigured: boolean;
    responseStatus?: number;
    responseMessage?: string;
    authMethod?: string;
    endpointTested?: string;
  };
}

interface AuthMethod {
  name: string;
  headers: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[test-octadesk] Starting connection test...');

  try {
    const OCTADESK_API_KEY = Deno.env.get("OCTADESK_API_KEY");
    const OCTADESK_BASE_URL = Deno.env.get("OCTADESK_BASE_URL");

    // Verificar se secrets estão configurados
    if (!OCTADESK_API_KEY) {
      console.error('[test-octadesk] OCTADESK_API_KEY not configured');
      const result: TestResult = {
        success: false,
        error: "OCTADESK_API_KEY não está configurada. Configure nas variáveis de ambiente.",
        details: {
          baseUrl: OCTADESK_BASE_URL || 'não configurada',
          apiKeyConfigured: false,
        }
      };
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!OCTADESK_BASE_URL) {
      console.error('[test-octadesk] OCTADESK_BASE_URL not configured');
      const result: TestResult = {
        success: false,
        error: "OCTADESK_BASE_URL não está configurada. Configure nas variáveis de ambiente.",
        details: {
          baseUrl: 'não configurada',
          apiKeyConfigured: true,
        }
      };
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[test-octadesk] Testing connection to: ${OCTADESK_BASE_URL}`);
    console.log(`[test-octadesk] API Key length: ${OCTADESK_API_KEY.length} chars`);

    // Múltiplos formatos de autenticação para testar
    const authMethods: AuthMethod[] = [
      { name: 'Bearer Token', headers: { 'Authorization': `Bearer ${OCTADESK_API_KEY}` } },
      { name: 'Direct Token', headers: { 'Authorization': OCTADESK_API_KEY } },
      { name: 'X-API-Key', headers: { 'X-API-Key': OCTADESK_API_KEY } },
      { name: 'apikey header', headers: { 'apikey': OCTADESK_API_KEY } },
      { name: 'Api-Key header', headers: { 'Api-Key': OCTADESK_API_KEY } },
      { name: 'x-apikey header', headers: { 'x-apikey': OCTADESK_API_KEY } },
    ];

    // Endpoints para testar
    const endpoints = [
      '/chat/rooms?limit=1',
      '/rooms?limit=1',
      '/api/v1/chat/rooms?limit=1',
      '/api/chat/rooms?limit=1',
      '/users/me',
      '/organization',
      '/api/v1/users/me',
    ];

    let lastError: string | null = null;
    let lastStatus: number | null = null;
    let lastResponseBody: string | null = null;

    // Testar cada combinação de método de auth + endpoint
    for (const authMethod of authMethods) {
      for (const endpoint of endpoints) {
        const url = `${OCTADESK_BASE_URL}${endpoint}`;
        console.log(`[test-octadesk] Trying: ${authMethod.name} -> ${url}`);

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              ...authMethod.headers,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          console.log(`[test-octadesk] Response status: ${response.status}`);
          lastStatus = response.status;

          // Capturar corpo da resposta para debug
          const responseText = await response.text();
          lastResponseBody = responseText;
          
          console.log(`[test-octadesk] Response body (first 500 chars): ${responseText.substring(0, 500)}`);

          if (response.ok) {
            console.log(`[test-octadesk] SUCCESS with ${authMethod.name} at ${endpoint}`);
            
            const result: TestResult = {
              success: true,
              message: "Conexão com Octadesk estabelecida com sucesso!",
              details: {
                baseUrl: OCTADESK_BASE_URL,
                apiKeyConfigured: true,
                responseStatus: response.status,
                responseMessage: 'API respondeu corretamente',
                authMethod: authMethod.name,
                endpointTested: endpoint,
              }
            };
            
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Se receber 401/403, logar e continuar tentando outros métodos
          if (response.status === 401 || response.status === 403) {
            console.log(`[test-octadesk] Auth failed for ${authMethod.name}: ${responseText.substring(0, 200)}`);
            lastError = `${authMethod.name}: Autenticação falhou`;
            // Continuar para próximo método de auth
            continue;
          }

          // Para outros erros (404, 500, etc), continuar tentando
          lastError = `${authMethod.name} -> ${endpoint}: Status ${response.status}`;
          
        } catch (fetchError) {
          console.error(`[test-octadesk] Fetch error for ${endpoint}:`, fetchError);
          lastError = fetchError instanceof Error ? fetchError.message : 'Erro de conexão';
        }
      }
    }

    // Nenhuma combinação funcionou
    console.error('[test-octadesk] All auth methods and endpoints failed');
    console.error('[test-octadesk] Last response body:', lastResponseBody?.substring(0, 1000));
    
    let errorMessage = 'Não foi possível conectar à API do Octadesk.';
    
    if (lastStatus === 401 || lastStatus === 403) {
      errorMessage = 'API Key inválida ou formato de autenticação não reconhecido. Verifique suas credenciais e o formato esperado pela API do Octadesk.';
    } else if (lastStatus === 404) {
      errorMessage = 'Nenhum endpoint válido encontrado. Verifique a Base URL da API.';
    } else if (lastError) {
      errorMessage = `Erro de conexão: ${lastError}`;
    }

    const result: TestResult = {
      success: false,
      error: errorMessage,
      details: {
        baseUrl: OCTADESK_BASE_URL,
        apiKeyConfigured: true,
        responseStatus: lastStatus || undefined,
        responseMessage: lastResponseBody?.substring(0, 200) || undefined,
      }
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[test-octadesk] Unexpected error:', error);
    
    const result: TestResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado ao testar conexão',
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
