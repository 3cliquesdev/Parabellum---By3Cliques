import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateUserRequest {
  user_id: string;
  role?: 'admin' | 'general_manager' | 'manager' | 'sales_rep' | 'consultant' | 'support_agent' | 'support_manager' | 'financial_manager' | 'financial_agent' | 'cs_manager' | 'ecommerce_analyst';
  department?: string;
  full_name?: string;
  job_title?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing environment variables');
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the JWT from the request header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify the JWT and get user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[update-user] Request from user:', user.id);

    // Check if requesting user has permission to manage users
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError) {
      console.error('[update-user] Role check failed:', roleError);
      throw new Error('Unable to verify permissions');
    }

    // Admin always has permission
    const isAdmin = roleData?.role === 'admin';

    // Check permission in role_permissions table
    const { data: permission } = await supabaseAdmin
      .from('role_permissions')
      .select('enabled')
      .eq('role', roleData?.role)
      .eq('permission_key', 'users.manage')
      .single();

    const hasPermission = isAdmin || permission?.enabled === true;

    if (!hasPermission) {
      console.error('[update-user] Permission denied for role:', roleData?.role);
      throw new Error('Você não tem permissão para atualizar usuários');
    }

    // Parse request body
    const requestData: UpdateUserRequest = await req.json();
    console.log('[update-user] Update request:', requestData);

    const { user_id, role, department, full_name, job_title } = requestData;

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Validate role if provided
    const allowedRoles = ['admin', 'general_manager', 'manager', 'sales_rep', 'consultant', 'support_agent', 'support_manager', 'financial_manager', 'financial_agent', 'cs_manager', 'ecommerce_analyst'];
    if (role && !allowedRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${allowedRoles.join(', ')}`);
    }

    // Update user_roles table if role is provided
    if (role) {
      // Buscar role anterior para detectar mudança de consultant → outro
      const { data: previousRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user_id)
        .single();

      const wasConsultant = previousRole?.role === 'consultant';
      const isNoLongerConsultant = wasConsultant && role !== 'consultant';

      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('user_id', user_id);

      if (roleUpdateError) {
        console.error('[update-user] Error updating role:', roleUpdateError);
        throw new Error('Failed to update user role');
      }
      console.log('[update-user] Role updated successfully');

      // Se deixou de ser consultant, limpar consultant_id dos contatos vinculados
      if (isNoLongerConsultant) {
        const { data: affected, error: cleanupError } = await supabaseAdmin
          .from('contacts')
          .update({ consultant_id: null })
          .eq('consultant_id', user_id)
          .select('id');

        if (cleanupError) {
          console.error('[update-user] Error cleaning up consultant_id:', cleanupError);
        } else {
          console.log(`[update-user] Cleared consultant_id from ${affected?.length || 0} contacts (user ${user_id} is no longer a consultant)`);
        }
      }
    }

    // Update profiles table if any profile data is provided
    if (department || full_name || job_title) {
      const profileUpdates: any = { updated_at: new Date().toISOString() };
      if (department) profileUpdates.department = department;
      if (full_name) profileUpdates.full_name = full_name;
      if (job_title) profileUpdates.job_title = job_title;

      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user_id);

      if (profileUpdateError) {
        console.error('[update-user] Error updating profile:', profileUpdateError);
        throw new Error('Failed to update user profile');
      }
      console.log('[update-user] Profile updated successfully');
    }

    console.log('[update-user] User updated successfully:', user_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User updated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[update-user] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
