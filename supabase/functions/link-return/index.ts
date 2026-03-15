import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { return_id, email } = await req.json();

    if (!return_id || !email) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: return_id, email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar contact pelo email
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('email', email)
      .maybeSingle();

    if (!contact) {
      return new Response(JSON.stringify({ error: 'Contato não encontrado para este email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atualizar return com contact_id e registered_email
    const { error: updateError } = await supabase
      .from('returns')
      .update({
        contact_id: contact.id,
        registered_email: email,
      })
      .eq('id', return_id);

    if (updateError) {
      console.error('[link-return] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao vincular devolução' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disparar email de confirmação
    const contactName = `${contact.first_name} ${contact.last_name}`;
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          to_name: contactName,
          subject: 'Sua devolução foi vinculada ao seu perfil',
          html: `
            <h2>Devolução Vinculada</h2>
            <p>Olá ${contactName},</p>
            <p>Sua devolução foi vinculada com sucesso ao seu perfil.</p>
            <p>Você pode acompanhar o status pelo portal do cliente.</p>
            <p>Atenciosamente,<br/>Equipe de Suporte</p>
          `,
          customer_id: contact.id,
          useRawHtml: true,
        },
      });
    } catch (emailErr) {
      console.error('[link-return] Email error (non-blocking):', emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[link-return] Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
