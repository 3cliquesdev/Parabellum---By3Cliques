import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  instance_id: string;
  limit?: number;
}

interface ChatInfo {
  remoteJid: string;
  pushName?: string;
  unreadCount?: number;
  lastMessage?: {
    key: { fromMe: boolean };
    message?: Record<string, unknown>;
    messageTimestamp?: number;
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { instance_id, limit = 50 }: SyncRequest = await req.json();

    console.log('[sync-whatsapp-history] Starting sync for instance:', instance_id, 'limit:', limit);

    // 1. Buscar dados da instância
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instance_id)
      .single();

    if (instanceError || !instance) {
      console.error('[sync-whatsapp-history] Instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Instance not connected', status: instance.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar URL base
    let baseUrl = instance.api_url;
    if (baseUrl.includes('/manager')) {
      baseUrl = baseUrl.split('/manager')[0];
    }
    baseUrl = baseUrl.replace(/\/$/, '');

    console.log('[sync-whatsapp-history] Fetching chats from:', baseUrl);

    // 2. Buscar lista de chats da Evolution API
    const chatsResponse = await fetch(
      `${baseUrl}/chat/findChats/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': instance.api_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!chatsResponse.ok) {
      console.error('[sync-whatsapp-history] Failed to fetch chats:', chatsResponse.status);
      const errorText = await chatsResponse.text();
      console.error('[sync-whatsapp-history] Error details:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch chats from API', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chats: ChatInfo[] = await chatsResponse.json();
    console.log('[sync-whatsapp-history] Found', chats.length, 'chats');

    // Filtrar apenas chats privados (não grupos)
    const privateChats = chats
      .filter((chat: ChatInfo) => !chat.remoteJid.endsWith('@g.us') && !chat.remoteJid.endsWith('@broadcast'))
      .slice(0, limit);

    console.log('[sync-whatsapp-history] Processing', privateChats.length, 'private chats');

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // 3. Para cada chat, buscar mensagens e importar
    for (const chat of privateChats) {
      try {
        const remoteJid = chat.remoteJid;
        console.log('[sync-whatsapp-history] Processing chat:', remoteJid);

        // Extrair telefone do JID
        let phone = remoteJid
          .replace(/@s\.whatsapp\.net$/i, '')
          .replace(/@c\.us$/i, '')
          .replace(/\D/g, '');

        // Normalizar número brasileiro
        if (phone.length === 10 || phone.length === 11) {
          if (!phone.startsWith('55')) {
            phone = `55${phone}`;
          }
        }

        const customerName = chat.pushName || phone;

        // 4. Buscar mensagens do chat
        const messagesResponse = await fetch(
          `${baseUrl}/chat/findMessages/${instance.instance_name}`,
          {
            method: 'POST',
            headers: {
              'apikey': instance.api_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              where: {
                key: {
                  remoteJid: remoteJid,
                },
              },
              limit: 100, // Limitar mensagens por chat
            }),
          }
        );

        if (!messagesResponse.ok) {
          console.error('[sync-whatsapp-history] Failed to fetch messages for:', remoteJid);
          failed++;
          continue;
        }

        const messagesData = await messagesResponse.json();
        const messages = messagesData.messages || messagesData || [];
        
        if (!Array.isArray(messages) || messages.length === 0) {
          console.log('[sync-whatsapp-history] No messages found for:', remoteJid);
          skipped++;
          continue;
        }

        console.log('[sync-whatsapp-history] Found', messages.length, 'messages for', remoteJid);

        // 5. Buscar ou criar contato
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('id, email, first_name, last_name')
          .eq('phone', phone)
          .order('email', { ascending: false, nullsFirst: false })
          .limit(1);

        let contactId: string;

        if (existingContacts && existingContacts.length > 0) {
          contactId = existingContacts[0].id;
          console.log('[sync-whatsapp-history] Using existing contact:', contactId);
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
              phone: phone,
              whatsapp_id: remoteJid,
              source: 'whatsapp_import',
              status: 'lead',
            })
            .select()
            .single();

          if (contactError) {
            if (contactError.code === '23505') {
              // Duplicado - buscar existente
              const { data: foundContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('phone', phone)
                .limit(1);

              if (foundContact && foundContact.length > 0) {
                contactId = foundContact[0].id;
              } else {
                console.error('[sync-whatsapp-history] Contact error:', contactError);
                failed++;
                continue;
              }
            } else {
              console.error('[sync-whatsapp-history] Contact error:', contactError);
              failed++;
              continue;
            }
          } else {
            contactId = newContact.id;
            console.log('[sync-whatsapp-history] Created new contact:', contactId);
          }
        }

        // 6. Buscar ou criar conversa
        const { data: conversationData, error: convError } = await supabase.rpc(
          'get_or_create_conversation',
          {
            p_contact_id: contactId,
            p_department_id: instance.department_id || null,
            p_channel: 'whatsapp',
          }
        );

        if (convError || !conversationData || conversationData.length === 0) {
          console.error('[sync-whatsapp-history] Conversation error:', convError);
          failed++;
          continue;
        }

        const conversationId = conversationData[0].conversation_id;
        console.log('[sync-whatsapp-history] Using conversation:', conversationId);

        // 7. Inserir mensagens (evitando duplicatas)
        let messagesImported = 0;
        for (const msg of messages) {
          const msgKey = msg.key;
          if (!msgKey) continue;

          const externalId = msgKey.id;
          if (!externalId) continue;

          // Verificar se mensagem já existe
          const { data: existingMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('external_id', externalId)
            .limit(1);

          if (existingMsg && existingMsg.length > 0) {
            continue; // Já existe, pular
          }

          // Extrair texto da mensagem
          let content = '';
          const msgContent = msg.message;
          if (msgContent?.conversation) {
            content = msgContent.conversation;
          } else if (msgContent?.extendedTextMessage?.text) {
            content = msgContent.extendedTextMessage.text;
          } else if (msgContent?.imageMessage?.caption) {
            content = `📷 ${msgContent.imageMessage.caption}`;
          } else if (msgContent?.videoMessage?.caption) {
            content = `🎥 ${msgContent.videoMessage.caption}`;
          } else if (msgContent?.audioMessage || msgContent?.pttMessage) {
            content = '🎤 Áudio';
          } else if (msgContent?.documentMessage) {
            content = `📎 ${msgContent.documentMessage.fileName || 'Documento'}`;
          } else if (msgContent?.imageMessage) {
            content = '📷 Imagem';
          } else if (msgContent?.videoMessage) {
            content = '🎥 Vídeo';
          } else if (msgContent?.stickerMessage) {
            content = '🏷️ Sticker';
          } else if (msgContent?.locationMessage) {
            content = '📍 Localização';
          } else if (msgContent?.contactMessage) {
            content = `👤 ${msgContent.contactMessage.displayName || 'Contato'}`;
          } else {
            continue; // Mensagem sem conteúdo reconhecido
          }

          // Determinar timestamp
          const timestamp = msg.messageTimestamp 
            ? new Date(parseInt(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();

          // Inserir mensagem
          const { error: insertError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: content,
              sender_type: msgKey.fromMe ? 'user' : 'contact',
              external_id: externalId,
              created_at: timestamp,
            });

          if (insertError) {
            console.error('[sync-whatsapp-history] Message insert error:', insertError);
          } else {
            messagesImported++;
          }
        }

        if (messagesImported > 0) {
          imported++;
          console.log('[sync-whatsapp-history] ✅ Imported', messagesImported, 'messages for', remoteJid);
        } else {
          skipped++;
        }

        // Atualizar last_message_at da conversa
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.messageTimestamp) {
          const lastMsgTime = new Date(parseInt(lastMsg.messageTimestamp) * 1000).toISOString();
          await supabase
            .from('conversations')
            .update({ last_message_at: lastMsgTime })
            .eq('id', conversationId);
        }

      } catch (chatError) {
        console.error('[sync-whatsapp-history] Error processing chat:', chat.remoteJid, chatError);
        errors.push(`${chat.remoteJid}: ${chatError instanceof Error ? chatError.message : 'Unknown error'}`);
        failed++;
      }
    }

    console.log('[sync-whatsapp-history] Sync complete:', { imported, skipped, failed });

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        failed,
        total_chats: privateChats.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[sync-whatsapp-history] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
