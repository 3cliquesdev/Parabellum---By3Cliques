import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_name: string;
  api_url: string;
  api_token: string;
  status: string;
  consecutive_failures: number;
  auto_restart_enabled: boolean;
}

interface EvolutionInstanceStatus {
  instanceName: string;
  state: string; // 'open', 'close', 'connecting'
}

// Buscar status real da instância na Evolution API
async function fetchInstanceStatus(apiUrl: string, apiToken: string, instanceName: string): Promise<EvolutionInstanceStatus | null> {
  try {
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/instance/connectionState/${instanceName}`;
    
    console.log(`[check-whatsapp-status] 🔍 Consultando API: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[check-whatsapp-status] ❌ API retornou ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[check-whatsapp-status] 📦 Resposta API:`, JSON.stringify(data));
    
    return {
      instanceName: instanceName,
      state: data?.instance?.state || data?.state || 'unknown',
    };
  } catch (error) {
    console.error(`[check-whatsapp-status] ❌ Erro ao consultar API:`, error);
    return null;
  }
}

// Tentar reiniciar instância na Evolution API
async function restartInstance(apiUrl: string, apiToken: string, instanceName: string): Promise<boolean> {
  try {
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/instance/restart/${instanceName}`;
    
    console.log(`[check-whatsapp-status] 🔄 Tentando restart: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apiToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[check-whatsapp-status] ❌ Restart falhou: ${response.status}`);
      return false;
    }

    console.log(`[check-whatsapp-status] ✅ Restart iniciado com sucesso`);
    return true;
  } catch (error) {
    console.error(`[check-whatsapp-status] ❌ Erro no restart:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-whatsapp-status] 🔍 Iniciando verificação ATIVA de status WhatsApp...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Buscar todas as instâncias WhatsApp
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('id, name, instance_name, api_url, api_token, status, consecutive_failures, auto_restart_enabled');

    if (instancesError) {
      console.error('[check-whatsapp-status] ❌ Erro ao buscar instâncias:', instancesError);
      throw instancesError;
    }

    console.log(`[check-whatsapp-status] Encontradas ${instances?.length || 0} instâncias`);

    const results: Array<{
      instance_name: string;
      previous_status: string;
      current_status: string;
      action_taken: string;
    }> = [];

    let alertsSent = 0;
    let restartsAttempted = 0;

    for (const instance of (instances || []) as WhatsAppInstance[]) {
      console.log(`[check-whatsapp-status] 📍 Verificando: ${instance.name} (${instance.instance_name})`);
      
      // Consultar status REAL na Evolution API
      const apiStatus = await fetchInstanceStatus(
        instance.api_url, 
        instance.api_token, 
        instance.instance_name
      );

      const previousStatus = instance.status;
      const currentStatus = apiStatus?.state || 'unknown';
      const isConnected = currentStatus === 'open';
      const wasConnected = previousStatus === 'open';

      let actionTaken = 'none';

      // Status mudou ou desconectado
      if (currentStatus !== previousStatus) {
        console.log(`[check-whatsapp-status] 🔄 Status mudou: ${previousStatus} → ${currentStatus}`);

        // Atualizar status no banco
        const { error: updateError } = await supabase
          .from('whatsapp_instances')
          .update({
            status: isConnected ? 'open' : 'disconnected',
            last_health_check: new Date().toISOString(),
            consecutive_failures: isConnected ? 0 : (instance.consecutive_failures || 0) + 1,
          })
          .eq('id', instance.id);

        if (updateError) {
          console.error(`[check-whatsapp-status] ❌ Erro ao atualizar status:`, updateError);
        }

        // Registrar no log de saúde
        await supabase
          .from('whatsapp_instance_health_log')
          .insert({
            instance_id: instance.id,
            status: isConnected ? 'connected' : 'disconnected',
            api_response: apiStatus,
          });

        // Se desconectou, enviar alerta e tentar restart
        if (!isConnected && wasConnected) {
          actionTaken = 'alert_sent';
          alertsSent++;

          // Enviar alerta para admins
          await supabase.functions.invoke('send-admin-alert', {
            body: {
              type: 'whatsapp_disconnected',
              message: `🚨 WhatsApp "${instance.name}" desconectou!`,
              error: `Instância ${instance.instance_name} mudou de ${previousStatus} para ${currentStatus}`,
            },
          });

          // Tentar auto-restart se habilitado e menos de 3 falhas consecutivas
          if (instance.auto_restart_enabled && (instance.consecutive_failures || 0) < 3) {
            console.log(`[check-whatsapp-status] 🔄 Tentando auto-restart...`);
            restartsAttempted++;

            const restartSuccess = await restartInstance(
              instance.api_url,
              instance.api_token,
              instance.instance_name
            );

            // Registrar tentativa de restart
            await supabase
              .from('whatsapp_instance_health_log')
              .insert({
                instance_id: instance.id,
                status: restartSuccess ? 'restart_attempted' : 'restart_failed',
                restart_attempts: (instance.consecutive_failures || 0) + 1,
                error_message: restartSuccess ? null : 'Restart request failed',
              });

            actionTaken = restartSuccess ? 'restart_attempted' : 'restart_failed';

            // Aguardar 10 segundos e verificar novamente
            if (restartSuccess) {
              await new Promise(resolve => setTimeout(resolve, 10000));
              
              const postRestartStatus = await fetchInstanceStatus(
                instance.api_url,
                instance.api_token,
                instance.instance_name
              );

              if (postRestartStatus?.state === 'open') {
                actionTaken = 'restart_success';
                
                // Atualizar status para conectado
                await supabase
                  .from('whatsapp_instances')
                  .update({
                    status: 'open',
                    consecutive_failures: 0,
                  })
                  .eq('id', instance.id);

                // Registrar sucesso
                await supabase
                  .from('whatsapp_instance_health_log')
                  .insert({
                    instance_id: instance.id,
                    status: 'restart_success',
                  });

                // Notificar sucesso
                await supabase.functions.invoke('send-admin-alert', {
                  body: {
                    type: 'whatsapp_reconnected',
                    message: `✅ WhatsApp "${instance.name}" reconectado automaticamente!`,
                    error: null,
                  },
                });
              }
            }
          } else if ((instance.consecutive_failures || 0) >= 3) {
            // Alerta crítico após 3 falhas
            await supabase.functions.invoke('send-admin-alert', {
              body: {
                type: 'whatsapp_critical',
                message: `🔴 CRÍTICO: WhatsApp "${instance.name}" falhou ${instance.consecutive_failures} vezes consecutivas!`,
                error: `Auto-restart desabilitado após múltiplas falhas. Intervenção manual necessária.`,
              },
            });
            actionTaken = 'critical_alert';
          }
        } else if (isConnected && !wasConnected) {
          // Reconectou manualmente
          actionTaken = 'reconnected';
          
          // Resolver logs pendentes
          await supabase
            .from('whatsapp_instance_health_log')
            .update({ resolved_at: new Date().toISOString() })
            .eq('instance_id', instance.id)
            .is('resolved_at', null);
        }
      } else {
        // Status não mudou, apenas atualizar timestamp
        await supabase
          .from('whatsapp_instances')
          .update({ last_health_check: new Date().toISOString() })
          .eq('id', instance.id);
        
        actionTaken = 'checked';
      }

      results.push({
        instance_name: instance.instance_name,
        previous_status: previousStatus,
        current_status: currentStatus,
        action_taken: actionTaken,
      });
    }

    console.log(`[check-whatsapp-status] ✅ Verificação completa. Alertas: ${alertsSent}, Restarts: ${restartsAttempted}`);

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: new Date().toISOString(),
        instances_checked: results.length,
        alerts_sent: alertsSent,
        restarts_attempted: restartsAttempted,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-whatsapp-status] ❌ Erro crítico:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
