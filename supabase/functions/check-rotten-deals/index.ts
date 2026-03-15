import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLDS = {
  warning: 7,    // Primeiro alerta - 7 dias sem atualização
  critical: 14,  // Alerta crítico - 14 dias
  escalate: 21,  // Escalar para gestor - 21 dias
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const warningDate = new Date(now.getTime() - THRESHOLDS.warning * 24 * 60 * 60 * 1000);
    const criticalDate = new Date(now.getTime() - THRESHOLDS.critical * 24 * 60 * 60 * 1000);
    const escalateDate = new Date(now.getTime() - THRESHOLDS.escalate * 24 * 60 * 60 * 1000);

    // Buscar deals abertos que estão estagnados
    const { data: deals, error: dealsError } = await supabaseAdmin
      .from("deals")
      .select(`
        id,
        title,
        value,
        updated_at,
        assigned_to,
        became_rotten_at,
        rotten_notified_at,
        rotten_escalated_at,
        contacts(first_name, last_name),
        assigned_user:profiles!deals_assigned_to_fkey(id, full_name)
      `)
      .eq("status", "open")
      .lt("updated_at", warningDate.toISOString())
      .order("updated_at", { ascending: true });

    if (dealsError) {
      console.error("Error fetching deals:", dealsError);
      throw dealsError;
    }

    console.log(`Found ${deals?.length || 0} potentially rotten deals`);

    const notifications: Array<{
      user_id: string;
      title: string;
      message: string;
      type: string;
      metadata: { deal_id: string; action_url: string };
      read: boolean;
    }> = [];

    const dealsToUpdate: Array<{
      id: string;
      became_rotten_at?: string;
      rotten_notified_at?: string;
      rotten_escalated_at?: string;
    }> = [];

    // Buscar gestores (roles: admin, manager, sales_manager, general_manager)
    const { data: managers } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager", "sales_manager", "general_manager"]);

    const managerIds = managers?.map(m => m.user_id) || [];

    for (const deal of deals || []) {
      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(deal.updated_at).getTime()) / (24 * 60 * 60 * 1000)
      );

      const contact = Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts;
      const contactName = contact 
        ? `${contact.first_name} ${contact.last_name}`.trim()
        : "Cliente";

      const dealUpdate: typeof dealsToUpdate[0] = { id: deal.id };

      // Marcar como rotten se ainda não foi marcado
      if (!deal.became_rotten_at) {
        dealUpdate.became_rotten_at = now.toISOString();
      }

      // Determinar nível de urgência e enviar notificações apropriadas
      if (daysSinceUpdate >= THRESHOLDS.escalate) {
        // Escalar para gestores se ainda não foi escalado
        if (!deal.rotten_escalated_at && deal.assigned_to) {
          dealUpdate.rotten_escalated_at = now.toISOString();
          
          // Notificar todos os gestores
          for (const managerId of managerIds) {
            if (managerId !== deal.assigned_to) {
              notifications.push({
                user_id: managerId,
                title: "🚨 Escalação: Deal Crítico",
                message: `O negócio "${deal.title}" com ${contactName} está parado há ${daysSinceUpdate} dias. Valor: R$ ${(deal.value || 0).toLocaleString('pt-BR')}`,
                type: "deal_escalation",
              metadata: { deal_id: deal.id, action_url: `/deals?deal=${deal.id}` },
                read: false,
              });
            }
          }

          // Também notificar o vendedor sobre a escalação
          if (deal.assigned_to) {
            notifications.push({
              user_id: deal.assigned_to,
              title: "⚠️ Seu deal foi escalado",
              message: `O negócio "${deal.title}" foi escalado para a gestão por inatividade de ${daysSinceUpdate} dias`,
              type: "deal_escalated",
              metadata: { deal_id: deal.id, action_url: `/deals?deal=${deal.id}` },
              read: false,
            });
          }
        }
      } else if (daysSinceUpdate >= THRESHOLDS.critical) {
        // Notificação crítica para o vendedor
        const lastNotified = deal.rotten_notified_at ? new Date(deal.rotten_notified_at) : null;
        const daysSinceNotified = lastNotified 
          ? Math.floor((now.getTime() - lastNotified.getTime()) / (24 * 60 * 60 * 1000))
          : 999;

        // Notificar a cada 3 dias no nível crítico
        if (daysSinceNotified >= 3 && deal.assigned_to) {
          dealUpdate.rotten_notified_at = now.toISOString();
          notifications.push({
            user_id: deal.assigned_to,
            title: "🔴 Deal Crítico - Ação Urgente",
            message: `"${deal.title}" com ${contactName} está sem movimentação há ${daysSinceUpdate} dias!`,
            type: "deal_critical",
            metadata: { deal_id: deal.id, action_url: `/deals?deal=${deal.id}` },
            read: false,
          });
        }
      } else if (daysSinceUpdate >= THRESHOLDS.warning) {
        // Primeiro alerta (warning)
        if (!deal.rotten_notified_at && deal.assigned_to) {
          dealUpdate.rotten_notified_at = now.toISOString();
          notifications.push({
            user_id: deal.assigned_to,
            title: "⚠️ Deal Estagnado",
            message: `"${deal.title}" com ${contactName} está parado há ${daysSinceUpdate} dias. Que tal um follow-up?`,
            type: "deal_warning",
            metadata: { deal_id: deal.id, action_url: `/deals?deal=${deal.id}` },
            read: false,
          });
        }
      }

      if (Object.keys(dealUpdate).length > 1) {
        dealsToUpdate.push(dealUpdate);
      }
    }

    // Atualizar deals em batch
    for (const update of dealsToUpdate) {
      const { id, ...fields } = update;
      await supabaseAdmin
        .from("deals")
        .update(fields)
        .eq("id", id);
    }

    // Inserir notificações
    if (notifications.length > 0) {
      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Error inserting notifications:", notifError);
      }
    }

    console.log(`Processed ${dealsToUpdate.length} deals, sent ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        dealsProcessed: dealsToUpdate.length,
        notificationsSent: notifications.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in check-rotten-deals:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
