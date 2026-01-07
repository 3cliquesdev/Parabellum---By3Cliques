import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageUserStatusRequest {
  user_id: string;
  action: 'block' | 'unblock' | 'archive' | 'unarchive';
  reason?: string;
}

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

    // Verificar autenticação e autorização
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário é admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem gerenciar status de usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, action, reason }: ManageUserStatusRequest = await req.json();

    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter informações do usuário alvo
    const { data: { user: targetUser }, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Proteções de segurança
    if (targetUser.email === 'ronildo@liberty.com') {
      return new Response(
        JSON.stringify({ error: 'O administrador principal não pode ser bloqueado ou arquivado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user_id === adminUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode bloquear/arquivar sua própria conta' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updateData: any = {};
    let authUpdate: any = {};

    switch (action) {
      case 'block':
        if (!reason) {
          return new Response(
            JSON.stringify({ error: 'Motivo do bloqueio é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('🔒 Iniciando bloqueio do usuário:', user_id);
        
        // Banir usuário no Auth (duração de ~100 anos = permanente)
        authUpdate = { ban_duration: '876000h' };
        
        updateData = {
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by: adminUser.id,
          block_reason: reason
        };
        break;

      case 'unblock':
        console.log('🔓 Iniciando desbloqueio do usuário:', user_id);
        
        // Remover banimento no Auth
        authUpdate = { ban_duration: 'none' };
        
        updateData = {
          is_blocked: false,
          blocked_at: null,
          blocked_by: null,
          block_reason: null
        };
        break;

      case 'archive':
        updateData = {
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: adminUser.id
        };
        break;

      case 'unarchive':
        updateData = {
          is_archived: false,
          archived_at: null,
          archived_by: null
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Atualizar Auth (para block/unblock)
    if (action === 'block' || action === 'unblock') {
      console.log('📡 Chamando Auth Admin API para', action, '- User ID:', user_id);
      
      try {
        // Usar Promise.race para adicionar timeout de 10 segundos
        const authUpdatePromise = supabaseAdmin.auth.admin.updateUserById(
          user_id,
          authUpdate
        );
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth Admin API timeout após 10 segundos')), 10000)
        );
        
        const { error: authUpdateError } = await Promise.race([
          authUpdatePromise,
          timeoutPromise
        ]) as any;

        if (authUpdateError) {
          console.error('❌ Erro ao atualizar Auth:', authUpdateError);
          throw authUpdateError;
        }
        
        console.log('✅ Auth atualizado com sucesso');
      } catch (error) {
        console.error('❌ Falha crítica ao atualizar Auth:', error);
        
        // Mesmo se Auth falhar, vamos atualizar o profile para manter consistência
        console.log('⚠️ Continuando para atualizar profile mesmo com falha no Auth');
      }
    }

    // Atualizar profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user_id);

    if (profileError) {
      console.error('Erro ao atualizar profile:', profileError);
      throw profileError;
    }

    // Log de auditoria
    await supabaseAdmin.from('audit_logs').insert({
      user_id: adminUser.id,
      action: `user_${action}`,
      table_name: 'profiles',
      record_id: user_id,
      new_data: updateData
    });

    console.log(`✅ Usuário ${action}ed com sucesso:`, user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário ${action === 'block' ? 'bloqueado' : action === 'unblock' ? 'desbloqueado' : action === 'archive' ? 'arquivado' : 'desarquivado'} com sucesso` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função manage-user-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
