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

  // 🔧 FASE 1: Armazenamento Correto de JID + Telefone
  // 1. Guardar JID original para envio (pode ser @lid, @s.whatsapp.net, etc.)
  const originalJid = data.key.remoteJid;
  
  // 2. Extrair telefone limpo (remove TODOS os sufixos JID)
  const cleanPhone = originalJid
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@c\.us$/i, '');
  
  // 3. Normalizar número brasileiro (adicionar DDI 55 se necessário)
  let normalizedPhone = cleanPhone.replace(/\D/g, '');
  if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = `55${normalizedPhone}`;
    }
  }
  
  const customerName = data.pushName || normalizedPhone;

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

  console.log('[handle-whatsapp-event] Message from:', normalizedPhone);
  console.log('[handle-whatsapp-event] Text:', messageText);

  // 1. Buscar ou criar contato TEMPORÁRIO (visitante)
  let contactId: string;
  
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('phone', normalizedPhone)
    .single();

  if (existingContact) {
    contactId = existingContact.id;
    console.log('[handle-whatsapp-event] Existing contact found:', contactId);
  } else {
    // Criar contato temporário como "Visitante"
    const names = customerName.split(' ');
    const firstName = names[0] || customerName;
    const lastName = names.slice(1).join(' ') || '';

    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone,        // ✅ Telefone limpo normalizado
        whatsapp_id: originalJid,       // ✅ JID original para envio
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
    console.log('[handle-whatsapp-event] New temporary contact created:', contactId);
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

  // 3. Buscar conversa para checar metadata (estado OTP)
  const { data: conversation } = await supabase
    .from('conversations')
    .select('customer_metadata')
    .eq('id', conversationId)
    .single();

  const metadata = conversation?.customer_metadata || {};

  // 🔐 FLUXO DE VERIFICAÇÃO OTP
  if (metadata.awaiting_otp) {
    console.log('[handle-whatsapp-event] 🔐 Validating OTP...');
    await handleOTPValidation(supabase, conversationId, messageText, metadata, instance);
    return; // Não processar mais nada após validação OTP
  }

  // 🔍 DETECÇÃO DE EMAIL NA MENSAGEM
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = messageText.match(emailRegex);

  if (emailMatch) {
    const claimedEmail = emailMatch[0].toLowerCase();
    console.log('[handle-whatsapp-event] 📧 Email detected:', claimedEmail);

    // Verificar se email já existe no banco
    const { data: existingEmailContact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('email', claimedEmail)
      .single();

    if (existingEmailContact && existingEmailContact.id !== contactId) {
      // 🚨 EMAIL JÁ EXISTE - INICIAR DESAFIO OTP
      console.log('[handle-whatsapp-event] 🚨 Email belongs to existing customer - triggering OTP challenge');
      
      // Gerar código OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      // Salvar código no banco
      await supabase
        .from('email_verifications')
        .insert({
          email: claimedEmail,
          code: otpCode,
          expires_at: expiresAt.toISOString(),
        });

      // Atualizar metadata da conversa
      await supabase
        .from('conversations')
        .update({
          customer_metadata: {
            ...metadata,
            awaiting_otp: true,
            claimant_email: claimedEmail,
            claimed_contact_id: existingEmailContact.id,
            otp_attempts: 0,
            otp_expires_at: expiresAt.toISOString(),
          },
        })
        .eq('id', conversationId);

      // Enviar email via Resend
      try {
        await supabase.functions.invoke('send-verification-code', {
          body: { email: claimedEmail },
        });
        console.log('[handle-whatsapp-event] ✅ OTP email sent successfully');
      } catch (emailError) {
        console.error('[handle-whatsapp-event] ❌ Error sending OTP email:', emailError);
      }

      // Responder ao cliente no WhatsApp
      await sendWhatsAppMessage(
        supabase,
        instance,
        normalizedPhone,
        `🔐 *Verificação de Identidade*\n\nLocalizei um cadastro com este e-mail. Por segurança, enviei um código de 6 dígitos para *${claimedEmail}*.\n\nDigite o código aqui para confirmar sua identidade e acessar seu histórico.`
      );

      // Inserir mensagem do sistema
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: messageText,
        sender_type: 'contact',
        sender_id: null,
      });

      return; // Não processar mais nada - aguardando OTP
    }
  }

  // 4. FASE 2: Vincular instância e atribuir conversa (normal flow)
  const updateData: any = {
    whatsapp_instance_id: instance.id,
    ai_mode: instance.ai_mode,
  };

  if (instance.user_id) {
    updateData.assigned_to = instance.user_id;
    console.log('[handle-whatsapp-event] Assigned to owner:', instance.user_id);
  }

  await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  // 5. Inserir mensagem do cliente
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

  // 6. Se ai_mode = 'autopilot', disparar AI
  if (instance.ai_mode === 'autopilot') {
    console.log('[handle-whatsapp-event] Triggering AI autopilot...');
    
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
    }
  } else if (instance.ai_mode === 'copilot') {
    console.log('[handle-whatsapp-event] Copilot mode - generating suggestion...');
    
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

// 🔐 Função auxiliar: Validar código OTP
async function handleOTPValidation(
  supabase: any,
  conversationId: string,
  messageText: string,
  metadata: any,
  instance: any
) {
  const trimmedCode = messageText.trim();
  const claimedEmail = metadata.claimant_email;
  const claimedContactId = metadata.claimed_contact_id;
  const attempts = metadata.otp_attempts || 0;

  console.log(`[handle-whatsapp-event] 🔐 Validating OTP attempt ${attempts + 1}/3`);

  // Verificar código no banco
  const { data: verification } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('email', claimedEmail)
    .eq('code', trimmedCode)
    .eq('verified', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (verification) {
    // ✅ CÓDIGO CORRETO - VINCULAR CONTATO
    console.log('[handle-whatsapp-event] ✅ OTP validated successfully');

    // Obter phone da conversa atual
    const { data: currentConversation } = await supabase
      .from('conversations')
      .select('contact_id, contacts(phone, whatsapp_id)')
      .eq('id', conversationId)
      .single();

    const currentPhone = currentConversation.contacts.phone;
    const currentWhatsAppId = currentConversation.contacts.whatsapp_id;

    // Atualizar contato existente com phone do WhatsApp
    await supabase
      .from('contacts')
      .update({
        phone: currentPhone,
        whatsapp_id: currentWhatsAppId,
      })
      .eq('id', claimedContactId);

    // Deletar contato temporário
    await supabase
      .from('contacts')
      .delete()
      .eq('id', currentConversation.contact_id);

    // Atualizar conversa para o contato correto
    await supabase
      .from('conversations')
      .update({
        contact_id: claimedContactId,
        customer_metadata: {}, // Limpar metadata
      })
      .eq('id', conversationId);

    // Marcar código como usado
    await supabase
      .from('email_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    // Buscar nome do cliente
    const { data: customer } = await supabase
      .from('contacts')
      .select('first_name')
      .eq('id', claimedContactId)
      .single();

    // Responder ao cliente
    const { data: conv } = await supabase
      .from('conversations')
      .select('contacts(phone)')
      .eq('id', conversationId)
      .single();

    await sendWhatsAppMessage(
      supabase,
      instance,
      conv.contacts.phone,
      `✅ *Identidade Confirmada!*\n\nBem-vindo de volta, ${customer?.first_name || 'cliente'}! 👋\n\nAgora você tem acesso ao seu histórico completo de conversas.`
    );

    // Inserir mensagem de sistema
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: `✅ Identidade verificada via OTP`,
      sender_type: 'system',
      sender_id: null,
    });

    console.log('[handle-whatsapp-event] ✅ Contact linked successfully');
  } else {
    // ❌ CÓDIGO INCORRETO
    const newAttempts = attempts + 1;

    if (newAttempts >= 3) {
      // 🚨 BLOQUEIO POR EXCESSO DE TENTATIVAS
      console.log('[handle-whatsapp-event] 🚨 Max OTP attempts reached - triggering fraud alert');

      await supabase
        .from('conversations')
        .update({
          customer_metadata: {
            ...metadata,
            otp_blocked: true,
            awaiting_otp: false,
          },
          ai_mode: 'copilot', // Forçar handoff humano
        })
        .eq('id', conversationId);

      // Chamar agente humano
      await supabase.functions.invoke('route-conversation', {
        body: { conversation_id: conversationId },
      });

      const { data: conv } = await supabase
        .from('conversations')
        .select('contacts(phone)')
        .eq('id', conversationId)
        .single();

      await sendWhatsAppMessage(
        supabase,
        instance,
        conv.contacts.phone,
        `🚨 *Tentativas Excedidas*\n\nPor segurança, bloqueamos novas tentativas de verificação.\n\nUm atendente humano será acionado para confirmar sua identidade manualmente.`
      );

      // Inserir alerta de fraude
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: `🚨 ALERTA DE SEGURANÇA: Cliente excedeu 3 tentativas de OTP. Email reivindicado: ${claimedEmail}`,
        sender_type: 'system',
        sender_id: null,
      });
    } else {
      // Incrementar tentativas
      await supabase
        .from('conversations')
        .update({
          customer_metadata: {
            ...metadata,
            otp_attempts: newAttempts,
          },
        })
        .eq('id', conversationId);

      const { data: conv } = await supabase
        .from('conversations')
        .select('contacts(phone)')
        .eq('id', conversationId)
        .single();

      await sendWhatsAppMessage(
        supabase,
        instance,
        conv.contacts.phone,
        `❌ *Código Incorreto*\n\nTentativa ${newAttempts} de 3.\n\nVerifique seu email e tente novamente.`
      );
    }

    // Inserir mensagem
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: messageText,
      sender_type: 'contact',
      sender_id: null,
    });
  }
}

// 📤 Função auxiliar: Enviar mensagem WhatsApp
async function sendWhatsAppMessage(
  supabase: any,
  instance: any,
  phone: string,
  message: string
) {
  try {
    await supabase.functions.invoke('send-whatsapp-message', {
      body: {
        instance_id: instance.id,
        phone: phone,
        message: message,
      },
    });
  } catch (error) {
    console.error('[handle-whatsapp-event] Error sending WhatsApp message:', error);
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
