import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveBranding } from "../_shared/branding-resolver.ts";

// Resend helper (inline to avoid CDN issues)
class Resend {
  private apiKey: string;
  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey || "";
  }
  emails = {
    send: async (options: { from: string; to: string[]; bcc?: string[]; subject: string; html: string; headers?: Record<string, string> }) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    }
  };
}

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

    const { email, type = 'employee' } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-verification-code] Gerando código para:', email, 'type:', type);

    // Define branding based on type
    const branding = type === 'customer' ? {
      name: '3Cliques',
      from: '3Cliques <contato@mail.3cliques.net>',
      subject: 'Código de Verificação - 3Cliques',
      logo: 'https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo_seu_armazem-drop.png',
      greeting: 'Olá!',
      systemName: '3Cliques',
      primaryColor: '#f97316',
      headerColor: '#1e293b',
      description: 'Recebemos uma solicitação de verificação no 3Cliques.',
      footer: 'Equipe 3Cliques'
    } : {
      name: '3Cliques',
      from: '3Cliques <contato@mail.3cliques.net>',
      subject: 'Código de Verificação - Acesso ao Sistema 3Cliques',
      logo: 'https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png?v=2',
      greeting: 'Prezado(a) Colaborador(a),',
      systemName: '3Cliques',
      primaryColor: '#2563eb',
      headerColor: '#1e3a5f',
      description: 'Recebemos uma solicitação de acesso à sua conta no sistema 3Cliques.',
      footer: 'Atenciosamente,<br><strong style="color: #1e293b;">Equipe 3Cliques</strong>'
    };

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
    
    console.log('[send-verification-code] Enviando email com branding:', branding.name);
    
    // Template simplificado para melhor deliverability em emails corporativos
    const simpleHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
<div style="text-align:center;padding:20px 0;">
<img src="${branding.logo}" alt="${branding.name}" style="max-width:160px;height:auto;" />
</div>
<div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-radius:8px;">
<p style="color:#1f2937;font-size:15px;margin:0 0 15px;">${branding.greeting}</p>
<p style="color:#374151;font-size:14px;line-height:1.5;margin:0 0 20px;">${branding.description}</p>
<p style="color:#374151;font-size:14px;margin:0 0 20px;">Use o codigo abaixo para verificar sua identidade:</p>
<div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin:20px 0;">
<p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Codigo de Verificacao</p>
<p style="font-family:'Courier New',monospace;font-size:36px;letter-spacing:12px;margin:0;color:#111827;font-weight:bold;">${code}</p>
<p style="color:#dc2626;font-size:12px;margin:10px 0 0;">Valido por 10 minutos</p>
</div>
<p style="color:#78350f;font-size:12px;background:#fef3c7;padding:12px;border-radius:6px;margin:20px 0;">Nao compartilhe este codigo. A equipe ${branding.systemName} nunca pedira seu codigo por telefone ou WhatsApp.</p>
</div>
<p style="color:#9ca3af;font-size:11px;text-align:center;margin:20px 0 0;">Email automatico - nao responda. ${branding.systemName}</p>
</div>`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: branding.from,
      to: [email],
      subject: branding.subject,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
      html: simpleHtml,
    });

    if (emailError) {
      console.error('[send-verification-code] ❌ ERRO ao enviar email:', emailError);
      console.error('[send-verification-code] Detalhes do erro:', JSON.stringify(emailError));
      
      // Detectar erro 403 do Resend (modo teste/desenvolvimento)
      const errorMessage = emailError.message || JSON.stringify(emailError);
      const errorStatusCode = (emailError as any).statusCode;
      const is403Error = errorStatusCode === 403 || 
                         errorMessage.includes('403') || 
                         errorMessage.includes('Forbidden') ||
                         errorMessage.includes('not verified');
      
      if (is403Error) {
        console.log('[send-verification-code] ⚠️⚠️⚠️ MODO DESENVOLVIMENTO DETECTADO ⚠️⚠️⚠️');
        console.log('[send-verification-code] Resend API em modo teste ou sem domínio verificado');
        console.log('[send-verification-code] 🔑 CÓDIGO OTP PARA TESTES:', code);
        console.log('[send-verification-code] Email destino:', email);
        console.log('[send-verification-code] ⚠️ Configure o Resend em https://resend.com/domains para produção');
        
        return new Response(JSON.stringify({ 
          success: true,
          dev_mode: true,
          // ❌ NEVER return code in API response for security
          // Code is logged in server console for debugging only
          warning: 'Email não enviado - Resend em modo teste. Verifique logs do servidor para código de teste.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw emailError;
    }

    console.log('[send-verification-code] ✅ Email enviado com SUCESSO via Resend');
    console.log('[send-verification-code] Destinatário:', email);
    console.log('[send-verification-code] Resend ID:', emailData?.id);

    // Registrar em email_sends para tracking de bounces via webhook
    if (emailData?.id) {
      const { error: trackError } = await supabase.from('email_sends').insert({
        resend_email_id: emailData.id,
        recipient_email: email,
        subject: branding.subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      if (trackError) {
        console.warn('[send-verification-code] Falha ao registrar email_sends:', trackError);
      } else {
        console.log('[send-verification-code] Registrado em email_sends para tracking');
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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
