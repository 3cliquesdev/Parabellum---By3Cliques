import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tempo de inatividade para marcar como offline (5 minutos)
const INACTIVITY_THRESHOLD_MINUTES = 5;

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

    console.log("[check-inactive-users] Starting inactive users check");

    // Calcular timestamp de corte (5 minutos atrás)
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - INACTIVITY_THRESHOLD_MINUTES);
    const cutoffTimestamp = cutoffTime.toISOString();

    console.log(`[check-inactive-users] Cutoff time: ${cutoffTimestamp}`);

    // Buscar usuários online/busy que não atualizaram há mais de 5 minutos
    // IMPORTANTE: Não redistribui conversas - apenas marca offline por inatividade
    const { data: inactiveUsers, error: selectError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, availability_status, last_status_change")
      .in("availability_status", ["online", "busy"])
      .lt("last_status_change", cutoffTimestamp);

    if (selectError) {
      console.error("[check-inactive-users] Error fetching inactive users:", selectError);
      throw selectError;
    }

    console.log(`[check-inactive-users] Found ${inactiveUsers?.length || 0} inactive users`);

    if (inactiveUsers && inactiveUsers.length > 0) {
      const userIds = inactiveUsers.map(u => u.id);
      
      console.log("[check-inactive-users] Users to mark offline:", inactiveUsers.map(u => ({
        name: u.full_name,
        lastSeen: u.last_status_change,
      })));

      // Marcar todos como offline (mas NÃO como manual_offline)
      // Conversas permanecem atribuídas ao agente!
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          availability_status: "offline",
          last_status_change: new Date().toISOString(),
          manual_offline: false, // Indica que foi por inatividade, não manual
        })
        .in("id", userIds);

      if (updateError) {
        console.error("[check-inactive-users] Error updating users:", updateError);
        throw updateError;
      }

      console.log(`[check-inactive-users] Marked ${userIds.length} users as offline (conversations NOT redistributed)`);
      console.log("[check-inactive-users] ℹ️ Conversations stay with agents - redistribution only happens on manual offline click");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        usersMarkedOffline: inactiveUsers?.length || 0,
        note: "Conversations NOT redistributed - only manual offline triggers redistribution",
        cutoffTime: cutoffTimestamp,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-inactive-users] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
