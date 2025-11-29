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

    // Rate limit: máximo 10 códigos por email por hora (aumentado para desenvolvimento)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('email_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', oneHourAgo);

    if (count && count >= 10) {
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
      from: 'Parabellum Security <sistema@parabellum.work>',
      to: [email],
      subject: '🔐 Código de Verificação - Primeiro Acesso Parabellum',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🔐 Sistema Parabellum</h1>
          </div>
          
          <div style="padding: 30px; background: #f8fafc;">
            <h2 style="color: #1e3a5f;">Código de Verificação</h2>
            <p>Olá! Você está ativando sua conta no Sistema Parabellum.</p>
            <p>Use o código abaixo para confirmar sua identidade:</p>
            
            <div style="background: white; border-radius: 8px; padding: 30px; text-align: center; margin: 20px 0; border: 2px solid #2563EB;">
              <h1 style="font-size: 48px; letter-spacing: 12px; margin: 0; color: #2563EB; font-weight: bold;">${code}</h1>
            </div>
            
            <p style="color: #dc2626; font-weight: bold;">⏱️ Este código expira em 10 minutos.</p>
            
            <p style="color: #64748b; font-size: 14px;">
              Se você não solicitou este código, entre em contato com o suporte imediatamente.
            </p>
          </div>
          
          <div style="background: #1e3a5f; padding: 20px; text-align: center;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              Equipe de Segurança - Parabellum
            </p>
          </div>
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
