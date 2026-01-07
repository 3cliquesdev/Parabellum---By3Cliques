import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/v135/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    tags?: { name: string; value: string }[];
    click?: { link: string; timestamp: string };
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[resend-webhook] Received webhook');

    const payload: ResendWebhookEvent = await req.json();
    console.log('[resend-webhook] Event type:', payload.type);
    console.log('[resend-webhook] Email ID:', payload.data.email_id);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract customer_id and playbook_execution_id from tags
    let customerId: string | null = null;
    let playbookExecutionId: string | null = null;

    if (payload.data.tags && Array.isArray(payload.data.tags)) {
      const customerTag = payload.data.tags.find(t => t.name === 'customer_id');
      const playbookTag = payload.data.tags.find(t => t.name === 'playbook_execution_id');
      
      if (customerTag) customerId = customerTag.value;
      if (playbookTag) playbookExecutionId = playbookTag.value;
    }

    console.log('[resend-webhook] Customer ID:', customerId);
    console.log('[resend-webhook] Playbook Execution ID:', playbookExecutionId);

    // Map Resend event types to our event types
    const eventTypeMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delayed',
      'email.complained': 'complained',
      'email.bounced': 'bounced',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
    };

    const eventType = eventTypeMap[payload.type] || payload.type;

    // Build metadata
    const metadata: Record<string, any> = {
      from: payload.data.from,
      to: payload.data.to,
      subject: payload.data.subject,
      original_type: payload.type,
      event_timestamp: payload.created_at,
    };

    // Add click data if present
    if (payload.data.click) {
      metadata.click_url = payload.data.click.link;
      metadata.click_timestamp = payload.data.click.timestamp;
    }

    // Insert tracking event
    const { error: insertError } = await supabase
      .from('email_tracking_events')
      .insert({
        email_id: payload.data.email_id,
        customer_id: customerId,
        playbook_execution_id: playbookExecutionId,
        event_type: eventType,
        metadata,
      });

    if (insertError) {
      console.error('[resend-webhook] Error inserting event:', insertError);
      throw insertError;
    }

    console.log('[resend-webhook] Event tracked successfully:', eventType);

    // Update interaction if customer_id exists
    if (customerId && (eventType === 'opened' || eventType === 'clicked' || eventType === 'bounced')) {
      const { error: interactionError } = await supabase
        .from('interactions')
        .insert({
          customer_id: customerId,
          playbook_execution_id: playbookExecutionId,
          type: eventType === 'opened' ? 'email_opened' : eventType === 'clicked' ? 'email_clicked' : 'email_bounced',
          content: `Email ${eventType}: ${payload.data.subject}`,
          channel: 'email',
          metadata: {
            email_id: payload.data.email_id,
            ...metadata,
          }
        });

      if (interactionError) {
        console.warn('[resend-webhook] Warning: Failed to create interaction:', interactionError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[resend-webhook] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
