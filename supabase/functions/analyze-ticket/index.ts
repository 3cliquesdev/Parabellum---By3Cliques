import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper: Buscar modelo AI configurado no banco
// Modelo padrão OpenAI
const DEFAULT_MODEL = 'gpt-4o-mini';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, messages, description, ticketSubject } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const aiModel = DEFAULT_MODEL;
    console.log(`[analyze-ticket] Using AI model: ${aiModel}`);

    let systemPrompt = '';
    let userPrompt = '';

    // Define prompts based on mode
    switch (mode) {
      case 'summary':
        systemPrompt = 'Você é um assistente especializado em resumir conversas de suporte. Analise as mensagens e extraia o problema principal de forma concisa e técnica.';
        userPrompt = `Resuma esta conversa de suporte em 3 tópicos curtos e sugira uma categoria (financeiro, tecnico, bug, ou outro).

Mensagens:
${messages.map((m: any) => `${m.sender_type === 'contact' ? 'Cliente' : 'Atendente'}: ${m.content}`).join('\n')}

Formato de resposta:
Resumo:
- [ponto 1]
- [ponto 2]
- [ponto 3]

Categoria sugerida: [categoria]`;
        break;

      case 'sentiment':
        systemPrompt = `Você é um analisador de sentimento especializado em atendimento ao cliente.
Sua tarefa é classificar o SENTIMENTO PREDOMINANTE do cliente com base no conjunto de mensagens.

REGRAS DE CLASSIFICAÇÃO:
1. Analise o TOM GERAL da conversa, não mensagens isoladas.
2. Mensagens curtas como "Ok", "Sim", "1", "2" NÃO são neutras por padrão — avalie pelo contexto.
3. Se o cliente expressa frustração, reclamação, insatisfação, urgência negativa, ou usa tom agressivo → "critico"
4. Se o cliente expressa gratidão, elogios, satisfação, ou tom positivo → "promotor"  
5. SOMENTE classifique como "neutro" se o cliente é genuinamente informativo sem emoção detectável.
6. Na DÚVIDA entre neutro e critico, prefira "critico" (é mais seguro escalar).
7. Na DÚVIDA entre neutro e promotor, prefira "promotor".

EXEMPLOS:
- "Já é a terceira vez que peço isso" → critico
- "Não funciona, preciso resolver urgente" → critico  
- "Obrigado, resolvido!" → promotor
- "Vocês são ótimos" → promotor
- "Quero saber o status do pedido 123" → neutro
- "Ok" (após resolução positiva) → promotor
- "Ok" (após reclamação sem solução) → critico

RESPONDA APENAS com uma palavra: critico, neutro ou promotor`;
        userPrompt = `Analise o sentimento predominante destas mensagens do cliente:

${messages.map((m: any) => `${m.sender_type === 'contact' ? 'Cliente' : 'Atendente'}: ${m.content}`).join('\n')}`;
        break;

      case 'reply':
        systemPrompt = 'Você é um atendente de suporte experiente. Crie respostas empáticas, técnicas e profissionais para problemas de clientes.';
        userPrompt = `Problema do cliente:
${description}

Assunto: ${ticketSubject}

Crie uma resposta profissional e empática que:
1. Reconheça o problema
2. Explique os próximos passos
3. Ofereça uma solução ou timeline
4. Seja cordial mas técnica

Responda diretamente sem saudação inicial (o atendente vai personalizar).`;
        break;

      case 'tags':
        systemPrompt = 'Você é um sistema de classificação automática. Analise o problema e atribua tags relevantes.';
        userPrompt = `Analise este ticket e sugira 2-3 tags apropriadas:

Assunto: ${ticketSubject}
Descrição: ${description}

Tags possíveis: Logística, Reembolso, Bug, Integração, Pagamento, Configuração, Treinamento, Urgente, Técnico, Financeiro

Responda apenas com as tags separadas por vírgula (ex: Bug, Técnico, Urgente)`;
        break;

      default:
        throw new Error(`Invalid mode: ${mode}`);
    }

    console.log(`[analyze-ticket] Mode: ${mode}, Processing request`);

    // Helper: Fetch with timeout
    const fetchWithTimeout = (url: string, options: RequestInit, timeout = 60000) => {
      return Promise.race([
        fetch(url, options),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 60s')), timeout)
        )
      ]);
    };

    // Call OpenAI with timeout protection
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response || !response.ok) {
      if (!response) {
        throw new Error('Failed to get response from OpenAI');
      }
      
      const errorText = await response.text();
      console.error(`[analyze-ticket] OpenAI API error: ${response.status}`, errorText);
      
      // GRACEFUL DEGRADATION: Return fallback values for known errors (including 402 payment required, 500 server error)
      if (response.status === 429 || response.status === 503 || response.status === 502 || response.status === 402 || response.status === 500) {
        const errorReason = response.status === 429 ? 'rate_limit' : 
                           response.status === 503 ? 'service_unavailable' :
                           response.status === 502 ? 'bad_gateway' : 
                            response.status === 402 ? 'payment_error' :
                            response.status === 500 ? 'server_error' : 'unknown';
        
        console.warn(`[analyze-ticket] ⚠️ OpenAI API error ${response.status}, returning fallback for mode: ${mode}`);
        
        let fallbackResult = '';
        let fallbackMessage = '';
        
        switch (mode) {
          case 'sentiment':
            fallbackResult = 'neutro'; // Safe default sentiment
            fallbackMessage = response.status === 402 
              ? 'Erro de billing na API OpenAI. Verifique sua conta.' 
              : 'Análise de sentimento indisponível';
            break;
          case 'summary':
            fallbackResult = 'Resumo indisponível temporariamente. Por favor, revise a conversa manualmente.';
            fallbackMessage = response.status === 402 
              ? 'Erro de billing na API OpenAI. Verifique sua conta.' 
              : 'Sistema de resumo temporariamente indisponível';
            break;
          case 'reply':
            fallbackResult = 'Obrigado pela sua mensagem. Nossa equipe irá analisar seu caso e retornar em breve.';
            fallbackMessage = response.status === 402 
              ? 'Erro de billing na API OpenAI. Verifique sua conta.' 
              : 'Sugestão de resposta temporariamente indisponível';
            break;
          case 'tags':
            fallbackResult = ''; // Empty tags
            fallbackMessage = response.status === 402 
              ? 'Erro de billing na API OpenAI. Verifique sua conta.' 
              : 'Sistema de tags temporariamente indisponível';
            break;
          default:
            fallbackResult = 'Resultado não disponível';
            fallbackMessage = response.status === 402 
              ? 'Erro de billing na API OpenAI. Verifique sua conta.' 
              : 'Serviço temporariamente indisponível';
        }
        
        return new Response(JSON.stringify({ 
          result: fallbackResult,
          mode,
          fallback: true,
          reason: errorReason,
          message: fallbackMessage
        }), {
          status: 200, // ✅ Return 200 with fallback instead of error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log(`[analyze-ticket] Success for mode: ${mode}`);

    return new Response(JSON.stringify({ 
      result: content,
      mode 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-ticket] Critical Error:', error);
    
    // Graceful degradation even for critical errors (timeout, network failure, etc.)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      fallback: true,
      reason: 'critical_error',
      message: 'Serviço de IA temporariamente indisponível. Tente novamente em alguns instantes.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
