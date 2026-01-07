import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-batch-embeddings] Starting batch embedding generation');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    let processed = 0;
    let errors = 0;

    // Process articles one by one
    for (const article of articles) {
      try {
        console.log(`[generate-batch-embeddings] Processing article: ${article.title}`);
        
        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: `${article.title}\n\n${article.content}`,
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`[generate-batch-embeddings] OpenAI error for article ${article.id}:`, errorText);
          errors++;
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Save embedding to database using RPC
        const { error: updateError } = await supabase.rpc('update_article_embedding', {
          p_article_id: article.id,
          p_embedding: embedding,
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

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: articles.length,
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
