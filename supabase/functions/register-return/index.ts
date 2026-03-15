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

    const { email, external_order_id, tracking_code_return, reason, description } = await req.json();

    if (!email || !external_order_id || !reason) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: email, external_order_id, reason' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validReasons = ['defeito', 'arrependimento', 'troca', 'nao_recebido', 'outro'];
    if (!validReasons.includes(reason)) {
      return new Response(JSON.stringify({ error: 'Motivo inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Buscar contact pelo email
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('email', email)
      .maybeSingle();

    const contactId = contact?.id || null;
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : email;

    // 2. Buscar deal pelo external_order_id
    let trackingCodeOriginal: string | null = null;
    const dealQuery = supabase
      .from('deals')
      .select('id, tracking_code, external_order_id')
      .eq('external_order_id', external_order_id);

    if (contactId) {
      dealQuery.eq('contact_id', contactId);
    }

    const { data: deal } = await dealQuery.maybeSingle();

    if (deal?.tracking_code) {
      trackingCodeOriginal = deal.tracking_code;
    }

    // 3. Verificar duplicata (admin já criou para este pedido)
    const { data: existingReturn } = await supabase
      .from('returns')
      .select('id')
      .eq('external_order_id', external_order_id)
      .eq('created_by', 'admin')
      .maybeSingle();

    if (existingReturn) {
      return new Response(JSON.stringify({
        duplicate: true,
        return_id: existingReturn.id,
        message: 'Já existe um cadastro para este pedido registrado pela nossa equipe. Deseja vincular ao seu perfil?',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Inserir na tabela returns
    const { data: newReturn, error: insertError } = await supabase
      .from('returns')
      .insert({
        contact_id: contactId,
        external_order_id,
        tracking_code_original: trackingCodeOriginal,
        tracking_code_return: tracking_code_return || null,
        reason,
        description: description || null,
        status: 'pending',
        created_by: 'customer',
        registered_email: email,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[register-return] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao registrar devolução' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const protocol = newReturn.id.substring(0, 8).toUpperCase();

    // 5. Disparar email de confirmação
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          to_name: contactName,
          subject: `Sua solicitação de devolução foi recebida — Protocolo ${protocol}`,
          html: `
            <h2>Solicitação de Devolução Recebida</h2>
            <p>Olá ${contactName},</p>
            <p>Recebemos sua solicitação de devolução para o pedido <strong>${external_order_id}</strong>.</p>
            <p><strong>Protocolo:</strong> ${protocol}</p>
            <p><strong>Motivo:</strong> ${reason}</p>
            ${description ? `<p><strong>Descrição:</strong> ${description}</p>` : ''}
            <p>Nossa equipe analisará sua solicitação e retornará em breve.</p>
            <p>Atenciosamente,<br/>Equipe de Suporte</p>
          `,
          customer_id: contactId,
          useRawHtml: true,
        },
      });
    } catch (emailErr) {
      console.error('[register-return] Email error (non-blocking):', emailErr);
    }

    return new Response(JSON.stringify({
      success: true,
      return_id: newReturn.id,
      protocol,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[register-return] Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
