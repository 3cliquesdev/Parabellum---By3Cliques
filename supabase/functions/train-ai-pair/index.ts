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
    const { question, correctAnswer, personaId, source = 'sandbox_training' } = await req.json();
    
    console.log('[train-ai-pair] Training new pair:', { question, source });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // Gerar embedding se OpenAI disponível
    let embedding = null;
    if (OPENAI_API_KEY) {
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: `${question}\n${correctAnswer}`,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.data[0].embedding;
          console.log('[train-ai-pair] Embedding generated');
        }
      } catch (error) {
        console.error('[train-ai-pair] Error generating embedding:', error);
      }
    }

    // Salvar artigo na base de conhecimento
    const { data: article, error: insertError } = await supabase
      .from('knowledge_articles')
      .insert({
        title: `Treinamento: ${question.substring(0, 100)}`,
        content: correctAnswer,
        category: 'Treinamento IA',
        tags: ['sandbox', 'training', personaId],
        source: source,
        status: 'published', // Admin aprovou ao corrigir
        is_published: true,
        embedding: embedding,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[train-ai-pair] Error inserting article:', insertError);
      throw insertError;
    }

    console.log('[train-ai-pair] Training pair saved:', article.id);

    // Criar notificação para outros admins/managers
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'manager']);

    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        await supabase.from('notifications').insert({
          user_id: admin.user_id,
          type: 'ai_learning',
          title: '🎓 IA Aprendeu Nova Regra',
          message: `Nova regra treinada via Sandbox: "${question.substring(0, 50)}..."`,
          metadata: {
            article_id: article.id,
            source: source,
          },
          read: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        article_id: article.id,
        message: 'Regra gravada e memorizada! A IA nunca mais vai errar isso.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[train-ai-pair] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
