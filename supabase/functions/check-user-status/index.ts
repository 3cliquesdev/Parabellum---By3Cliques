import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveDepartments } from "../_shared/department-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckUserStatusRequest {
  email: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const depts = await resolveDepartments(supabase);
    const body: CheckUserStatusRequest = await req.json();

    if (!body.email) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Buscar contato pelo email
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, avatar_url, assigned_to, consultant_id, status')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[CHECK-USER-STATUS] Database error:', error);
      throw error;
    }

    // Se não encontrou contato
    if (!contact) {
      return new Response(
        JSON.stringify({
          exists: false,
          recommended_department_id: depts.COMERCIAL_ID, // Leads novos vão para Comercial
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente existe - determinar departamento recomendado
    let recommendedDepartmentId = depts.SUPORTE_ID;

    // Se tem consultor vinculado, buscar o departamento dele
    if (contact.consultant_id) {
      const { data: consultant } = await supabase
        .from('profiles')
        .select('department')
        .eq('id', contact.consultant_id)
        .single();

      if (consultant?.department) {
        recommendedDepartmentId = consultant.department;
      }
    }

    return new Response(
      JSON.stringify({
        exists: true,
        contact: {
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email, // ADICIONADO: Email necessário para identity
          avatar_url: contact.avatar_url,
          assigned_to: contact.assigned_to,
          consultant_id: contact.consultant_id,
          status: contact.status,
        },
        recommended_department_id: recommendedDepartmentId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CHECK-USER-STATUS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar usuário';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
