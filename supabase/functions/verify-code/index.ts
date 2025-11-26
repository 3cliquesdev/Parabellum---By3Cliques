import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Email e código são obrigatórios' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[verify-code] Verificando código para:', email);

    // Buscar QUALQUER código válido que bata com o código digitado
    const { data: verifications, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .lt('attempts', 3)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[verify-code] Erro ao buscar código:', fetchError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Erro ao verificar código' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se não encontrou nenhum código válido, verificar por que
    if (!verifications || verifications.length === 0) {
      // Verificar se existe algum código para este email
      const { data: anyCode } = await supabase
        .from('email_verifications')
        .select('code, verified, expires_at, attempts')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!anyCode || anyCode.length === 0) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Nenhum código encontrado para este e-mail' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const lastCode = anyCode[0];
      
      // Dar feedback específico do problema
      if (lastCode.verified) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Este código já foi utilizado. Solicite um novo código.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (new Date(lastCode.expires_at) < new Date()) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Código expirado. Solicite um novo.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (lastCode.attempts >= 3) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Máximo de tentativas excedido. Solicite um novo código.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se chegou aqui, o código está errado
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Código incorreto. Verifique e tente novamente.' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verification = verifications[0];

    // Código correto! Marcar como verificado
    await supabase
      .from('email_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    // Buscar contact_id associado ao email
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .single();

    console.log('[verify-code] ✅ Código verificado com sucesso');

    return new Response(JSON.stringify({ 
      success: true,
      contact_id: contact?.id || null
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[verify-code] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
