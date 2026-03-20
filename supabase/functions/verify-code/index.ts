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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { email, code, conversation_id, otp_reason } = await req.json();

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
      // PRIMEIRO: Verificar se o código DIGITADO pelo usuário existe (mesmo que expirado/usado)
      const { data: typedCode } = await supabase
        .from('email_verifications')
        .select('code, verified, expires_at, attempts')
        .eq('email', email)
        .eq('code', code)  // Buscar o código específico que o usuário digitou
        .order('created_at', { ascending: false })
        .limit(1);

      // Se o código digitado existe no banco
      if (typedCode && typedCode.length > 0) {
        const codeInfo = typedCode[0];
        
        // Verificar se já foi usado
        if (codeInfo.verified) {
          if (conversation_id) supabase.from('otp_verification_audit').insert({ conversation_id, otp_reason: otp_reason ?? null, result: 'invalid_code', channel: 'whatsapp' } as any).then(() => {});
          return new Response(JSON.stringify({
            success: false,
            error: 'Este código já foi utilizado. Verifique seu email para o código mais recente.'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verificar se expirou
        if (new Date(codeInfo.expires_at) < new Date()) {
          if (conversation_id) supabase.from('otp_verification_audit').insert({ conversation_id, otp_reason: otp_reason ?? null, result: 'expired', channel: 'whatsapp' } as any).then(() => {});
          return new Response(JSON.stringify({
            success: false,
            error: 'Este código expirou. Verifique seu email para o código mais recente que enviamos.'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verificar se excedeu tentativas
        if (codeInfo.attempts >= 3) {
          if (conversation_id) supabase.from('otp_verification_audit').insert({ conversation_id, otp_reason: otp_reason ?? null, result: 'max_attempts', channel: 'whatsapp' } as any).then(() => {});
          return new Response(JSON.stringify({
            success: false,
            error: 'Máximo de tentativas excedido. Solicite um novo código.'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Verificar se existe algum código para este email (para dar feedback útil)
      const { data: anyCode } = await supabase
        .from('email_verifications')
        .select('code')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!anyCode || anyCode.length === 0) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Nenhum código encontrado para este e-mail. Solicite um novo código.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se chegou aqui, o código digitado nunca existiu ou está incorreto
      if (conversation_id) supabase.from('otp_verification_audit').insert({ conversation_id, otp_reason: otp_reason ?? null, result: 'invalid_code', channel: 'whatsapp' }).then(() => {}).catch(() => {});
      return new Response(JSON.stringify({
        success: false,
        error: 'Código inválido. Verifique se digitou corretamente.'
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

    // 📊 TELEMETRIA: OTP verificado com sucesso
    if (conversation_id) {
      supabase.from('otp_verification_audit').insert({
        conversation_id,
        contact_id: contact?.id ?? null,
        otp_reason: otp_reason ?? null,
        result: 'success',
        channel: 'whatsapp',
      }).then(() => {}).catch(() => {});
    }

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
