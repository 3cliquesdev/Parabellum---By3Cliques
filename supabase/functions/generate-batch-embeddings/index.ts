import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for pseudo-embedding generation
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Generate pseudo-embedding from keywords (1536 dimensions for OpenAI compatibility)
function generatePseudoEmbedding(keywords: string[]): number[] {
  const embedding = new Array(1536).fill(0);
  keywords.forEach((keyword) => {
    const hash = simpleHash(keyword.toLowerCase());
    for (let j = 0; j < 50; j++) {
      const idx = (hash + j * 31) % 1536;
      embedding[idx] = Math.sin(hash * (j + 1)) * 0.5;
    }
  });
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
  return embedding.map(x => x / (norm || 1));
}

// Extract keywords from text using OpenAI
async function extractKeywordsWithOpenAI(text: string, openaiApiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [
          { 
            role: 'system', 
            content: 'Extraia 20 palavras-chave do texto fornecido. Responda APENAS com JSON válido no formato: {"keywords": ["palavra1", "palavra2", ...]}. Sem explicações.' 
          },
          { role: 'user', content: text.substring(0, 2000) }
        ],
        max_completion_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('[extractKeywords] OpenAI error:', await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*"keywords"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.keywords || [];
    }
    
    return [];
  } catch (error) {
    console.error('[extractKeywords] Error:', error);
    return [];
  }
}

// Generate embedding with OpenAI or fallback to Lovable AI
async function generateEmbedding(
  text: string, 
  openaiApiKey: string | undefined
): Promise<number[] | null> {
  // Try OpenAI first (native embeddings - best quality)
  if (openaiApiKey) {
    try {
      console.log('[generateEmbedding] Attempting OpenAI embedding...');
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[generateEmbedding] ✅ OpenAI embedding generated successfully');
        return data.data[0].embedding;
      } else {
        console.warn('[generateEmbedding] OpenAI failed, status:', response.status);
      }
    } catch (error) {
      console.warn('[generateEmbedding] OpenAI exception:', error);
    }
  }

  // Fallback: keyword-based pseudo-embedding using OpenAI
  if (openaiApiKey) {
    console.log('[generateEmbedding] Using keyword-based fallback...');
    const keywords = await extractKeywordsWithOpenAI(text, openaiApiKey);
    
    if (keywords.length > 0) {
      console.log(`[generateEmbedding] ✅ Generated pseudo-embedding from ${keywords.length} keywords`);
      return generatePseudoEmbedding(keywords);
    } else {
      // Ultimate fallback: extract keywords manually from text
      console.log('[generateEmbedding] ⚠️ Keyword extraction failed, using text-based fallback');
      const words = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 20);
      
      if (words.length > 0) {
        return generatePseudoEmbedding(words);
      }
    }
  }

  console.error('[generateEmbedding] ❌ No embedding provider available');
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-batch-embeddings] Starting batch embedding generation');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API keys
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // Check if provider is available
    if (!OPENAI_API_KEY) {
      console.error('[generate-batch-embeddings] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'OPENAI_API_KEY not configured.',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-batch-embeddings] Provider: OpenAI');

    // Fetch all articles without embeddings
    const { data: articles, error: fetchError } = await supabase
      .from('knowledge_articles')
      .select('id, title, content')
      .is('embedding', null)
      .eq('is_published', true);

    if (fetchError) {
      console.error('[generate-batch-embeddings] Error fetching articles:', fetchError);
      throw fetchError;
    }

    if (!articles || articles.length === 0) {
      console.log('[generate-batch-embeddings] No articles need embeddings');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No articles need embeddings',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-batch-embeddings] Found ${articles.length} articles to process`);

    let processed = 0;
    let errors = 0;
    let usedOpenAI = 0;
    let usedFallback = 0;

    // Process articles one by one
    for (const article of articles) {
      try {
        console.log(`[generate-batch-embeddings] Processing article: ${article.title}`);
        
        const text = `${article.title}\n\n${article.content}`;
        const embedding = await generateEmbedding(text, OPENAI_API_KEY);

        if (!embedding) {
          console.error(`[generate-batch-embeddings] Failed to generate embedding for article ${article.id}`);
          errors++;
          continue;
        }

        // Track which provider was used
        if (OPENAI_API_KEY) {
          usedOpenAI++;
        } else {
          usedFallback++;
        }

        // Save embedding to database using RPC (correct parameter names)
        const { error: updateError } = await supabase.rpc('update_article_embedding', {
          article_id: article.id,
          new_embedding: embedding,
        });

        if (updateError) {
          console.error(`[generate-batch-embeddings] Error updating article ${article.id}:`, updateError);
          errors++;
        } else {
          processed++;
          console.log(`[generate-batch-embeddings] ✓ Processed ${article.title}`);
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`[generate-batch-embeddings] Error processing article ${article.id}:`, error);
        errors++;
      }
    }

    console.log(`[generate-batch-embeddings] Batch complete: ${processed} success, ${errors} errors`);
    console.log(`[generate-batch-embeddings] Provider usage - OpenAI: ${usedOpenAI}, Fallback: ${usedFallback}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: articles.length,
        providers: {
          openai: usedOpenAI,
          fallback: usedFallback
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-batch-embeddings] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
