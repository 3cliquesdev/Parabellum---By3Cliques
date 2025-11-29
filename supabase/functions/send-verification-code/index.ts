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
      subject: '🔐 CÓDIGO DE VERIFICAÇÃO: Acesso ao Sistema Parabellum',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb;">
          
        <!-- HEADER COM LOGO -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
          <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png" 
               alt="PARABELLUM" 
               style="max-width: 200px; height: auto;" />
        </div>
          
          <!-- CONTAINER PRINCIPAL -->
          <div style="background: #ffffff; border: 1px solid #e5e7eb; margin: 0; padding: 40px 30px;">
            
            <!-- SAUDAÇÃO -->
            <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px 0;">
              Prezado(a) Colaborador(a),
            </p>
            
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
              Recebemos uma solicitação de acesso à sua conta no <strong>Parabellum / 3 Cliques</strong>.
            </p>
            
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
              Para garantir a segurança dos seus dados, utilize o código de verificação única (OTP) abaixo para completar o login:
            </p>
            
            <!-- CÓDIGO OTP - DESTAQUE PRINCIPAL -->
            <div style="background: #f3f4f6; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; border: 2px solid #d1d5db;">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 15px 0;">
                Seu Código de Verificação
              </p>
              <h1 style="font-family: 'Courier New', Consolas, monospace; font-size: 42px; letter-spacing: 16px; margin: 0; color: #111827; font-weight: bold;">
                ${code.split('').join(' ')}
              </h1>
              <p style="color: #dc2626; font-size: 13px; margin: 15px 0 0 0; font-weight: 500;">
                ⏱️ Código válido por 10 minutos
              </p>
            </div>
            
            <!-- ALERTA DE SEGURANÇA -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h3 style="color: #92400e; font-size: 14px; margin: 0 0 12px 0;">
                ⚠️ ALERTA DE SEGURANÇA
              </h3>
              <p style="color: #78350f; font-size: 13px; line-height: 1.6; margin: 0 0 10px 0;">
                <strong>Nunca compartilhe:</strong> A equipe Parabellum / 3 Cliques <u>jamais</u> solicitará este código por telefone, WhatsApp ou SMS.
              </p>
              <p style="color: #78350f; font-size: 13px; line-height: 1.6; margin: 0;">
                <strong>Não foi você?</strong> Se você não solicitou este código, sua credencial pode estar comprometida. 
                Altere sua senha imediatamente e notifique o departamento de segurança.
              </p>
            </div>
            
            <!-- DETALHES DA SOLICITAÇÃO -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0; border: 1px solid #e5e7eb;">
              <h4 style="color: #374151; font-size: 13px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">
                📋 Detalhes da Solicitação
              </h4>
              <table style="width: 100%; font-size: 13px; color: #4b5563;">
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Sistema:</td>
                  <td style="padding: 5px 0; font-weight: 500;">Parabellum / 3 Cliques</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Data/Hora:</td>
                  <td style="padding: 5px 0; font-weight: 500;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Tipo:</td>
                  <td style="padding: 5px 0; font-weight: 500;">Verificação de Identidade</td>
                </tr>
              </table>
            </div>
            
            <!-- AVISO FINAL -->
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0 0; font-style: italic;">
              Esta é uma mensagem automática de segurança. Por favor, não responda.
            </p>
            
          </div>
          
          <!-- FOOTER -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #1e3a5f;">
            <tr>
              <td align="center" style="padding: 25px;">
                
                <!-- Logos lado a lado -->
                <table cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td style="padding: 0 8px;">
                      <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png" 
                           alt="PARABELLUM" 
                           width="100"
                           style="display: block; max-width: 100px; height: auto;" />
                    </td>
                    <td style="padding: 0 8px;">
                      <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-3cliques-email.png" 
                           alt="3 CLIQUES" 
                           width="80"
                           style="display: block; max-width: 80px; height: auto;" />
                    </td>
                  </tr>
                </table>
                
                <!-- Texto "PARABELLUM by 3Cliques" -->
                <p style="color: #ffffff; margin: 15px 0 10px 0; font-size: 14px; font-weight: 600;">
                  PARABELLUM by 3Cliques
                </p>
                
                <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 12px;">
                  Departamento de Segurança da Informação
                </p>
                <p style="color: #64748b; margin: 0; font-size: 11px;">
                  Ambiente Seguro
                </p>
                
              </td>
            </tr>
          </table>
          
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
