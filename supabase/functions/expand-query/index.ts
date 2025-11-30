import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'query é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('Nenhuma API key configurada (OPENAI_API_KEY ou LOVABLE_API_KEY)');
    }

    console.log('[expand-query] Expandindo query:', query);

    // Usar OpenAI ou Lovable como fallback
    let expansions: string[] = [];
    
    if (OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a query expansion assistant. Given a user question, generate 2-3 alternative phrasings or related questions that might help find relevant answers. Return ONLY a JSON array of strings, no other text.'
              },
              {
                role: 'user',
                content: `Expand this query: "${query}"`
              }
            ],
            temperature: 0.7,
            max_tokens: 200,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0].message.content.trim();
          
          // Parse JSON array from response
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              expansions = parsed;
              console.log('[expand-query] ✅ OpenAI expansions:', expansions);
            }
          } catch {
            // If not valid JSON, split by newlines and filter
            expansions = content
              .split('\n')
              .map((line: string) => line.trim().replace(/^[-•*]\s*/, '').replace(/^["']|["']$/g, ''))
              .filter((line: string) => line && line !== query);
            console.log('[expand-query] ✅ OpenAI expansions (parsed):', expansions);
          }
        } else {
          console.error('[expand-query] OpenAI error:', response.status);
        }
      } catch (error) {
        console.error('[expand-query] OpenAI failed:', error);
      }
    }

    // Fallback to Lovable AI if OpenAI failed
    if (expansions.length === 0 && LOVABLE_API_KEY) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a query expansion assistant. Given a user question, generate 2-3 alternative phrasings or related questions that might help find relevant answers. Return ONLY a JSON array of strings, no other text.'
              },
              {
                role: 'user',
                content: `Expand this query: "${query}"`
              }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0].message.content.trim();
          
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              expansions = parsed;
              console.log('[expand-query] ✅ Lovable AI expansions:', expansions);
            }
          } catch {
            expansions = content
              .split('\n')
              .map((line: string) => line.trim().replace(/^[-•*]\s*/, '').replace(/^["']|["']$/g, ''))
              .filter((line: string) => line && line !== query);
            console.log('[expand-query] ✅ Lovable AI expansions (parsed):', expansions);
          }
        } else {
          console.error('[expand-query] Lovable AI error:', response.status);
        }
      } catch (error) {
        console.error('[expand-query] Lovable AI failed:', error);
      }
    }

    // Se ainda não temos expansões, retornar array vazio
    if (expansions.length === 0) {
      console.log('[expand-query] ⚠️ No expansions generated, using original query only');
      expansions = [];
    }

    return new Response(
      JSON.stringify({ 
        original_query: query,
        expanded_queries: expansions,
        total_queries: 1 + expansions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[expand-query] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
