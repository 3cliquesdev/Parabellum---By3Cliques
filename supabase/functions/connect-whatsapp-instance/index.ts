import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/v135/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_id } = await req.json();
    
    console.log('[connect-whatsapp-instance] Processing instance:', instance_id);
    
    // Buscar instância no banco com service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instance, error: fetchError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (fetchError || !instance) {
      console.error('[connect-whatsapp-instance] Instance not found:', fetchError);
      throw new Error("Instance not found");
    }

    console.log('[connect-whatsapp-instance] Instance data:', {
      name: instance.name,
      api_url: instance.api_url,
      instance_name: instance.instance_name
    });

    // Normalizar a URL: remover /manager ou qualquer path extra
    let baseUrl = instance.api_url;
    if (baseUrl.includes('/manager')) {
      baseUrl = baseUrl.split('/manager')[0];
    }
    // Garantir que não tem trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');

    // Limpar o token (remover espaços em branco)
    const apiToken = instance.api_token.trim();
    
    console.log('[connect-whatsapp-instance] Base URL normalizada:', baseUrl);
    console.log('[connect-whatsapp-instance] Token length:', apiToken.length);
    console.log('[connect-whatsapp-instance] Token prefix:', apiToken.substring(0, 8) + '...');

    // Verificar se a instância já existe na Evolution API
    let result: any;
    let shouldCreateInstance = true;

    try {
      const fetchUrl = `${baseUrl}/instance/fetchInstances`;
      console.log('[connect-whatsapp-instance] Calling Evolution API (fetchInstances):', fetchUrl);

      const fetchResponse = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          "apikey": apiToken,
        },
      });

      if (fetchResponse.ok) {
        const instances = await fetchResponse.json();
        console.log('[connect-whatsapp-instance] Existing instances result:', instances);

        if (Array.isArray(instances)) {
          const existing = instances.find((item: any) => {
            // Evolution API may return name in different shapes
            const itemName = item.instance?.instanceName || item.name || item.instanceName;
            return itemName === instance.instance_name;
          });

          if (existing) {
            shouldCreateInstance = false;
            const connectUrl = `${baseUrl}/instance/connect/${encodeURIComponent(instance.instance_name)}`;
            console.log('[connect-whatsapp-instance] Calling Evolution API (connect):', connectUrl);

            const connectResponse = await fetch(connectUrl, {
              method: "GET",
              headers: {
                "apikey": apiToken,
              },
            });

            if (!connectResponse.ok) {
              const errorText = await connectResponse.text();
              console.error('[connect-whatsapp-instance] Evolution API connect error:', {
                status: connectResponse.status,
                statusText: connectResponse.statusText,
                body: errorText,
              });
              throw new Error(`Failed to connect instance: ${connectResponse.statusText}`);
            }

            result = await connectResponse.json();
            console.log('[connect-whatsapp-instance] Evolution API connect response:', result);
          }
        }
      } else {
        const errorText = await fetchResponse.text();
        console.error('[connect-whatsapp-instance] Evolution API fetchInstances error:', {
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          body: errorText,
        });
      }
    } catch (e) {
      console.error('[connect-whatsapp-instance] Error while fetching instances:', e);
    }

    // Se não encontrou instância existente, criar uma nova
    if (shouldCreateInstance) {
      const evolutionUrl = `${baseUrl}/instance/create`;
      console.log('[connect-whatsapp-instance] Calling Evolution API (create):', evolutionUrl);

      const response = await fetch(evolutionUrl, {
        method: "POST",
        headers: {
          "apikey": apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instanceName: instance.instance_name,
          qrcode: true,
          webhook: {
            enabled: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[connect-whatsapp-instance] Evolution API create error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to create instance: ${response.statusText}`);
      }

      result = await response.json();
      console.log('[connect-whatsapp-instance] Evolution API create response:', result);
    }

    // Configurar webhook automaticamente (após criar ou conectar)
    // CRÍTICO: NÃO silenciar erros - webhook é essencial para receber mensagens
    const webhookSetUrl = `${baseUrl}/webhook/set/${encodeURIComponent(instance.instance_name)}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const webhookTargetUrl = `${supabaseUrl}/functions/v1/handle-whatsapp-event`;
    
    console.log('[connect-whatsapp-instance] 🔧 Configuring webhook...');
    console.log('[connect-whatsapp-instance] Webhook SET URL:', webhookSetUrl);
    console.log('[connect-whatsapp-instance] Target URL:', webhookTargetUrl);
    
    let webhookConfigured = false;
    let webhookError: string | null = null;
    
    // Tentar configurar webhook com retries
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[connect-whatsapp-instance] Webhook config attempt ${attempt}/3...`);
        
        const webhookResponse = await fetch(webhookSetUrl, {
          method: "POST",
          headers: {
            "apikey": apiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: webhookTargetUrl,
            enabled: true,
            events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "QRCODE_UPDATED"],
            webhook_by_events: false,
          }),
        });

        const responseText = await webhookResponse.text();
        console.log(`[connect-whatsapp-instance] Webhook response ${attempt}:`, {
          status: webhookResponse.status,
          body: responseText,
        });

        if (webhookResponse.ok) {
          webhookConfigured = true;
          console.log('[connect-whatsapp-instance] ✅ Webhook configured successfully!');
          break;
        }
        
        webhookError = `HTTP ${webhookResponse.status}: ${responseText}`;
        
        // Esperar antes de retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (e) {
        webhookError = e instanceof Error ? e.message : String(e);
        console.error(`[connect-whatsapp-instance] Webhook attempt ${attempt} failed:`, webhookError);
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // Log resultado final do webhook
    if (!webhookConfigured) {
      console.error('[connect-whatsapp-instance] ⚠️ WEBHOOK NOT CONFIGURED after 3 attempts:', webhookError);
      // Adicionar aviso no resultado mas não falhar a conexão
      result.webhookWarning = `Webhook não configurado: ${webhookError}. Use o botão "Reconfigurar Webhook" para tentar novamente.`;
    }

    // Atualizar QR Code no banco (se disponível)
    // Evolution API retorna QR Code em formatos diferentes:
    // - /instance/create: result.qrcode.base64
    // - /instance/connect: result.base64
    const qrCodeBase64 = result?.qrcode?.base64 || result?.base64;
    
    if (qrCodeBase64) {
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({
          qr_code_base64: qrCodeBase64,
          status: "qr_pending",
        })
        .eq("id", instance_id);

      if (updateError) {
        console.error('[connect-whatsapp-instance] Failed to update QR code:', updateError);
      } else {
        console.log('[connect-whatsapp-instance] QR code updated successfully');
      }
    } else {
      console.warn('[connect-whatsapp-instance] No QR code found in Evolution response', result);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[connect-whatsapp-instance] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
