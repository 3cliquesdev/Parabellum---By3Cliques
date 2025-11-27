import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, messages, description, ticketSubject } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
Analise o tom e sentimento das mensagens do cliente e classifique em uma das categorias:

IMPORTANTE: Responda APENAS com uma destas palavras exatas (sem acentos):
- "critico" = cliente irritado, frustrado, negativo, insatisfeito, com raiva
- "neutro" = cliente neutro, sem emoção forte, informativo
- "promotor" = cliente satisfeito, feliz, positivo, agradecido, entusiasmado

Responda SOMENTE com uma das três palavras: critico, neutro ou promotor`;
        userPrompt = `Analise o sentimento destas mensagens do cliente:

${messages.map((m: any) => m.content).join('\n')}`;
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

    // Call AI Gateway directly - no retry logic, let client handle rate limits
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response || !response.ok) {
      if (!response) {
        throw new Error('Failed to get response from AI Gateway');
      }
      
      const errorText = await response.text();
      console.error(`[analyze-ticket] AI Gateway error:`, response.status, errorText);
      
      // GRACEFUL DEGRADATION: Return fallback values on 429 instead of failing
      if (response.status === 429) {
        console.warn(`[analyze-ticket] ⚠️ Rate limit hit, returning fallback for mode: ${mode}`);
        
        let fallbackResult = '';
        switch (mode) {
          case 'sentiment':
            fallbackResult = 'neutro'; // Safe default sentiment
            break;
          case 'summary':
            fallbackResult = 'Resumo indisponível devido a limite de requisições. Por favor, revise a conversa manualmente.';
            break;
          case 'reply':
            fallbackResult = 'Obrigado pela sua mensagem. Nossa equipe irá analisar seu caso e retornar em breve.';
            break;
          case 'tags':
            fallbackResult = ''; // Empty tags
            break;
          default:
            fallbackResult = 'Resultado não disponível';
        }
        
        return new Response(JSON.stringify({ 
          result: fallbackResult,
          mode,
          fallback: true,
          reason: 'rate_limit'
        }), {
          status: 200, // ✅ Return 200 with fallback instead of 429 error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits depleted. Please add credits to your workspace.' 
        }), {
          status: 402,
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
    console.error('[analyze-ticket] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
