import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-verification-code] Gerando código para:', email);

    // Rate limit: máximo 3 códigos por email por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('email_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', oneHourAgo);

    if (count && count >= 3) {
      return new Response(JSON.stringify({ 
        error: 'Limite de códigos atingido. Aguarde 1 hora.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Salvar código no banco
    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        email,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[send-verification-code] Erro ao salvar código:', insertError);
      throw insertError;
    }

    // Enviar email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Atendimento <onboarding@resend.dev>',
      to: [email],
      subject: 'Seu Código de Verificação',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563EB;">🔐 Verificação de Identidade</h2>
          <p>Recebemos uma solicitação para acessar seu histórico de conversas.</p>
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 48px; letter-spacing: 8px; margin: 0; color: #2563EB;">${code}</h1>
          </div>
          <p><strong>Este código expira em 10 minutos.</strong></p>
          <p style="color: #6B7280; font-size: 14px;">
            Se você não solicitou este código, pode ignorar este email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('[send-verification-code] ❌ ERRO ao enviar email:', emailError);
      console.error('[send-verification-code] Detalhes do erro:', JSON.stringify(emailError));
      
      // Detectar erro 403 do Resend (modo teste/desenvolvimento)
      const errorMessage = emailError.message || JSON.stringify(emailError);
      if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        console.log('[send-verification-code] ⚠️⚠️⚠️ MODO DESENVOLVIMENTO DETECTADO ⚠️⚠️⚠️');
        console.log('[send-verification-code] Resend API em modo teste ou sem domínio verificado');
        console.log('[send-verification-code] 🔑 CÓDIGO OTP PARA TESTES:', code);
        console.log('[send-verification-code] Email destino:', email);
        console.log('[send-verification-code] ⚠️ Configure o Resend em https://resend.com/domains para produção');
        
        return new Response(JSON.stringify({ 
          success: true,
          dev_mode: true,
          code: code, // Incluir código na resposta apenas em dev
          warning: 'Email não enviado - Resend em modo teste. Configure domínio verificado.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw emailError;
    }

    console.log('[send-verification-code] ✅ Email enviado com SUCESSO via Resend');
    console.log('[send-verification-code] Destinatário:', email);
    console.log('[send-verification-code] ID do email:', emailData?.id);
    console.log('[send-verification-code] 🔑 Código OTP gerado:', code);

    return new Response(JSON.stringify({ 
      success: true,
      code: code // FASE 1: Sempre retornar o código para uso interno
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[send-verification-code] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
