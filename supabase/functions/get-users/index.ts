import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validar variáveis de ambiente dentro do handler (mais seguro)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[get-users] Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificar se o usuário que está chamando é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário possui um papel configurado
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Papel de usuário não configurado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os usuários com roles e profiles
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role, created_at')
      .in('role', [
        'admin',
        'general_manager',
        'manager',
        'sales_rep',
        'consultant',
        'support_agent',
        'support_manager',
        'financial_manager',
        'financial_agent',
        'cs_manager',
        'ecommerce_analyst'
      ]);

    if (rolesError) throw rolesError;
    if (!rolesData || rolesData.length === 0) {
      return new Response(
        JSON.stringify({ users: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar apenas os profiles dos usuários com roles
    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Buscar emails dos usuários via Admin API (com limite de concorrência)
    const batchSize = 10;
    const usersWithDetails: any[] = [];
    
    for (let i = 0; i < rolesData.length; i += batchSize) {
      const batch = rolesData.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (role) => {
          try {
            const { data: { user: userData }, error: userError } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
            
            if (userError || !userData) {
              console.warn('[get-users] Erro ao buscar usuário:', role.user_id);
              return null;
            }

            const profile = profilesMap.get(role.user_id);

            return {
              id: role.user_id,
              email: userData.email || 'N/A',
              created_at: role.created_at,
              role: role.role,
              full_name: profile?.full_name,
              job_title: profile?.job_title,
              avatar_url: profile?.avatar_url,
              department: profile?.department,
              is_blocked: profile?.is_blocked || false,
              blocked_at: profile?.blocked_at,
              block_reason: profile?.block_reason,
              is_archived: profile?.is_archived || false,
              archived_at: profile?.archived_at,
              availability_status: profile?.availability_status || 'offline',
            };
          } catch (err) {
            console.warn('[get-users] Erro ao processar usuário:', role.user_id, err);
            return null;
          }
        })
      );
      usersWithDetails.push(...batchResults);
    }

    const users = usersWithDetails.filter(u => u !== null);

    console.log('[get-users] Retornando', users.length, 'usuários');

    return new Response(
      JSON.stringify({ users }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-users] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
