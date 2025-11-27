import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionWebhook {
  event: 'MESSAGES_UPSERT' | 'CONNECTION_UPDATE' | 'QRCODE_UPDATED';
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: {
        caption?: string;
      };
      videoMessage?: {
        caption?: string;
      };
      documentMessage?: {
        caption?: string;
      };
    };
    messageTimestamp?: number;
  };
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
      }
    );

    const body = await req.json();
    console.log('[handle-whatsapp-event] 🔥 Raw payload:', JSON.stringify(body, null, 2));
    
    const payload: EvolutionWebhook = body as EvolutionWebhook;
    console.log('[handle-whatsapp-event] Received event:', payload.event);
    console.log('[handle-whatsapp-event] Instance:', payload.instance);

    // Buscar instância no banco
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', payload.instance)
      .single();

    if (instanceError || !instance) {
      console.error('[handle-whatsapp-event] Instance not found:', payload.instance);
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar formato do evento (Evolution API v2 usa minúsculas com pontos)
    const normalizedEvent = normalizeEventType(payload.event);
    console.log('[handle-whatsapp-event] Normalized event:', normalizedEvent);

    // Processar diferentes tipos de eventos
    switch (normalizedEvent) {
      case 'MESSAGES_UPSERT':
        await handleMessageUpsert(supabase, payload, instance);
        break;
      
      case 'CONNECTION_UPDATE':
        await handleConnectionUpdate(supabase, payload, instance);
        break;
      
      case 'QRCODE_UPDATED':
        await handleQRCodeUpdate(supabase, payload, instance);
        break;
      
      default:
        console.log('[handle-whatsapp-event] Unhandled event type:', payload.event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[handle-whatsapp-event] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Função auxiliar: normalizar formato de eventos da Evolution API v2
function normalizeEventType(event: string): string {
  // Evolution API v2 usa formato: messages.upsert, connection.update, qrcode.updated
  // Normalizar para: MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED
  
  const eventMap: Record<string, string> = {
    'messages.upsert': 'MESSAGES_UPSERT',
    'connection.update': 'CONNECTION_UPDATE',
    'qrcode.updated': 'QRCODE_UPDATED',
  };
  
  // Retornar o evento normalizado ou tentar conversão genérica
  const normalized = eventMap[event.toLowerCase()];
  if (normalized) {
    return normalized;
  }
  
  // Fallback: converter para maiúsculas e trocar ponto por underscore
  return event.toUpperCase().replace(/\./g, '_');
}

async function handleMessageUpsert(supabase: any, payload: EvolutionWebhook, instance: any) {
  const { data, event } = payload;
  
  // Ignorar mensagens enviadas por nós
  if (data.key.fromMe) {
    console.log('[handle-whatsapp-event] Ignoring message from self');
    return;
  }

  // Extrair número do cliente (remover sufixo @s.whatsapp.net)
  const customerPhone = data.key.remoteJid.replace('@s.whatsapp.net', '');
  const customerName = data.pushName || customerPhone;

  // Extrair texto da mensagem (suporta diferentes tipos de mensagem)
  let messageText = '';
  if (data.message?.conversation) {
    messageText = data.message.conversation;
  } else if (data.message?.extendedTextMessage?.text) {
    messageText = data.message.extendedTextMessage.text;
  } else if (data.message?.imageMessage?.caption) {
    messageText = data.message.imageMessage.caption || '[Imagem]';
  } else if (data.message?.videoMessage?.caption) {
    messageText = data.message.videoMessage.caption || '[Vídeo]';
  } else if (data.message?.documentMessage?.caption) {
    messageText = data.message.documentMessage.caption || '[Documento]';
  } else {
    messageText = '[Mensagem não suportada]';
  }

  console.log('[handle-whatsapp-event] Message from:', customerPhone);
  console.log('[handle-whatsapp-event] Text:', messageText);

  // 1. Buscar ou criar contato
  let contactId: string;
  
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', customerPhone)
    .single();

  if (existingContact) {
    contactId = existingContact.id;
    console.log('[handle-whatsapp-event] Existing contact found:', contactId);
  } else {
    // Criar novo contato
    const names = customerName.split(' ');
    const firstName = names[0] || customerName;
    const lastName = names.slice(1).join(' ') || '';

    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: customerPhone,
        whatsapp_id: data.key.remoteJid,
        source: 'whatsapp',
        status: 'lead',
      })
      .select()
      .single();

    if (contactError) {
      console.error('[handle-whatsapp-event] Error creating contact:', contactError);
      throw contactError;
    }

    contactId = newContact.id;
    console.log('[handle-whatsapp-event] New contact created:', contactId);
  }

  // 2. Buscar ou criar conversa usando RPC function
  const { data: conversationData, error: conversationError } = await supabase.rpc(
    'get_or_create_conversation',
    {
      p_contact_id: contactId,
      p_department_id: instance.department_id || null,
      p_channel: 'whatsapp',
    }
  );

  if (conversationError) {
    console.error('[handle-whatsapp-event] Error getting/creating conversation:', conversationError);
    throw conversationError;
  }

  const conversationId = conversationData[0].conversation_id;
  console.log('[handle-whatsapp-event] Conversation ID:', conversationId);

  // 3. FASE 2: Vincular instância e atribuir conversa
  const updateData: any = {
    whatsapp_instance_id: instance.id, // Vincular instância para roteamento de saída
    ai_mode: instance.ai_mode,
  };

  // Se instância tem user_id (Dono), atribuir conversa automaticamente
  if (instance.user_id) {
    updateData.assigned_to = instance.user_id;
    console.log('[handle-whatsapp-event] Assigned to owner:', instance.user_id);
  }

  await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  // 4. Inserir mensagem do cliente
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      content: messageText,
      sender_type: 'contact',
      sender_id: null,
      is_ai_generated: false,
    });

  if (messageError) {
    console.error('[handle-whatsapp-event] Error inserting message:', messageError);
    throw messageError;
  }

  console.log('[handle-whatsapp-event] Message inserted successfully');

  // 5. Se ai_mode = 'autopilot', disparar AI
  if (instance.ai_mode === 'autopilot') {
    console.log('[handle-whatsapp-event] Triggering AI autopilot...');
    
    // Chamar função AI (será implementada na próxima fase)
    try {
      await supabase.functions.invoke('ai-autopilot-chat', {
        body: {
          conversation_id: conversationId,
          customer_message: messageText,
        },
      });
      console.log('[handle-whatsapp-event] AI triggered successfully');
    } catch (aiError) {
      console.error('[handle-whatsapp-event] Error triggering AI:', aiError);
      // Não propagar erro - mensagem foi salva com sucesso
    }
  } else if (instance.ai_mode === 'copilot') {
    console.log('[handle-whatsapp-event] Copilot mode - generating suggestion...');
    
    // Gerar sugestão da IA sem enviar (será implementado na próxima fase)
    try {
      await supabase.functions.invoke('generate-smart-reply', {
        body: {
          conversation_id: conversationId,
        },
      });
      console.log('[handle-whatsapp-event] Copilot suggestion generated');
    } catch (copilotError) {
      console.error('[handle-whatsapp-event] Error generating copilot suggestion:', copilotError);
    }
  }
}

