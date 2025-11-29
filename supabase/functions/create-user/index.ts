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
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🔐 Sistema Parabellum</h1>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e3a5f;">Bem-vindo ao Sistema Parabellum</h2>
          
          <p>Olá <strong>${full_name}</strong>,</p>
          <p>Seu acesso ao sistema Parabellum foi criado com sucesso.</p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>🔑 Senha Provisória:</strong> ${password}</p>
            <p style="margin: 5px 0;"><strong>👔 Cargo:</strong> ${roleLabels[role] || role}</p>
            <p style="margin: 5px 0;"><strong>🏢 Departamento:</strong> ${deptData?.name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>🔗 Link de Acesso:</strong> <a href="https://parabellum.work">https://parabellum.work</a></p>
          </div>
          
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">⚠️ TERMO DE RESPONSABILIDADE</h3>
            <p style="color: #78350f; font-size: 14px;">
              Ao utilizar este sistema, você declara estar ciente e concorda com as seguintes cláusulas:
            </p>
            
            <p style="color: #78350f; font-size: 14px;"><strong>1. INTRANSFERIBILIDADE</strong><br>
            As credenciais de acesso são pessoais e intransferíveis. É estritamente proibido compartilhar, emprestar ou ceder suas credenciais a terceiros, sob qualquer circunstância.</p>
            
            <p style="color: #78350f; font-size: 14px;"><strong>2. SIGILO DE DADOS</strong><br>
            Você se compromete a manter sigilo absoluto sobre todas as informações acessadas através deste sistema, incluindo dados de clientes, estratégias comerciais e informações internas.</p>
            
            <p style="color: #78350f; font-size: 14px;"><strong>3. RESPONSABILIDADE CIVIL E CRIMINAL</strong><br>
            O uso indevido das credenciais ou vazamento de informações poderá resultar em:<br>
            • Demissão por justa causa<br>
            • Responsabilização civil por danos causados<br>
            • Responsabilização criminal conforme legislação vigente (LGPD)</p>
            
            <p style="color: #78350f; font-size: 14px;"><strong>4. MONITORAMENTO</strong><br>
            Todas as ações realizadas neste sistema são registradas e monitoradas para fins de auditoria e segurança.</p>
          </div>
          
          <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #1e40af; margin: 0; font-size: 14px;">
              <strong>⚠️ IMPORTANTE:</strong> No primeiro acesso você será solicitado a validar seu email via código OTP e definir uma nova senha.
            </p>
          </div>
          
          <p style="color: #64748b; font-size: 12px; margin-top: 30px; text-align: center;">
            Ao fazer login, você confirma a leitura e aceite deste termo.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">
            Data de Emissão: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}<br>
            Criado por: ${user.email}
          </p>
        </div>
        
        <div style="background: #1e3a5f; padding: 20px; text-align: center;">
          <p style="color: #94a3b8; margin: 0; font-size: 12px;">
            Equipe de Segurança - Parabellum
          </p>
        </div>
      </div>
    `;

    try {
      const emailPayload: any = {
        from: 'Parabellum Security <sistema@parabellum.work>',
        to: [email],
        subject: '🔐 Seu Acesso ao Sistema Parabellum - Termo de Responsabilidade',
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
