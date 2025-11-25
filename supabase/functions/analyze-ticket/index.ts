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
        systemPrompt = 'Você é um especialista em análise de sentimento. Analise o tom emocional das mensagens e classifique como "critico", "neutro" ou "promotor".';
        userPrompt = `Analise o sentimento destas mensagens do cliente:

${messages.map((m: any) => m.content).join('\n')}

Responda apenas com uma das palavras: critico, neutro ou promotor`;
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

    // Retry logic with exponential backoff for rate limiting
    let retries = 0;
    const maxRetries = 3;
    let response: Response | null = null;
    
    while (retries <= maxRetries) {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

      // If not rate limited or max retries reached, break
      if (response.status !== 429 || retries === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retries) * 1000;
      console.log(`[analyze-ticket] Rate limited, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }

    if (!response || !response.ok) {
      if (!response) {
        throw new Error('Failed to get response from AI Gateway');
      }
      
      const errorText = await response.text();
      console.error(`[analyze-ticket] AI Gateway error:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
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
