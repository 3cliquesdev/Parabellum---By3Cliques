import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnowledgeRow {
  input: string;
  output: string;
  category?: string;
  tags?: string;
}

interface DocumentRequest {
  text: string;
  fileName: string;
  category: string;
  tags: string[];
  mode: 'full_document' | 'split_sections';
  source: string;
}

type ProcessRequest = 
  | { rows: KnowledgeRow[]; mode: 'raw_history' | 'ready_faq'; source: string; }
  | DocumentRequest;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const body = await req.json();
    
    // Check if it's a document import or CSV import
    if ('text' in body) {
      // Document import
      return await handleDocumentImport(body, supabaseClient);
    } else {
      // CSV import
      return await handleCsvImport(body, supabaseClient);
    }
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleCsvImport(request: any, supabaseClient: any) {
  const { rows, mode, source } = request;
    
    const result = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Skip empty rows
      if (!row.input || !row.output) {
        result.skipped++;
        continue;
      }

      try {
        let title = '';
        let content = '';

        if (mode === 'raw_history') {
          // Use AI to clean and extract
          const dialog = `${row.input}\n\n${row.output}`;
          
          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  content: `Você é um especialista em extrair conhecimento de conversas de suporte.

Dado o seguinte diálogo entre cliente e atendente, extraia:
1. O PROBLEMA/PERGUNTA central do cliente (resumido em 1 frase)
2. A SOLUÇÃO/RESPOSTA técnica (passo a passo se aplicável)

Remova:
- Cumprimentos ("bom dia", "oi", "obrigado")
- Frases genéricas ("aguarde um momento", "vou verificar")
- Informações pessoais

Retorne APENAS um JSON válido:
{
  "title": "Título conciso do problema",
  "content": "Solução detalhada e técnica"
}`
                },
                {
                  role: 'user',
                  content: dialog
                }
              ],
              response_format: { type: "json_object" }
            }),
          });

          if (!aiResponse.ok) {
            throw new Error(`AI API error: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          const parsed = JSON.parse(aiData.choices[0].message.content);
          title = parsed.title || row.input.substring(0, 100);
          content = parsed.content || row.output;
        } else {
          // FAQ Pronto mode - direct import
          title = row.input.substring(0, 100);
          content = `Pergunta: ${row.input}\n\nResposta: ${row.output}`;
        }

        // Parse tags if present
        let tagsArray: string[] = ['importado', source];
        if (row.tags) {
          const additionalTags = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          tagsArray = [...tagsArray, ...additionalTags];
        }

        // Insert into knowledge_articles
        const { error: insertError } = await supabaseClient
          .from('knowledge_articles')
          .insert({
            title,
            content,
            category: row.category || 'Importado',
            tags: tagsArray,
            is_published: true,
          });

        if (insertError) {
          result.errors.push({
            row: i + 1,
            error: insertError.message,
          });
        } else {
          result.created++;
        }

      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
        result.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

async function handleDocumentImport(request: DocumentRequest, supabaseClient: any) {
  const { text, fileName, category, tags, mode } = request;
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  const result = {
    created: 0,
    skipped: 0,
    errors: [] as Array<{ row: number; error: string }>,
  };

  try {
    if (mode === 'full_document') {
      // Create a single article from the entire document
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em organizar conhecimento técnico.

Dado o texto de um documento, extraia:
1. Um TÍTULO conciso e descritivo (máximo 100 caracteres)
2. O CONTEÚDO completo organizado de forma clara

Retorne APENAS um JSON válido:
{
  "title": "Título do documento",
  "content": "Conteúdo organizado em markdown"
}`
            },
            {
              role: 'user',
              content: `Documento: ${fileName}\n\n${text}`
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const parsed = JSON.parse(aiData.choices[0].message.content);
      
      const { error: insertError } = await supabaseClient
        .from('knowledge_articles')
        .insert({
          title: parsed.title || fileName,
          content: parsed.content,
          category: category,
          tags: ['importado', 'documento', ...tags],
          is_published: true,
        });

      if (insertError) {
        result.errors.push({ row: 1, error: insertError.message });
      } else {
        result.created++;
      }
    } else {
      // Split document into sections
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em dividir documentos em seções temáticas.

Analise o documento e divida-o em seções lógicas (máximo 10 seções).
Para cada seção, crie:
1. Um TÍTULO específico e descritivo
2. O CONTEÚDO da seção

Retorne APENAS um JSON válido:
{
  "sections": [
    {
      "title": "Título da seção",
      "content": "Conteúdo da seção em markdown"
    }
  ]
}`
            },
            {
              role: 'user',
              content: `Documento: ${fileName}\n\n${text}`
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const parsed = JSON.parse(aiData.choices[0].message.content);
      
      for (let i = 0; i < parsed.sections.length; i++) {
        const section = parsed.sections[i];
        
        const { error: insertError } = await supabaseClient
          .from('knowledge_articles')
          .insert({
            title: section.title,
            content: section.content,
            category: category,
            tags: ['importado', 'documento', fileName, ...tags],
            is_published: true,
          });

        if (insertError) {
          result.errors.push({ row: i + 1, error: insertError.message });
        } else {
          result.created++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('Error processing document:', error);
    result.errors.push({
      row: 1,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
