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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, message, error, conversationId, contactName } = await req.json();

    console.log('[send-admin-alert] 🚨 Enviando alerta crítico ao admin:', {
      type,
      message,
      conversationId
    });

    // Buscar user_ids dos admins (sem email, pois não existe na tabela profiles)
    const { data: adminRoles, error: adminError } = await supabaseClient
      .from('user_roles')
      .select('user_id, profiles!inner(full_name)')
      .eq('role', 'admin');

    if (adminError) {
      console.error('[send-admin-alert] ❌ Erro ao buscar admins:', adminError);
      throw adminError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.warn('[send-admin-alert] ⚠️ Nenhum admin encontrado para notificar');
      return new Response(
        JSON.stringify({ success: false, error: 'No admins found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Buscar detalhes do link da conversa se conversationId fornecido
    let conversationLink = '';
    if (conversationId) {
      conversationLink = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]?.split('.')[0]}.lovable.app/inbox?conversation=${conversationId}`;
    }

    // Enviar email para cada admin - buscar email via Auth Admin API
    const emailPromises = adminRoles.map(async (adminRole: any) => {
      // Buscar email do usuário via Auth Admin API (requer Service Role)
      const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(adminRole.user_id);
      
      if (userError || !userData?.user?.email) {
        console.error(`[send-admin-alert] ❌ Erro ao buscar email do admin ${adminRole.user_id}:`, userError);
        return { success: false, user_id: adminRole.user_id, error: userError || 'No email found' };
      }

      const adminEmail = userData.user.email;
      const adminName = adminRole.profiles?.full_name || 'Admin';

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box { background: #fee; border: 2px solid #c00; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .alert-title { color: #c00; font-size: 20px; font-weight: bold; margin: 0 0 10px 0; }
    .details { background: #f9f9f9; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Alerta Critico do Sistema</h2>
    
    <div class="alert-box">
      <div class="alert-title">IA parou de responder</div>
      <p><strong>Tipo:</strong> ${type}</p>
      <p><strong>Mensagem:</strong> ${message}</p>
      ${contactName ? `<p><strong>Cliente:</strong> ${contactName}</p>` : ''}
    </div>

    <div class="details">
      <p><strong>Detalhes Técnicos:</strong></p>
      <pre style="white-space: pre-wrap; word-wrap: break-word; background: #fff; padding: 10px; border-radius: 4px;">${error || 'Sem stack trace disponível'}</pre>
    </div>

    ${conversationLink ? `
    <a href="${conversationLink}" class="button">
      Ver Conversa Completa
    </a>
    ` : ''}

    <p><strong>Acao Necessaria:</strong> A conversa foi automaticamente transferida para atendimento humano, mas o problema tecnico precisa ser investigado imediatamente.</p>

    <div class="footer">
      <p>Este é um email automático do Sistema de Monitoramento IA.<br>
      Sistema CRM - Monitoramento</p>
    </div>
  </div>
</body>
</html>
`;

      const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
        body: {
          to: adminEmail,
          to_name: adminName,
          subject: `ALERTA: IA Falhou ao Responder Cliente ${contactName || ''}`,
          html: htmlBody
        }
      });

      if (emailError) {
        console.error(`[send-admin-alert] ❌ Erro ao enviar email para ${adminEmail}:`, emailError);
        return { success: false, email: adminEmail, error: emailError };
      }

      console.log(`[send-admin-alert] ✅ Email enviado com sucesso para ${adminEmail}`);
      return { success: true, email: adminEmail };
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`[send-admin-alert] 📧 Alertas enviados: ${successCount}/${adminRoles.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: successCount,
        total: adminRoles.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-admin-alert] ❌ Erro crítico:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