async function handleConnectionUpdate(supabase: any, payload: EvolutionWebhook, instance: any) {
  console.log('[handle-whatsapp-event] Connection update:', payload.data);
  
  // Atualizar status da instância no banco
  // A Evolution API envia estados como: open, close, connecting
  // Mapear para nossos estados: connected, disconnected, qr_pending
  
  const { data } = payload;
  let newStatus = 'disconnected';
  
  // Verificar se há informação de estado na payload
  // (A estrutura pode variar dependendo da versão da Evolution API)
  if (data && typeof data === 'object') {
    const stateInfo = data as any;
    if (stateInfo.state === 'open' || stateInfo.connection === 'open') {
      newStatus = 'connected';
    } else if (stateInfo.state === 'close' || stateInfo.connection === 'close') {
      newStatus = 'disconnected';
    }
  }

  await supabase
    .from('whatsapp_instances')
    .update({ status: newStatus })
    .eq('id', instance.id);

  console.log('[handle-whatsapp-event] Instance status updated to:', newStatus);
}

async function handleQRCodeUpdate(supabase: any, payload: EvolutionWebhook, instance: any) {
  console.log('[handle-whatsapp-event] QR Code update received');
  
  // Extrair QR Code da payload
  const qrCode = (payload.data as any)?.qrcode || (payload.data as any)?.qr;
  
  if (qrCode) {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code_base64: qrCode,
        status: 'qr_pending',
      })
      .eq('id', instance.id);

    console.log('[handle-whatsapp-event] QR Code updated in database');
  }
}
