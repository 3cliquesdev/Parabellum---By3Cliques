import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Verificar se é admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os usuários com roles e profiles
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role, created_at');

    if (rolesError) throw rolesError;

    // Buscar profiles
    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('*');

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Buscar emails dos usuários via Admin API
    const usersWithDetails = await Promise.all(
      rolesData.map(async (role) => {
        const { data: { user: userData }, error: userError } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        
        if (userError || !userData) {
          console.error('Erro ao buscar usuário:', role.user_id, userError);
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
        };
      })
    );

    const users = usersWithDetails.filter(u => u !== null);

    return new Response(
      JSON.stringify({ users }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função get-users:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
