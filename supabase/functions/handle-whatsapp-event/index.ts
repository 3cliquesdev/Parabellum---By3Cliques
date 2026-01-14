import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
      remoteJidAlt?: string;  // ✅ NOVO - Número real para usuários LID
      fromMe: boolean;
      id?: string;
      addressingMode?: 'lid' | 'standard';  // ✅ NOVO - Modo de endereçamento
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: {
        caption?: string;
        url?: string;
        mimetype?: string;
        mediaKey?: string;
        directPath?: string;
        fileLength?: number;
      };
      videoMessage?: {
        caption?: string;
        url?: string;
        mimetype?: string;
        mediaKey?: string;
        directPath?: string;
        fileLength?: number;
        seconds?: number;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
        mediaKey?: string;
        directPath?: string;
        fileLength?: number;
        seconds?: number;
        ptt?: boolean; // Push-to-talk (áudio gravado)
      };
      pttMessage?: {
        url?: string;
        mimetype?: string;
        seconds?: number;
      };
      documentMessage?: {
        caption?: string;
        url?: string;
        mimetype?: string;
        fileName?: string;
        mediaKey?: string;
        directPath?: string;
        fileLength?: number;
      };
      stickerMessage?: {
        url?: string;
        mimetype?: string;
        isAnimated?: boolean;
      };
      locationMessage?: {
        degreesLatitude?: number;
        degreesLongitude?: number;
        name?: string;
        address?: string;
      };
      contactMessage?: {
        displayName?: string;
        vcard?: string;
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

// Interface para informações de mídia
interface MediaInfo {
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mimeType: string;
  caption?: string;
  durationSeconds?: number;
  fileName?: string;
}

/**
 * Verifies Evolution API webhook signature
 * @param body - Raw request body string
 * @param signature - Signature from x-evolution-signature header (if Evolution API supports it)
 * @param secret - Webhook secret from environment
 * @returns true if signature is valid, false otherwise
 */
async function verifyEvolutionSignature(
  body: string,
  signature: string | null,
  secret: string | null
): Promise<boolean> {
  // Se não houver secret configurado, pular verificação (para compatibilidade)
  if (!secret) {
    console.warn('[handle-whatsapp-event] ⚠️ EVOLUTION_API_SECRET not configured - skipping signature verification');
    return true;
  }

  if (!signature) {
    console.warn('[handle-whatsapp-event] ⚠️ No signature header - allowing request (Evolution API compatibility)');
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = expectedSignature === signature.toLowerCase();
    
    if (!isValid) {
      console.error('[handle-whatsapp-event] ❌ Invalid signature');
      console.error('Expected:', expectedSignature);
      console.error('Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('[handle-whatsapp-event] ❌ Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🔐 SECURITY: Verify webhook signature
    const rawBody = await req.text();
    const signature = req.headers.get('x-evolution-signature');
    const evolutionSecret = Deno.env.get('EVOLUTION_API_SECRET') || null;

    const isValidSignature = await verifyEvolutionSignature(rawBody, signature, evolutionSecret);
    
    if (!isValidSignature) {
      console.error('[handle-whatsapp-event] 🚨 Invalid webhook signature - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
      }
    );

    const body = JSON.parse(rawBody);
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

    // ⏸️ Verificar se inbox está habilitado para esta instância
    if (instance.inbox_enabled === false) {
      console.log(`[handle-whatsapp-event] ⏸️ Inbox desabilitado para instância: ${instance.name}`);
      console.log('[handle-whatsapp-event] Mensagem ignorada (instância apenas para envio)');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'inbox_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      
      case 'MESSAGES_SET':
        console.log('[handle-whatsapp-event] Messages set event - skipping batch sync');
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
    'messages.set': 'MESSAGES_SET',
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

  // 🔧 FASE 2 & 3: Detecção e Tratamento de LID (Linked Identity Devices)
  const originalJid = data.key.remoteJid;
  const alternativeJid = data.key.remoteJidAlt;
  const addressingMode = data.key.addressingMode;
  
  // Ignorar mensagens de grupos WhatsApp
  if (originalJid.endsWith('@g.us')) {
    console.log('[handle-whatsapp-event] ⏭️ Ignorando mensagem de grupo:', originalJid);
    return;
  }
  
  // ✅ Determinar número de telefone REAL e JID para envio
  let phoneForDatabase: string;
  let jidForSending: string;
  
  if (originalJid.endsWith('@lid') && alternativeJid) {
    // 🔗 LID DETECTADO - Usar número alternativo como telefone real
    console.log('[handle-whatsapp-event] 🔗 LID detectado!');
    console.log('[handle-whatsapp-event] - Original JID (LID):', originalJid);
    console.log('[handle-whatsapp-event] - Alternative JID (Real):', alternativeJid);
    console.log('[handle-whatsapp-event] - Addressing Mode:', addressingMode);
    
    // Extrair número real do JID alternativo
    phoneForDatabase = alternativeJid.replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
    jidForSending = alternativeJid; // ✅ Usar JID alternativo para envio
  } else {
    // 📱 Número normal - usar JID original
    phoneForDatabase = originalJid
      .replace(/@s\.whatsapp\.net$/i, '')
      .replace(/@c\.us$/i, '')
      .replace(/\D/g, '');
    jidForSending = originalJid;
  }
  
  // Normalizar número brasileiro (adicionar DDI 55 se necessário)
  if (phoneForDatabase.length === 10 || phoneForDatabase.length === 11) {
    if (!phoneForDatabase.startsWith('55')) {
      phoneForDatabase = `55${phoneForDatabase}`;
    }
  }
  
  console.log('[handle-whatsapp-event] 📱 Phone detection result:', {
    originalJid,
    alternativeJid,
    isLID: originalJid.endsWith('@lid'),
    phoneForDatabase,
    jidForSending
  });
  
  const customerName = data.pushName || phoneForDatabase;

  // 📸 Detectar se é mídia e preparar texto da mensagem
  let messageText = '';
  const mediaInfo = detectMediaType(data.message);
  let hasMedia = false;
  
  if (data.message?.conversation) {
    messageText = data.message.conversation;
  } else if (data.message?.extendedTextMessage?.text) {
    messageText = data.message.extendedTextMessage.text;
  } else if (data.message?.imageMessage) {
    messageText = data.message.imageMessage.caption || '';
    hasMedia = true;
  } else if (data.message?.videoMessage) {
    messageText = data.message.videoMessage.caption || '';
    hasMedia = true;
  } else if (data.message?.audioMessage || data.message?.pttMessage) {
    messageText = ''; // Áudio não tem legenda
    hasMedia = true;
  } else if (data.message?.documentMessage) {
    messageText = data.message.documentMessage.caption || `📎 ${data.message.documentMessage.fileName || 'Documento'}`;
    hasMedia = true;
  } else if (data.message?.stickerMessage) {
    messageText = ''; // Sticker não tem texto
    hasMedia = true;
  } else if (data.message?.locationMessage) {
    const loc = data.message.locationMessage;
    messageText = `📍 Localização: ${loc.name || loc.address || `${loc.degreesLatitude}, ${loc.degreesLongitude}`}`;
  } else if (data.message?.contactMessage) {
    messageText = `👤 Contato: ${data.message.contactMessage.displayName || 'Contato'}`;
  } else {
    messageText = '[Mensagem não suportada]';
  }

  console.log('[handle-whatsapp-event] Message from:', phoneForDatabase);
  console.log('[handle-whatsapp-event] Text:', messageText);

  // 1. Buscar ou criar contato TEMPORÁRIO (visitante)
  // 🔧 FIX: Usar .limit(1) em vez de .single() para evitar erro quando há duplicatas
  let contactId: string = '';
  let isKnownCustomer = false;
  let contactName = customerName;
  
  // Buscar contatos por telefone - preferir o que tem email, senão o mais recente
  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('id, email, first_name, last_name, created_at')
    .eq('phone', phoneForDatabase)
    .order('email', { ascending: false, nullsFirst: false }) // Prioriza quem tem email
    .order('created_at', { ascending: false }) // Depois o mais recente
    .limit(5);

  // Escolher o melhor contato (com email > mais recente)
  const existingContact = existingContacts && existingContacts.length > 0 
    ? existingContacts.find((c: { id: string; email: string | null }) => c.email) || existingContacts[0]
    : null;

  if (existingContact) {
    contactId = existingContact.id;
    console.log('[handle-whatsapp-event] ✅ Existing contact found:', contactId, 
      existingContacts && existingContacts.length > 1 ? `(${existingContacts.length} duplicates exist)` : '');
    
    // ✅ SE TEM EMAIL VINCULADO = CLIENTE JÁ VERIFICADO
    if (existingContact.email) {
      isKnownCustomer = true;
      contactName = `${existingContact.first_name || ''} ${existingContact.last_name || ''}`.trim() || customerName;
      console.log(`[handle-whatsapp-event] 🎯 Cliente conhecido: ${contactName} (${existingContact.email})`);
    }
    
    // 🔧 Atualizar whatsapp_id se mudou (caso de LID)
    if (jidForSending && existingContact.id) {
      await supabase
        .from('contacts')
        .update({ whatsapp_id: jidForSending })
        .eq('id', existingContact.id);
    }
  } else {
    // Criar contato temporário como "Visitante"
    const names = customerName.split(' ');
    const firstName = names[0] || customerName;
    const lastName = names.slice(1).join(' ') || '';

    // 🔧 FIX: Usar upsert com on_conflict para evitar duplicação em race condition
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .upsert({
        first_name: firstName,
        last_name: lastName,
        phone: phoneForDatabase,        // ✅ Número real (não LID)
        whatsapp_id: jidForSending,     // ✅ JID para envio (alternativo se LID)
        source: 'whatsapp',
        status: 'lead',
      }, {
        onConflict: 'phone',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (contactError) {
      // Se falhou no upsert, tentar buscar novamente (pode ter sido criado por outra requisição)
      console.warn('[handle-whatsapp-event] ⚠️ Upsert failed, trying to fetch:', contactError.message);
      const { data: retryContact } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name')
        .eq('phone', phoneForDatabase)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (retryContact && retryContact.length > 0) {
        contactId = retryContact[0].id;
        console.log('[handle-whatsapp-event] ✅ Found contact on retry:', contactId);
      } else {
        console.error('[handle-whatsapp-event] ❌ Error creating contact:', contactError);
        throw contactError;
      }
    } else if (newContact) {
      contactId = newContact.id;
      console.log('[handle-whatsapp-event] ✅ New contact created:', contactId);
    }
  }
  
  // Verificar se contactId foi definido
  if (!contactId) {
    console.error('[handle-whatsapp-event] ❌ Failed to get or create contact');
    throw new Error('Failed to get or create contact');
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

  // 3. Buscar conversa para checar metadata e flags
  const { data: conversation } = await supabase
    .from('conversations')
    .select('customer_metadata, awaiting_rating, status')
    .eq('id', conversationId)
    .single();

  const metadata = conversation?.customer_metadata || {};

  // 📊 FLUXO DE AVALIAÇÃO CSAT - Detectar resposta de rating (1-5)
  if (conversation?.awaiting_rating) {
    const rating = extractRating(messageText);
    
    if (rating !== null) {
      console.log(`[handle-whatsapp-event] ⭐ Rating detected: ${rating}`);
      
      // Salvar rating na tabela conversation_ratings
      const { error: ratingError } = await supabase
        .from('conversation_ratings')
        .insert({
          conversation_id: conversationId,
          rating: rating,
          channel: 'whatsapp',
          feedback_text: messageText,
        });
      
      if (ratingError) {
        console.error('[handle-whatsapp-event] Error saving rating:', ratingError);
      } else {
        console.log('[handle-whatsapp-event] ✅ Rating saved successfully');
        
        // Limpar flag awaiting_rating
        await supabase
          .from('conversations')
          .update({ awaiting_rating: false })
          .eq('id', conversationId);
        
        // Enviar agradecimento
        let thankYouMessage = '';
        if (rating >= 4) {
          thankYouMessage = `🎉 Obrigado pela avaliação de ${rating} estrela${rating > 1 ? 's' : ''}!\n\nFicamos muito felizes em ter ajudado. Conte sempre conosco! 💚`;
        } else if (rating === 3) {
          thankYouMessage = `👍 Obrigado pela sua avaliação!\n\nEstamos sempre buscando melhorar. Se tiver sugestões, fique à vontade para compartilhar!`;
        } else {
          thankYouMessage = `🙏 Agradecemos seu feedback.\n\nLamentamos que sua experiência não tenha sido ideal. Vamos trabalhar para melhorar!`;
        }
        
        await sendWhatsAppMessage(
          supabase,
          instance,
          phoneForDatabase,
          jidForSending,
          thankYouMessage
        );
        
        // Inserir mensagem do cliente (a avaliação)
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          content: `⭐ Avaliação: ${rating}/5`,
          sender_type: 'contact',
          sender_id: null,
          channel: 'whatsapp',
        });
      }
      
      return; // Não processar mais nada após avaliação
    }
  }

  // 🔐 FLUXO DE VERIFICAÇÃO OTP
  if (metadata.awaiting_otp) {
    console.log('[handle-whatsapp-event] 🔐 Validating OTP...');
    await handleOTPValidation(supabase, conversationId, messageText, metadata, instance);
    return; // Não processar mais nada após validação OTP
  }

  // 🔍 DETECÇÃO DE EMAIL NA MENSAGEM - APENAS PARA VISITANTES
  // FASE 4: Se cliente já tem email cadastrado, pular TODO o fluxo de verificação
  if (!isKnownCustomer) {
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
      
      // FASE 2: Enviar OTP via email e capturar código retornado (código único gerado pelo send-verification-code)
      let otpSentViaEmail = false;
      let otpCode: string | null = null;
      let devMode = false;
      
      try {
        console.log('[handle-whatsapp-event] 📤 Invocando send-verification-code...');
        const { data: otpResponse, error: otpError } = await supabase.functions.invoke('send-verification-code', {
          body: { email: claimedEmail, type: 'customer' },
        });
        
        console.log('[handle-whatsapp-event] 📥 Resposta:', JSON.stringify(otpResponse));
        
        if (!otpError && otpResponse?.success) {
          otpSentViaEmail = true;
          otpCode = otpResponse.code; // FASE 2: Usar o código ÚNICO gerado pelo send-verification-code
          devMode = otpResponse.dev_mode || false;
          
          console.log('[handle-whatsapp-event] ✅ OTP gerado e salvo pelo send-verification-code');
          console.log('[handle-whatsapp-event] 🔑 Código OTP:', otpCode);
          console.log('[handle-whatsapp-event] 📧 Email enviado:', otpSentViaEmail);
          console.log('[handle-whatsapp-event] 🔧 Dev mode:', devMode);
        } else if (otpError?.message?.includes('429') || otpError?.status === 429 || otpResponse?.error?.includes('Limite')) {
          // FASE 1: Tratamento específico para rate limit (429)
          console.error('[handle-whatsapp-event] ⏰ Rate limit atingido (429)');
          
          await sendWhatsAppMessage(
            supabase,
            instance,
            phoneForDatabase,
            jidForSending,
            `⏰ *Limite de verificações atingido*\n\n` +
            `Você solicitou muitos códigos recentemente. ` +
            `Por favor, aguarde 1 hora antes de tentar novamente.\n\n` +
            `Se precisar de ajuda urgente, um atendente humano vai te ajudar.`
          );
          
          // Mudar para copilot para agente assumir
          await supabase
            .from('conversations')
            .update({ ai_mode: 'copilot' })
            .eq('id', conversationId);
          
          console.log('[handle-whatsapp-event] 🔄 Conversa mudou para Copilot devido ao rate limit');
          return new Response(JSON.stringify({ success: true, rate_limited: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          console.error('[handle-whatsapp-event] ❌ Erro ao enviar OTP:', otpError);
        }
      } catch (emailError) {
        console.error('[handle-whatsapp-event] ❌ Exceção ao enviar OTP:', emailError);
      }

      // Calcular expiration e atualizar metadata da conversa
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
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

      // FASE 2 & 3: Mensagem WhatsApp adaptada ao contexto
      let whatsappMessage: string;
      
      if (!otpSentViaEmail && otpCode) {
        // FASE 3: Email falhou - enviar código via WhatsApp como fallback
        whatsappMessage = `🔐 *Verificação de Identidade*\n\nLocalizei um cadastro com este e-mail.\n\n⚠️ O envio por email falhou.\n\n🔑 Seu código de verificação é: *${otpCode}*\n\nDigite o código aqui para confirmar sua identidade.`;
        console.log('[handle-whatsapp-event] 📱 FALLBACK: Enviando OTP via WhatsApp porque email falhou');
      } else if (otpSentViaEmail) {
        // Modo normal: email enviado com sucesso
        whatsappMessage = `🔐 *Verificação de Identidade*\n\nLocalizei um cadastro com este e-mail. Por segurança, enviei um código de 6 dígitos para *${claimedEmail}*.\n\nDigite o código aqui para confirmar sua identidade e acessar seu histórico.`;
        console.log('[handle-whatsapp-event] ✅ Modo normal: OTP enviado via email');
      } else {
        // Erro crítico: nem email nem código disponível
        whatsappMessage = `🔐 *Verificação de Identidade*\n\n❌ Houve um erro ao gerar o código de verificação. Por favor, tente novamente em alguns minutos.`;
        console.error('[handle-whatsapp-event] ❌ ERRO CRÍTICO: Nem email nem código disponível');
      }
      
      // Log dev mode internally (never show code to client)
      if (devMode) {
        console.log('[handle-whatsapp-event] ⚠️ DEV MODE: Código OTP não enviado por email - verifique logs do servidor');
      }
      
      await sendWhatsAppMessage(
        supabase,
        instance,
        phoneForDatabase,
        jidForSending,
        whatsappMessage
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
  } else {
    // FASE 4: Cliente conhecido - pular completamente a verificação
    console.log('[handle-whatsapp-event] ✅ Cliente conhecido - email já verificado anteriormente');
    console.log('[handle-whatsapp-event] ⏭️ Pulando Identity Wall - permitindo acesso direto');
  }

  // 4. FASE 2: Vincular instância e atribuir conversa (normal flow)
  // 🔧 FIX: Buscar ai_mode ATUAL da conversa para NÃO sobrescrever se atendente já assumiu
  const { data: currentConv } = await supabase
    .from('conversations')
    .select('ai_mode, assigned_to')
    .eq('id', conversationId)
    .single();

  const updateData: any = {
    whatsapp_instance_id: instance.id,
  };

  // 🔧 FIX: Só definir ai_mode se a conversa não tiver (nova) ou se for null
  // NUNCA sobrescrever copilot, disabled, ou waiting_human - atendente já assumiu!
  if (!currentConv?.ai_mode || currentConv.ai_mode === null) {
    updateData.ai_mode = instance.ai_mode;
    console.log('[handle-whatsapp-event] Setting initial ai_mode:', instance.ai_mode);
  } else {
    console.log('[handle-whatsapp-event] ⚠️ Preservando ai_mode existente:', currentConv.ai_mode, '(não sobrescrevendo)');
  }

  // 🔧 FIX: Só atribuir ao dono da instância se ainda não tiver assigned_to
  if (instance.user_id && !currentConv?.assigned_to) {
    updateData.assigned_to = instance.user_id;
    console.log('[handle-whatsapp-event] Assigned to owner:', instance.user_id);
  } else if (currentConv?.assigned_to) {
    console.log('[handle-whatsapp-event] ⚠️ Preservando assigned_to existente:', currentConv.assigned_to);
  }

  await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  // 5. Inserir mensagem do cliente
  const newMessage = {
    conversation_id: conversationId,
    content: messageText || (hasMedia ? '' : '[Mensagem vazia]'),
    sender_type: 'contact',
    sender_id: null,
    is_ai_generated: false,
    channel: 'whatsapp', // ✅ FASE 3: Rastrear origem da mensagem
  };

  console.log('[handle-whatsapp-event] 📨 Trying to insert message:', newMessage);

  const { data: insertedMessage, error: messageError } = await supabase
    .from('messages')
    .insert(newMessage)
    .select('id')
    .single();

  if (messageError) {
    console.error('[handle-whatsapp-event] Error inserting message:', messageError);
    throw messageError;
  }

  console.log('[handle-whatsapp-event] Message inserted successfully:', insertedMessage?.id);

  // 📸 FASE 5: Se tem mídia, baixar e salvar como attachment
  if (hasMedia && insertedMessage?.id) {
    console.log(`[handle-whatsapp-event] 📸 Processing media attachment for message ${insertedMessage.id}`);
    console.log(`[handle-whatsapp-event] 📸 Media structure check:`, JSON.stringify({
      hasImageMessage: !!data.message?.imageMessage,
      hasVideoMessage: !!data.message?.videoMessage,
      hasAudioMessage: !!data.message?.audioMessage,
      hasPttMessage: !!data.message?.pttMessage,
      hasDocumentMessage: !!data.message?.documentMessage,
      hasStickerMessage: !!data.message?.stickerMessage,
    }));
    
    try {
      // CORREÇÃO: Passar data.message (onde estão imageMessage, audioMessage, etc.)
      // não o objeto data completo
      const mediaResult = await downloadAndSaveMedia(supabase, instance, data.message, conversationId);
      
      if (mediaResult) {
        // Criar entrada em media_attachments
        const attachmentData = {
          message_id: insertedMessage.id,
          conversation_id: conversationId,
          storage_bucket: 'chat-attachments',
          storage_path: mediaResult.storagePath,
          mime_type: mediaResult.mimeType,
          file_size: mediaResult.size,
          original_filename: `whatsapp_${mediaInfo?.type || 'media'}`,
          status: 'ready',
          duration_seconds: mediaResult.durationSeconds || null,
        };
        
        const { error: attachmentError } = await supabase
          .from('media_attachments')
          .insert(attachmentData);
        
        if (attachmentError) {
          console.error('[handle-whatsapp-event] ❌ Error creating media_attachment:', attachmentError);
        } else {
          console.log('[handle-whatsapp-event] ✅ Media attachment created successfully');
        }
      } else {
        console.log('[handle-whatsapp-event] ⚠️ Could not download media - message saved without attachment');
      }
    } catch (mediaError) {
      console.error('[handle-whatsapp-event] ❌ Error processing media:', mediaError);
      // Não falhar a mensagem toda por causa de erro no media
    }
  }

  // 6. Verificar toggle global de IA ANTES de processar
  const { data: globalAIConfig } = await supabase
    .from('system_configurations')
    .select('value')
    .eq('key', 'ai_global_enabled')
    .maybeSingle();

  const isAIGloballyEnabled = globalAIConfig?.value !== 'false';
  
  console.log('[handle-whatsapp-event] 🤖 AI Global Status:', isAIGloballyEnabled ? 'ENABLED' : 'DISABLED');
  console.log('[handle-whatsapp-event] 🤖 Instance AI Mode:', instance.ai_mode);
  
  // 🔧 FIX: Usar ai_mode da CONVERSA, não da instância!
  // Isso garante que se atendente assumiu (copilot), IA não responde automaticamente
  const conversationAIMode = currentConv?.ai_mode || instance.ai_mode;
  console.log('[handle-whatsapp-event] 🤖 Conversation AI Mode (decisão final):', conversationAIMode);

  // 7. Se ai_mode = 'autopilot' E IA global está ativada, disparar AI
  if (isAIGloballyEnabled && conversationAIMode === 'autopilot') {
    console.log('[handle-whatsapp-event] Triggering AI autopilot...');
    
    try {
      // 🚨 FASE 3: INVOCAR AI E INTERCEPTAR FALLBACK
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-autopilot-chat', {
        body: {
          conversationId: conversationId,
          customerMessage: messageText,
          customer_context: isKnownCustomer ? {
            name: contactName,
            email: existingContact?.email,
            isVerified: true
          } : null
        },
      });
      
      if (!aiError && aiResponse) {
        console.log('[handle-whatsapp-event] ✅ AI response received');
        
        // 🚨 INTERCEPTADOR DE FALLBACK NO WEBHOOK WHATSAPP
        const responseMessage = aiResponse.message || '';
        const fallbackPhrases = [
          'vou chamar um especialista',
          'transferir para um atendente',
          'não consegui registrar',
          'não tenho essa informação',
          'transferindo você',
          'chamar um atendente humano'
        ];
        
        const isFallbackResponse = fallbackPhrases.some(phrase => 
          responseMessage.toLowerCase().includes(phrase)
        );
        
        if (isFallbackResponse) {
          console.log('🚨 [handle-whatsapp-event] Fallback detectado na resposta da IA - Forçando handoff');
          
          try {
            const { error: routeError } = await supabase.functions.invoke('route-conversation', {
              body: { conversationId }
            });
            
            if (!routeError) {
              console.log('✅ [handle-whatsapp-event] Handoff forçado via interceptador');
            } else {
              console.error('❌ [handle-whatsapp-event] Erro ao forçar handoff:', routeError);
            }
          } catch (error) {
            console.error('❌ [handle-whatsapp-event] Exceção ao forçar handoff:', error);
          }
        }
      }
      
      console.log('[handle-whatsapp-event] AI triggered successfully');
    } catch (aiError) {
      console.error('[handle-whatsapp-event] Error triggering AI:', aiError);
    }
  } else if (isAIGloballyEnabled && instance.ai_mode === 'copilot') {
    console.log('[handle-whatsapp-event] Copilot mode - generating suggestion...');
    
    try {
      await supabase.functions.invoke('generate-smart-reply', {
        body: {
          conversationId: conversationId,
        },
      });
      console.log('[handle-whatsapp-event] Copilot suggestion generated');
    } catch (copilotError) {
      console.error('[handle-whatsapp-event] Error generating copilot suggestion:', copilotError);
    }
  } else {
    console.log('[handle-whatsapp-event] ⏸️ AI skipped - Global:', isAIGloballyEnabled, 'Instance mode:', instance.ai_mode);
    
    // 🆕 DISTRIBUIÇÃO SEM IA: Se não tem agente atribuído, distribuir para fila humana
    const { data: convData } = await supabase
      .from('conversations')
      .select('assigned_to, status')
      .eq('id', conversationId)
      .single();
      
    if (!convData?.assigned_to && convData?.status === 'open') {
      console.log('[handle-whatsapp-event] 📢 IA desligada - Distribuindo para fila humana');
      
      try {
        await supabase.functions.invoke('route-conversation', {
          body: { conversationId }
        });
        console.log('[handle-whatsapp-event] ✅ Conversa enviada para distribuição');
      } catch (routeError) {
        console.error('[handle-whatsapp-event] ❌ Erro ao distribuir:', routeError);
      }
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

  console.log(`[handle-whatsapp-event] 🔐 Validating OTP attempt ${attempts + 1}/2`);

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
      currentWhatsAppId,
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

    if (newAttempts >= 2) {
      // 🚨 BLOQUEIO POR EXCESSO DE TENTATIVAS (MÁXIMO 2)
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
        .select('contacts(phone, whatsapp_id)')
        .eq('id', conversationId)
        .single();

      await sendWhatsAppMessage(
        supabase,
        instance,
        conv.contacts.phone,
        conv.contacts.whatsapp_id,
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
        .select('contacts(phone, whatsapp_id)')
        .eq('id', conversationId)
        .single();

      await sendWhatsAppMessage(
        supabase,
        instance,
        conv.contacts.phone,
        conv.contacts.whatsapp_id,
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

// 📊 Função auxiliar: Extrair rating (1-5) da mensagem
function extractRating(message: string): number | null {
  const normalized = message.toLowerCase().trim();
  
  // Detectar número direto: "5", "4", etc.
  const numMatch = normalized.match(/^[1-5]$/);
  if (numMatch) return parseInt(numMatch[0]);
  
  // Detectar estrelas emoji: "⭐⭐⭐⭐⭐"
  const starCount = (message.match(/⭐/g) || []).length;
  if (starCount >= 1 && starCount <= 5) return starCount;
  
  // Detectar texto: "excelente" (5), "ruim" (1), etc.
  const textRatings: Record<string, number> = {
    'excelente': 5, 'otimo': 5, 'ótimo': 5, 'perfeito': 5, 'incrivel': 5, 'incrível': 5, 'maravilhoso': 5, 'show': 5,
    'bom': 4, 'legal': 4, 'bacana': 4, 'massa': 4,
    'regular': 3, 'ok': 3, 'medio': 3, 'médio': 3, 'razoavel': 3, 'razoável': 3,
    'ruim': 2, 'fraco': 2, 'poderia ser melhor': 2,
    'pessimo': 1, 'péssimo': 1, 'horrivel': 1, 'horrível': 1, 'terrivel': 1, 'terrível': 1
  };
  
  for (const [text, rating] of Object.entries(textRatings)) {
    if (normalized.includes(text)) return rating;
  }
  
  return null;
}

// 📸 Função auxiliar: Detectar tipo de mídia na mensagem
function detectMediaType(message: any): MediaInfo | null {
  if (message?.imageMessage) {
    return {
      type: 'image',
      mimeType: message.imageMessage.mimetype || 'image/jpeg',
      caption: message.imageMessage.caption,
    };
  }
  if (message?.audioMessage) {
    return {
      type: 'audio',
      mimeType: message.audioMessage.mimetype || 'audio/ogg',
      durationSeconds: message.audioMessage.seconds,
    };
  }
  if (message?.pttMessage) {
    return {
      type: 'audio',
      mimeType: message.pttMessage.mimetype || 'audio/ogg',
      durationSeconds: message.pttMessage.seconds,
    };
  }
  if (message?.videoMessage) {
    return {
      type: 'video',
      mimeType: message.videoMessage.mimetype || 'video/mp4',
      caption: message.videoMessage.caption,
      durationSeconds: message.videoMessage.seconds,
    };
  }
  if (message?.documentMessage) {
    return {
      type: 'document',
      mimeType: message.documentMessage.mimetype || 'application/octet-stream',
      caption: message.documentMessage.caption,
      fileName: message.documentMessage.fileName,
    };
  }
  if (message?.stickerMessage) {
    return {
      type: 'sticker',
      mimeType: message.stickerMessage.mimetype || 'image/webp',
    };
  }
  return null;
}

// 📥 Função auxiliar: Baixar mídia da Evolution API e salvar no Storage
async function downloadAndSaveMedia(
  supabase: any,
  instance: any,
  messageData: any,
  conversationId: string
): Promise<{ storagePath: string; mimeType: string; size: number; durationSeconds?: number } | null> {
  try {
    const mediaInfo = detectMediaType(messageData);
    if (!mediaInfo) {
      console.log('[handle-whatsapp-event] 📸 No media detected in message');
      return null;
    }

    console.log(`[handle-whatsapp-event] 📸 Media detected: ${mediaInfo.type} (${mediaInfo.mimeType})`);

    // Montar URL da Evolution API
    const baseUrl = instance.api_url.replace(/\/manager$/, '').replace(/\/$/, '');
    const apiKey = instance.api_token;

    if (!baseUrl || !apiKey) {
      console.error('[handle-whatsapp-event] ❌ Missing API URL or token for media download');
      return null;
    }

    // Baixar mídia via Evolution API (getBase64FromMediaMessage)
    console.log(`[handle-whatsapp-event] 📥 Downloading media from Evolution API...`);
    
    const downloadResponse = await fetch(
      `${baseUrl}/chat/getBase64FromMediaMessage/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          message: messageData,
          convertToMp4: mediaInfo.type === 'audio', // Converter áudio para formato compatível
        }),
      }
    );

    if (!downloadResponse.ok) {
      console.error(`[handle-whatsapp-event] ❌ Failed to download media: HTTP ${downloadResponse.status}`);
      const errorText = await downloadResponse.text();
      console.error('[handle-whatsapp-event] Error details:', errorText);
      return null;
    }

    const mediaResult = await downloadResponse.json();
    const base64Data = mediaResult.base64;
    const actualMimeType = mediaResult.mimetype || mediaInfo.mimeType;

    if (!base64Data) {
      console.error('[handle-whatsapp-event] ❌ No base64 data returned from Evolution API');
      return null;
    }

    console.log(`[handle-whatsapp-event] ✅ Media downloaded: ${base64Data.length} chars base64, mime: ${actualMimeType}`);

    // Converter base64 para buffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Determinar extensão do arquivo
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'audio/ogg': 'ogg',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/opus': 'opus',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'application/pdf': 'pdf',
    };
    const extension = extensionMap[actualMimeType] || 'bin';
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const filename = `whatsapp_${mediaInfo.type}_${timestamp}_${randomId}.${extension}`;
    const storagePath = `whatsapp/${instance.id}/${filename}`;

    // Upload para Supabase Storage
    console.log(`[handle-whatsapp-event] 📤 Uploading to storage: ${storagePath}`);
    
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(storagePath, bytes, {
        contentType: actualMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[handle-whatsapp-event] ❌ Storage upload failed:', uploadError);
      return null;
    }

    console.log(`[handle-whatsapp-event] ✅ Media saved to storage: ${storagePath}`);

    return {
      storagePath,
      mimeType: actualMimeType,
      size: bytes.length,
      durationSeconds: mediaInfo.durationSeconds,
    };
  } catch (error) {
    console.error('[handle-whatsapp-event] ❌ Error downloading media:', error);
    return null;
  }
}

// 📤 Função auxiliar: Enviar mensagem WhatsApp
async function sendWhatsAppMessage(
  supabase: any,
  instance: any,
  phone: string,
  whatsappId: string | null,
  message: string
) {
  try {
    await supabase.functions.invoke('send-whatsapp-message', {
      body: {
        instance_id: instance.id,
        phone_number: phone,
        whatsapp_id: whatsappId,
        message: message,
      },
    });
  } catch (error) {
    console.error('[handle-whatsapp-event] Error sending WhatsApp message:', error);
  }
}

async function handleConnectionUpdate(supabase: any, payload: EvolutionWebhook, instance: any) {
  console.log('[handle-whatsapp-event] Connection update:', payload.data);
  
  const { data } = payload;
  const stateInfo = data as any;
  const state = stateInfo?.state || stateInfo?.connection;
  
  // Mapear estados da Evolution API para nossos estados
  let newStatus: string | null = null;
  
  switch (state) {
    case 'open':
      newStatus = 'connected';
      break;
    case 'connecting':
      // NÃO atualizar durante connecting - aguardar estado final
      console.log('[handle-whatsapp-event] Instance is connecting, skipping status update');
      return;
    case 'close':
      newStatus = 'disconnected';
      break;
    default:
      console.log('[handle-whatsapp-event] Unknown state:', state, '- skipping update');
      return;
  }

  // Preparar dados de atualização
  const updateData: any = { 
    status: newStatus,
    last_health_check: new Date().toISOString(),
  };
  
  // Reset failures quando conectar
  if (newStatus === 'connected') {
    updateData.consecutive_failures = 0;
  }

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('id', instance.id);

  console.log('[handle-whatsapp-event] Instance status updated to:', newStatus);

  // 🚨 ALERTA: Se desconectou, tentar reconectar automaticamente
  if (newStatus === 'disconnected') {
    console.log(`[handle-whatsapp-event] 🚨 Instância ${instance.name} desconectada - tentando reconexão automática`);
    
    // Incrementar contador de falhas consecutivas
    const consecutiveFailures = (instance.consecutive_failures || 0) + 1;
    await supabase
      .from('whatsapp_instances')
      .update({ consecutive_failures: consecutiveFailures })
      .eq('id', instance.id);
    
    // Tentar reconexão automática se menos de 5 falhas consecutivas
    if (consecutiveFailures <= 5) {
      console.log(`[handle-whatsapp-event] 🔄 Tentativa de reconexão ${consecutiveFailures}/5`);
      
      // Aguardar 3 segundos antes de tentar reconectar (exponential backoff)
      const backoffMs = Math.min(3000 * consecutiveFailures, 15000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
      try {
        // Chamar reconexão via Evolution API
        const baseUrl = instance.api_url.replace(/\/manager$/, '').replace(/\/$/, '');
        const reconnectResponse = await fetch(`${baseUrl}/instance/connect/${instance.instance_name}`, {
          method: 'GET',
          headers: {
            'apikey': instance.api_token,
            'Content-Type': 'application/json',
          },
        });
        
        if (reconnectResponse.ok) {
          console.log(`[handle-whatsapp-event] ✅ Reconexão iniciada para ${instance.name}`);
          
          // Atualizar status para 'reconnecting' temporariamente
          await supabase
            .from('whatsapp_instances')
            .update({ 
              status: 'qr_pending',
              last_reconnect_attempt: new Date().toISOString(),
            })
            .eq('id', instance.id);
          
          return; // Não enviar alerta se reconexão foi iniciada
        } else {
          console.error(`[handle-whatsapp-event] ❌ Falha na reconexão: HTTP ${reconnectResponse.status}`);
        }
      } catch (reconnectError) {
        console.error(`[handle-whatsapp-event] ❌ Erro ao tentar reconectar:`, reconnectError);
      }
    }
    
    // Só envia alerta se esgotou tentativas de reconexão
    console.log(`[handle-whatsapp-event] 🚨 Esgotou tentativas - enviando alerta`);
    
    const { error: alertError } = await supabase.functions.invoke('send-admin-alert', {
      body: {
        type: 'whatsapp_disconnected',
        message: `🚨 WhatsApp "${instance.name}" desconectou após ${consecutiveFailures} tentativas`,
        error: `A instância ${instance.instance_name} perdeu conexão e não conseguiu reconectar automaticamente.`,
      },
    });

    if (alertError) {
      console.error('[handle-whatsapp-event] ❌ Erro ao enviar alerta:', alertError);
    } else {
      console.log('[handle-whatsapp-event] ✅ Alerta de desconexão enviado');
    }
  }
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
