import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🕐 CRON: Processing scheduled reports...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0-6 (Sunday-Saturday)
    const currentDate = now.getDate(); // 1-31

    // Fetch scheduled reports that should run now
    let query = supabaseClient
      .from('scheduled_reports')
      .select('*')
      .eq('is_active', true)
      .eq('hour', currentHour);

    const { data: reports, error } = await query;

    if (error) {
      console.error('Error fetching scheduled reports:', error);
      throw error;
    }

    console.log(`Found ${reports?.length || 0} scheduled reports to process`);

    let processed = 0;
    let sent = 0;
    let errors = 0;

    for (const report of reports || []) {
      try {
        // Check if should run based on frequency
        const shouldRun = checkShouldRun(report, currentDay, currentDate);
        
        if (!shouldRun) {
          console.log(`Skipping report ${report.id} - not scheduled for now`);
          continue;
        }

        // Check if already sent today
        if (report.last_sent_at) {
          const lastSent = new Date(report.last_sent_at);
          const today = new Date();
          if (
            lastSent.getFullYear() === today.getFullYear() &&
            lastSent.getMonth() === today.getMonth() &&
            lastSent.getDate() === today.getDate()
          ) {
            console.log(`Report ${report.id} already sent today`);
            continue;
          }
        }

        processed++;

        // Generate the report by calling generate-report function internally
        console.log(`Generating report: ${report.report_name}`);
        
        const reportResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            report_type: report.report_type,
            filters: report.filters || {},
            format: report.format,
          }),
        });

        if (!reportResponse.ok) {
          throw new Error(`Failed to generate report: ${reportResponse.statusText}`);
        }

        const reportContent = await reportResponse.text();

        // Send email with attachment using Resend API directly
        console.log(`Sending report to: ${report.email}`);
        
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
          throw new Error('RESEND_API_KEY not configured');
        }

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Seu Armazém Drop Relatórios <sistema@parabellum.work>',
            to: [report.email],
            subject: `📊 ${report.report_name} - ${formatDate(now)}`,
            html: `
              <h2>Relatório Automático</h2>
              <p>Olá,</p>
              <p>Segue em anexo o relatório <strong>${report.report_name}</strong> gerado automaticamente.</p>
              <p><strong>Período:</strong> ${formatDate(now)}</p>
              <p><strong>Frequência:</strong> ${translateFrequency(report.frequency)}</p>
              <p>Este relatório é enviado automaticamente conforme sua configuração na Central de Relatórios.</p>
              <hr />
              <p style="color: #666; font-size: 12px;">
                Para gerenciar seus relatórios agendados, acesse a Central de Relatórios no CRM.
              </p>
            `,
            attachments: [
              {
                filename: `${report.report_name}_${Date.now()}.${report.format}`,
                content: btoa(reportContent),
              },
            ],
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          throw new Error(`Failed to send email: ${errorText}`);
        }

        const emailResult = await emailResponse.json();
        console.log('Email sent:', emailResult);

        // Update last_sent_at
        await supabaseClient
          .from('scheduled_reports')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', report.id);

        sent++;

      } catch (reportError: any) {
        console.error(`Error processing report ${report.id}:`, reportError);
        errors++;
      }
    }

    console.log(`✅ CRON completed: ${processed} processed, ${sent} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        errors,
        timestamp: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in CRON job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function checkShouldRun(report: any, currentDay: number, currentDate: number): boolean {
  switch (report.frequency) {
    case 'daily':
      return true;
    
    case 'weekly':
      return report.day_of_week === currentDay;
    
    case 'monthly':
      return report.day_of_month === currentDate;
    
    default:
      return false;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function translateFrequency(frequency: string): string {
  const map: any = {
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
  };
  return map[frequency] || frequency;
}
