import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveBranding } from "../_shared/branding-resolver.ts";

// Resend helper (inline to avoid CDN issues)
class Resend {
  private apiKey: string;
  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey || "";
  }
  emails = {
    send: async (options: { from: string; to: string[]; bcc?: string[]; subject: string; html: string }) => {
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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const roleLabels: Record<string, string> = {
  'admin': 'Administrador',
  'general_manager': 'Gerente Geral',
  'manager': 'Gerente',
  'sales_rep': 'Vendedor',
  'consultant': 'Consultor',
  'support_agent': 'Agente de Suporte',
  'support_manager': 'Gerente de Suporte',
  'financial_manager': 'Gerente Financeiro',
  'financial_agent': 'Agente Financeiro',
  'cs_manager': 'Gerente de CS',
  'ecommerce_analyst': 'Analista de E-commerce'
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

    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Unable to verify permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin always has permission
    const isAdmin = userRole?.role === 'admin';

    // Check permission in role_permissions table
    const { data: permission } = await supabaseAdmin
      .from('role_permissions')
      .select('enabled')
      .eq('role', userRole?.role)
      .eq('permission_key', 'users.manage')
      .single();

    const hasPermission = isAdmin || permission?.enabled === true;

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Você não tem permissão para reenviar emails' }),
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
    const { data: targetUserRole } = await supabaseAdmin
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
    const role = targetUserRole?.role || 'sales_rep';
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

    // Resolver branding dinâmico
    const brand = await resolveBranding(supabaseAdmin, { isEmployee: true });

    // Send welcome email with responsibility term
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- HEADER COM LOGO -->
        <div style="background: linear-gradient(135deg, ${brand.headerColor} 0%, ${brand.primaryColor} 100%); padding: 30px; text-align: center;">
          ${brand.logoUrl
            ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-width: 200px; height: auto;" />`
            : `<h2 style="color: white; margin: 0;">${brand.brandName}</h2>`
          }
               style="max-width: 200px; height: auto;" />
        </div>
        
        <!-- CONTEÚDO -->
        <div style="padding: 30px; background: #f8fafc;">
          <p style="color: #475569; line-height: 1.6; margin-bottom: 15px;">
            Prezado(a) <strong>${fullName}</strong>,
          </p>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
            Bem-vindo à operação. Seu acesso à plataforma ${brand.brandName} foi concedido.
          </p>
          
          <p style="color: #1e3a5f; font-weight: 600; margin-bottom: 10px;">
            Seguem suas credenciais de acesso:
          </p>
          
          <div style="background: white; border: 2px solid #1e3a5f; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Sistema:</strong> https://parabellum.work</p>
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Login:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Senha Temporária:</strong> ${newPassword}</p>
            <p style="margin: 8px 0; color: #dc2626; font-size: 13px;">(Troca obrigatória no primeiro login)</p>
          </div>
          
          <h3 style="color: #1e3a5f; margin-top: 30px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">
            TERMO DE RESPONSABILIDADE E SIGILO
          </h3>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 15px;">
            Ao utilizar suas credenciais, você declara ciência das seguintes normas de segurança da informação da ${brand.brandName}:
          </p>
          
          <div style="margin: 20px 0;">
            <p style="color: #475569; line-height: 1.6; margin-bottom: 12px;">
              <strong style="color: #1e3a5f;">Intransferibilidade:</strong> Seu usuário e senha são de uso estritamente pessoal. É proibido compartilhar o acesso com terceiros, sob pena de desligamento e sanções legais.
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 12px;">
              <strong style="color: #1e3a5f;">Propriedade de Dados:</strong> Todas as informações contidas no sistema (clientes, estratégias, valores) são propriedade exclusiva da empresa. A exportação, print ou divulgação não autorizada constitui violação de sigilo.
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 12px;">
              <strong style="color: #1e3a5f;">Auditoria:</strong> Todas as ações realizadas na plataforma são monitoradas e registradas (Logs de Acesso) para fins de segurança.
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 12px;">
              <strong style="color: #1e3a5f;">Dever de Guarda:</strong> Você é responsável por qualquer ação realizada através do seu login. Realize o logoff ao terminar suas atividades.
            </p>
          </div>
          
          <p style="color: #1e3a5f; font-style: italic; margin-top: 25px; margin-bottom: 20px;">
            Mantenha a vigilância.
          </p>
          
          <p style="color: #475569; line-height: 1.6; margin-top: 25px;">
            Atenciosamente,<br>
            <strong style="color: #1e3a5f;">Departamento de Segurança PARABELLUM</strong>
          </p>
        </div>
        
        <!-- FOOTER -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #1e3a5f;">
          <tr>
            <td align="center" style="padding: 25px;">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="padding: 0 8px;">
                    <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png?v=2" 
                         alt="PARABELLUM" 
                         width="100"
                         style="display: block; max-width: 100px; height: auto;" />
                  </td>
                  <td style="padding: 0 8px;">
                    <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-3cliques-email.png?v=2" 
                         alt="3 CLIQUES" 
                         width="80"
                         style="display: block; max-width: 80px; height: auto;" />
                  </td>
                </tr>
              </table>
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
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: '3Cliques <contato@mail.3cliques.net>',
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
