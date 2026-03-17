import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
const AUDIT_EMAIL = Deno.env.get("AUDIT_EMAIL");

const roleLabels: Record<string, string> = {
  'admin': 'Administrador',
  'general_manager': 'Gerente Geral',
  'manager': 'Gerente de Vendas',
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

    // Check if the requesting user has permission to manage users
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError) {
      console.error('Role check failed:', roleError);
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

    // Log estruturado para debug de permissão
    console.log('[create-user] Permission check:', {
      caller_id: user.id,
      caller_role: userRole?.role,
      permission_key: 'users.manage',
      permission_enabled: permission?.enabled,
      is_admin: isAdmin,
      has_permission: hasPermission
    });

    if (!hasPermission) {
      console.error('[create-user] DENIED:', {
        caller_id: user.id,
        caller_role: userRole?.role,
        reason: 'users.manage not enabled for this role'
      });
      return new Response(
        JSON.stringify({ error: 'Forbidden: Você não tem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { email, password, role, full_name, department } = body;

    // ============================================
    // ENTERPRISE VALIDATION: Validate all inputs
    // ============================================
    const validationErrors: string[] = [];

    // Validate required fields presence
    if (!email) validationErrors.push('email é obrigatório');
    if (!password) validationErrors.push('password é obrigatório');
    if (!role) validationErrors.push('role é obrigatório');
    if (!full_name) validationErrors.push('full_name é obrigatório');
    if (!department) validationErrors.push('department é obrigatório');

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios ausentes', details: validationErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format and length
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || email.length > 255 || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido. Formato incorreto ou excede 255 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter entre 8 e 128 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate full_name length
    if (typeof full_name !== 'string' || full_name.length < 2 || full_name.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Nome completo deve ter entre 2 e 200 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate department is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof department !== 'string' || !uuidRegex.test(department)) {
      return new Response(
        JSON.stringify({ error: 'Department ID inválido. Deve ser um UUID válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const allowedRoles = ['admin', 'general_manager', 'manager', 'sales_rep', 'consultant', 'support_agent', 'support_manager', 'financial_manager', 'cs_manager', 'ecommerce_analyst'];
    if (typeof role !== 'string' || !allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Role inválido. Deve ser um de: ${allowedRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedFullName = full_name.trim();

    console.log('Creating user:', { email: sanitizedEmail, role, full_name: sanitizedFullName, department });

    // Create the new user with admin privileges
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: sanitizedFullName,
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
            Bem-vindo à operação. Seu acesso à plataforma PARABELLUM | 3Cliques foi concedido.
          </p>
          
          <p style="color: #1e3a5f; font-weight: 600; margin-bottom: 10px;">
            Seguem suas credenciais de acesso:
          </p>
          
          <div style="background: white; border: 2px solid #1e3a5f; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Sistema:</strong> https://parabellum.work</p>
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Login:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #1e3a5f;"><strong>Senha Temporária:</strong> ${password}</p>
            <p style="margin: 4px 0; color: #dc2626; font-size: 13px; font-weight: 600;">(Troca obrigatória no primeiro login)</p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="https://parabellum.work/auth" 
               style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); 
                      color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; 
                      font-weight: 600; font-size: 16px;">
              Acessar o Sistema
            </a>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              <strong>Importante:</strong> No primeiro acesso, você será solicitado a definir uma nova senha por segurança.
            </p>
          </div>
          
          <h3 style="color: #1e3a5f; margin-top: 30px; margin-bottom: 15px; font-size: 16px; text-transform: uppercase;">
            TERMO DE RESPONSABILIDADE E SIGILO
          </h3>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 15px;">
            Ao utilizar suas credenciais, você declara ciência das seguintes normas de segurança da informação da PARABELLUM | 3Cliques:
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
        from: '3Cliques <contato@mail.3cliques.net>',
        to: [email],
        subject: 'Acesso Concedido - Termo de Responsabilidade',
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
