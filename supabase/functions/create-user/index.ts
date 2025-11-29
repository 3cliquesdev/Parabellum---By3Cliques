import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const AUDIT_EMAIL = Deno.env.get("AUDIT_EMAIL");

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
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

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the requesting user is an admin
    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roles?.role !== 'admin') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, password, role, full_name, department } = await req.json();

    // Validate required fields
    if (!email || !password || !role || !full_name || !department) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const allowedRoles = ['admin', 'manager', 'sales_rep', 'consultant', 'support_agent', 'support_manager', 'financial_manager'];
    if (!allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user:', { email, role, full_name, department });

    // Create the new user with admin privileges
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        department,
        must_change_password: true
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', newUser.user.id);

    // Upsert role into user_roles table (trigger may have already created one)
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: newUser.user.id,
        role: role
      }, {
        onConflict: 'user_id'
      });

    if (roleUpsertError) {
      console.error('Error upserting user role:', roleUpsertError);
      // Delete the user if role upsert fails to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to assign user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User role assigned successfully');

    // Update profile with department
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ department })
      .eq('id', newUser.user.id);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      // Note: We don't rollback here as the profile trigger should have created it
      // Just log the error
    }

    console.log('User creation completed successfully');

    // Buscar nome do departamento para incluir no email
    const { data: deptData } = await supabaseAdmin
      .from('departments')
      .select('name')
      .eq('id', department)
      .single();

    // Enviar email de boas-vindas com Termo de Responsabilidade
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- HEADER COM LOGO -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
          <img src="https://zaeozfdjhrmblfaxsyuu.supabase.co/storage/v1/object/public/avatars/logo-parabellum-email.png?v=2" 
               alt="PARABELLUM" 
               style="max-width: 200px; height: auto;" />
        </div>
        
        <!-- CONTEÚDO -->
        <div style="padding: 30px; background: #f8fafc;">
          <p style="color: #475569; line-height: 1.6; margin-bottom: 15px;">
            Prezado(a) <strong>${full_name}</strong>,
          </p>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
            Bem-vindo à operação. Seu acesso à plataforma PARABELLUM foi concedido.
          </p>
          
          <p style="color: #1e3a5f; font-weight: 600; margin-bottom: 10px;">
            Seguem suas credenciais de acesso:
          </p>
          
          <div style="background: white; border: 2px solid #1e3a5f; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Sistema:</strong> https://parabellum.work</p>
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Login:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Senha Temporária:</strong> ${password}</p>
            <p style="margin: 8px 0; color: #dc2626; font-size: 13px;">(Troca obrigatória no primeiro login)</p>
          </div>
          
          <h3 style="color: #1e3a5f; margin-top: 30px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">
            TERMO DE RESPONSABILIDADE E SIGILO
          </h3>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 15px;">
            Ao utilizar suas credenciais, você declara ciência das seguintes normas de segurança da informação da PARABELLUM:
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

    try {
      const emailPayload: any = {
        from: 'PARABELLUM Security <sistema@parabellum.work>',
        to: [email],
        subject: '🔐 Acesso Concedido - Termo de Responsabilidade',
        html: emailHtml,
      };
      
      // Adicionar BCC se AUDIT_EMAIL estiver configurado
      if (AUDIT_EMAIL) {
        emailPayload.bcc = [AUDIT_EMAIL];
        console.log('📧 Email será enviado com BCC para auditoria:', AUDIT_EMAIL);
      } else {
        console.warn('⚠️ AUDIT_EMAIL não configurado - email será enviado sem BCC');
      }
      
      const emailResponse = await resend.emails.send(emailPayload);
      console.log('✅ Email de boas-vindas enviado:', emailResponse);
    } catch (emailError) {
      // Não falhar a criação do usuário se o email falhar
      console.error('❌ Erro ao enviar email de boas-vindas:', emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role,
          full_name,
          department
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
