import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const roleLabels: Record<string, string> = {
  'admin': 'Administrador',
  'manager': 'Gerente',
  'sales_rep': 'Vendedor',
  'consultant': 'Consultor',
  'support_agent': 'Agente de Suporte',
  'support_manager': 'Gerente de Suporte',
  'financial_manager': 'Gerente Financeiro'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roles?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user details
    const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (userError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user role and profile
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, department')
      .eq('id', user_id)
      .single();

    const email = targetUser.user.email;
    const role = userRole?.role || 'sales_rep';
    const fullName = profile?.full_name || email?.split('@')[0] || 'Usuário';

    console.log('Reenviando email de boas-vindas para:', email);

    // Reset password to generate new temporary password
    const newPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
    
    await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: newPassword,
      user_metadata: {
        must_change_password: true
      }
    });

    // Send welcome email with responsibility term
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563EB; }
          .button { display: inline-block; background: #2563EB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
          .term { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          ul { margin: 10px 0; padding-left: 20px; }
          strong { color: #2563EB; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📧 Acesso Concedido</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Bem-vindo à operação</p>
          </div>
          
          <div class="content">
            <p>Olá <strong>${fullName}</strong>,</p>
            
            <p>Bem-vindo à operação. Seu acesso à plataforma PARABELLUM | 3Cliques foi concedido. Nova senha temporária gerada.</p>
            
            <div class="credentials">
              <h3 style="margin-top: 0; color: #2563EB;">🔑 Credenciais de Acesso</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Senha Temporária:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${newPassword}</code></p>
              <p><strong>Perfil:</strong> ${roleLabels[role]}</p>
            </div>

            <a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://seu-app.lovable.app'}" class="button">
              🚀 Acessar Sistema
            </a>

            <div class="term">
              <h3 style="margin-top: 0; color: #f59e0b;">⚠️ Termo de Responsabilidade</h3>
              <p>Ao utilizar suas credenciais, você declara ciência das seguintes normas de segurança da informação da PARABELLUM | 3Cliques:</p>
              <ul>
                <li>Este acesso é <strong>pessoal e intransferível</strong></li>
                <li>Você é responsável por todas as ações realizadas com suas credenciais</li>
                <li>Deve <strong>manter sigilo absoluto</strong> sobre informações confidenciais</li>
                <li>O compartilhamento de senhas é <strong>expressamente proibido</strong></li>
                <li>O uso indevido pode resultar em <strong>bloqueio imediato</strong></li>
              </ul>
            </div>

            <p style="margin-top: 30px;">
              <strong>Próximos passos:</strong><br>
              1. Acesse o sistema usando as credenciais acima<br>
              2. Você será solicitado a validar seu email via código OTP<br>
              3. Crie uma senha forte e pessoal<br>
              4. Explore sua área de trabalho
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              💡 <em>Caso tenha dúvidas, entre em contato com o administrador do sistema.</em>
            </p>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} PARABELLUM | 3Cliques - Sistema de Gestão</p>
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'PARABELLUM Security <sistema@parabellum.work>',
      to: [email!],
      subject: 'Acesso Concedido - Termo de Responsabilidade',
      html: emailHtml,
    });

    if (emailError) {
      console.error('Erro ao enviar email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar email', details: emailError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email reenviado com sucesso:', emailData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email reenviado com sucesso',
        email_id: emailData?.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resend-welcome-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
