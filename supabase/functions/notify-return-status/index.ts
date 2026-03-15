import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_TEMPLATES: Record<string, { subject: string; heading: string; message: string }> = {
  pending: {
    subject: 'Sua solicitação de devolução foi recebida',
    heading: 'Solicitação de Devolução Recebida',
    message: 'Recebemos sua solicitação de devolução. Nossa equipe analisará e retornará em breve.',
  },
  refunded: {
    subject: 'Seu reembolso foi processado',
    heading: 'Reembolso Processado',
    message: 'Seu reembolso foi processado com sucesso. O valor será creditado conforme o prazo da sua operadora.',
  },
  rejected: {
    subject: 'Sua solicitação de devolução foi recusada',
    heading: 'Devolução Recusada',
    message: 'Infelizmente, sua solicitação de devolução foi recusada após análise da nossa equipe.',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { return_id, new_status } = body;

    if (!return_id || !new_status) {
      return new Response(JSON.stringify({ error: 'return_id e new_status obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const template = STATUS_TEMPLATES[new_status];
    if (!template) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Status sem template de email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar dados completos da devolução
    const { data: returnData, error: fetchError } = await supabase
      .from('returns')
      .select('*, contacts(first_name, last_name, email)')
      .eq('id', return_id)
      .single();

    if (fetchError || !returnData) {
      console.error('[notify-return-status] Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Devolução não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determinar email e nome do destinatário
    const recipientEmail = returnData.contacts?.email || returnData.registered_email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Sem email para enviar' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientName = returnData.contacts
      ? `${returnData.contacts.first_name} ${returnData.contacts.last_name}`
      : recipientEmail;

    // Buscar label do motivo
    const { data: reasonData } = await supabase
      .from('return_reasons')
      .select('label')
      .eq('key', returnData.reason)
      .maybeSingle();

    const reasonLabel = reasonData?.label || returnData.reason;
    const protocol = returnData.id.substring(0, 8).toUpperCase();

    const html = `
      <h2>${template.heading}</h2>
      <p>Olá ${recipientName},</p>
      <p>${template.message}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Protocolo</td>
          <td style="padding: 6px 0; font-weight: 600; font-size: 14px;">${protocol}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Pedido</td>
          <td style="padding: 6px 0; font-weight: 600; font-size: 14px;">${returnData.external_order_id}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Motivo</td>
          <td style="padding: 6px 0; font-size: 14px;">${reasonLabel}</td>
        </tr>
        ${returnData.tracking_code_original ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Rastreio Original</td>
          <td style="padding: 6px 0; font-size: 14px;">${returnData.tracking_code_original}</td>
        </tr>` : ''}
        ${returnData.tracking_code_return ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Rastreio Devolução</td>
          <td style="padding: 6px 0; font-size: 14px;">${returnData.tracking_code_return}</td>
        </tr>` : ''}
      </table>
      ${returnData.description ? `
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Descrição</p>
      <p style="font-size: 14px;">${returnData.description}</p>` : ''}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
      <p style="font-size: 14px;">Atenciosamente,<br/>Equipe de Suporte</p>
    `;

    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmail,
          to_name: recipientName,
          subject: `${template.subject} — Protocolo ${protocol}`,
          html,
          customer_id: returnData.contact_id,
          useRawHtml: true,
        },
      });
    } catch (emailErr) {
      console.error('[notify-return-status] Email error (non-blocking):', emailErr);
    }

    return new Response(JSON.stringify({ success: true, sent_to: recipientEmail }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[notify-return-status] Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
