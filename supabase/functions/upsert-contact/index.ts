import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpsertContactRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company?: string;
  organization_id?: string;
  assigned_to?: string;
  source?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Parse request body
    const body: UpsertContactRequest = await req.json();

    // Validação básica
    if (!body.email || !body.first_name || !body.last_name) {
      console.error('[UPSERT-CONTACT] Missing required fields:', body);
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: email, first_name, last_name' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Sanitização de email
    const sanitizedEmail = body.email.toLowerCase().trim();

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      console.error('[UPSERT-CONTACT] Invalid email format:', sanitizedEmail);
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[UPSERT-CONTACT] Processing: ${sanitizedEmail}`);

    // Chamar a database function
    const { data, error } = await supabase.rpc('upsert_contact_with_interaction', {
      p_email: sanitizedEmail,
      p_first_name: body.first_name.trim(),
      p_last_name: body.last_name.trim(),
      p_phone: body.phone?.trim() || null,
      p_company: body.company?.trim() || null,
      p_organization_id: body.organization_id || null,
      p_assigned_to: body.assigned_to || null,
      p_source: body.source || 'form',
    });

    if (error) {
      console.error('[UPSERT-CONTACT] Database error:', error);
      throw error;
    }

    const result = data[0];
    console.log(`[UPSERT-CONTACT] Success:`, {
      contact_id: result.contact_id,
      is_new: result.is_new_contact,
      previous_status: result.previous_status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: result.contact_id,
        is_new_contact: result.is_new_contact,
        previous_status: result.previous_status,
        message: result.message,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[UPSERT-CONTACT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar contato';
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
