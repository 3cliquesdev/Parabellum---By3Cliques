import { createClient } from "npm:@supabase/supabase-js@2";
import { getBusinessHoursInfo } from "../_shared/business-hours.ts";
import { resolveDepartments } from "../_shared/department-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallbacks legados (usados apenas se query falhar)
const LEGACY_DESISTENCIA_TAG_ID = 'aa44b48d-c8bf-4def-ac9f-4caa8d9bfea9';
const LEGACY_FALTA_INTERACAO_TAG_ID = '3eb75d67-c027-4c41-bdc6-8ebc414e2eb1';

/**
 * Gera mensagem de encerramento por inatividade com horário de atendimento dinâmico.
 */
function buildInactivityCloseMessage(scheduleSummary: string): string {
  return `Não recebi sua resposta, então estou encerrando este atendimento.

Nosso suporte funciona de ${scheduleSummary}. Se precisar de ajuda, entre em contato dentro desse período e teremos prazer em atendê-lo! 😊`;
}

// Mensagem de CSAT simplificada
const CSAT_MESSAGE = `📝 Antes de encerrar, pode avaliar nosso atendimento?

⭐ 1 - Muito ruim
⭐ 2 - Ruim
⭐ 3 - Regular
⭐ 4 - Bom
⭐ 5 - Excelente

Responda apenas com o número.`;

interface DepartmentConfig {
  id: string;
  name: string;
  auto_close_enabled: boolean;
  auto_close_minutes: number | null;
  send_rating_on_close: boolean;
  ai_auto_close_minutes: number | null;
  human_auto_close_minutes: number | null;
  slow_response_alert_enabled: boolean;
  slow_response_alert_minutes: number | null;
  slow_response_alert_tag_id: string | null;
}

interface ConversationToClose {
  id: string;
  contact_id: string;
  last_message_at: string;
  ai_mode: string;
  channel: string;
  department: string | null;
  whatsapp_instance_id: string | null;
  whatsapp_meta_instance_id: string | null;
  whatsapp_provider: string | null;
}

/**
 * Verifica se o contato enviou mensagem recente (dentro do threshold de inatividade).
 * Busca as últimas 3 mensagens para evitar que mensagens automáticas de bot
 * (ex: "Sua conversa já está na fila") mascarem a atividade real do cliente.
 * 
 * Retorna true se o contato está ativo (NÃO deve fechar).
 */
async function isContactRecentlyActive(
  supabase: any,
  conversationId: string,
  inactivityThresholdISO: string
): Promise<boolean> {
  const { data: recentMsgs } = await supabase
    .from('messages')
    .select('sender_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!recentMsgs || recentMsgs.length === 0) return false;

  // Se qualquer uma das últimas 3 mensagens for do contato E foi enviada
  // DEPOIS do threshold de inatividade, o contato está ativo
  for (const msg of recentMsgs) {
    if (msg.sender_type === 'contact' && msg.created_at > inactivityThresholdISO) {
      return true;
    }
  }
  return false;
}

/**
 * Busca close_tag_id configurado no nó de IA ativo da conversa.
 * Retorna o tag ID do nó ou null se não encontrar.
 */
async function getFlowCloseTagId(supabase: any, conversationId: string): Promise<string | null> {
  try {
    const { data: flowState } = await supabase
      .from('chat_flow_states')
      .select('current_node_id, flow_id')
      .eq('conversation_id', conversationId)
      .in('status', ['active', 'waiting_input', 'in_progress'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!flowState) return null;

    const { data: flow } = await supabase
      .from('chat_flows')
      .select('flow_definition')
      .eq('id', flowState.flow_id)
      .single();

    if (!flow?.flow_definition) return null;

    const nodes = (flow.flow_definition as any)?.nodes || [];
    const node = nodes.find((n: any) => n.id === flowState.current_node_id);
    return node?.data?.close_tag_id || null;
  } catch (err) {
    console.error(`[getFlowCloseTagId] Error for ${conversationId}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('[Auto-Close] Starting...');
    const depts = await resolveDepartments(supabase);

    // Resolver tags por nome (dinâmico) com fallback legado
    const { data: tagRows } = await supabase
      .from('tags')
      .select('id, name')
      .in('name', ['9.04 Desistência da conversa', '9.98 Falta de Interação']);
    const tagMap = new Map((tagRows || []).map((t: any) => [t.name.trim(), t.id]));
    const DESISTENCIA_TAG_ID = tagMap.get('9.04 Desistência da conversa') || LEGACY_DESISTENCIA_TAG_ID;
    const FALTA_INTERACAO_TAG_ID = tagMap.get('9.98 Falta de Interação') || LEGACY_FALTA_INTERACAO_TAG_ID;
    console.log(`[Auto-Close] Tags resolvidas: Desistência=${DESISTENCIA_TAG_ID}, FaltaInteração=${FALTA_INTERACAO_TAG_ID}`);

    // Buscar horário de atendimento uma vez para usar nas mensagens
    const businessHoursInfo = await getBusinessHoursInfo(supabase);
    const INACTIVITY_CLOSE_MESSAGE = buildInactivityCloseMessage(businessHoursInfo.schedule_summary);

    // ============================
    // ETAPA 1: WhatsApp Window Expired (>24h)
    // ============================
    let windowExpiredCount = 0;
    try {
      const threshold24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: expiredConvos, error: expiredError } = await supabase
        .from('conversations')
        .select('id, contact_id')
        .eq('status', 'open')
        .eq('channel', 'whatsapp')
        .lt('last_message_at', threshold24h);

      if (expiredError) {
        console.error('[Auto-Close] Error fetching expired WhatsApp convos:', expiredError);
      } else if (expiredConvos && expiredConvos.length > 0) {
        console.log(`[Auto-Close] Found ${expiredConvos.length} WhatsApp conversations with expired 24h window`);

        for (const conv of expiredConvos) {
          try {
            // Close silently - no WhatsApp message (window expired)
            await supabase
              .from('conversations')
              .update({
                status: 'closed',
                auto_closed: true,
                closed_at: new Date().toISOString(),
                closed_reason: 'whatsapp_window_expired',
                ai_mode: 'disabled',
              })
              .eq('id', conv.id);

            // Internal message only (not sent to WhatsApp)
            await supabase
              .from('messages')
              .insert({
                conversation_id: conv.id,
                content: 'Conversa encerrada automaticamente - janela de 24h do WhatsApp expirada.',
                sender_type: 'system',
              });

            // Add "Desistência" tag
            await supabase
              .from('conversation_tags')
              .upsert({
                conversation_id: conv.id,
                tag_id: DESISTENCIA_TAG_ID,
              }, {
                onConflict: 'conversation_id,tag_id',
                ignoreDuplicates: true,
              });

            windowExpiredCount++;
            console.log(`[Auto-Close] ✅ Closed expired WhatsApp conversation ${conv.id}`);
          } catch (err) {
            console.error(`[Auto-Close] Error closing expired conversation ${conv.id}:`, err);
          }
        }
      } else {
        console.log('[Auto-Close] No WhatsApp conversations with expired 24h window');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in WhatsApp window expired step:', err);
    }

    console.log(`[Auto-Close] WhatsApp window expired step: closed ${windowExpiredCount} conversations`);

    // ============================
    // ETAPA 1.5: Slow Response Alert (SLA) — NÃO encerra, apenas aplica tag protegida
    // ============================
    console.log('[Auto-Close] Starting slow response alert check (Stage 1.5)...');
    let slaAlertCount = 0;

    try {
      const { data: slaDepts, error: slaDeptError } = await supabase
        .from('departments')
        .select('id, name, slow_response_alert_enabled, slow_response_alert_minutes, slow_response_alert_tag_id')
        .eq('slow_response_alert_enabled', true)
        .not('slow_response_alert_minutes', 'is', null)
        .not('slow_response_alert_tag_id', 'is', null);

      if (slaDeptError) {
        console.error('[Auto-Close] Error fetching SLA departments:', slaDeptError);
      } else if (slaDepts && slaDepts.length > 0) {
        console.log(`[Auto-Close] Found ${slaDepts.length} departments with slow response alert enabled`);

        for (const dept of slaDepts) {
          const slaThreshold = new Date(Date.now() - dept.slow_response_alert_minutes! * 60 * 1000).toISOString();
          console.log(`[Auto-Close] SLA check for "${dept.name}" - threshold: ${dept.slow_response_alert_minutes} min`);

          // Find open conversations where the last message is from the contact (customer waiting)
          const { data: slaConvos, error: slaConvError } = await supabase
            .from('conversations')
            .select('id, contact_id, last_message_at')
            .eq('status', 'open')
            .eq('department', dept.id)
            .lt('last_message_at', slaThreshold);

          if (slaConvError) {
            console.error(`[Auto-Close] Error fetching SLA conversations for ${dept.name}:`, slaConvError);
            continue;
          }

          if (!slaConvos || slaConvos.length === 0) {
            console.log(`[Auto-Close] No SLA-breaching conversations in "${dept.name}"`);
            continue;
          }

          for (const conv of slaConvos) {
            try {
              // Verify last message is from contact (customer is waiting for our response)
              const { data: lastMsg } = await supabase
                .from('messages')
                .select('sender_type')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (!lastMsg || lastMsg.sender_type !== 'contact') {
                continue; // We already responded — skip
              }

              // Check if tag already applied to avoid duplicates
              const { data: existingTag } = await supabase
                .from('conversation_tags')
                .select('id')
                .eq('conversation_id', conv.id)
                .eq('tag_id', dept.slow_response_alert_tag_id!)
                .maybeSingle();

              if (existingTag) {
                continue; // Already tagged
              }

              // Apply the configured alert tag
              await supabase.from('conversation_tags').upsert({
                conversation_id: conv.id,
                tag_id: dept.slow_response_alert_tag_id!,
              }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

              // Mark as protected (agent cannot remove)
              await supabase.from('protected_conversation_tags').upsert({
                conversation_id: conv.id,
                tag_id: dept.slow_response_alert_tag_id!,
              }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

              slaAlertCount++;
              console.log(`[Auto-Close] ⚠️ SLA alert applied to conversation ${conv.id} (${dept.name}) - NOT closed`);
            } catch (err) {
              console.error(`[Auto-Close] Error applying SLA alert to ${conv.id}:`, err);
            }
          }
        }
      } else {
        console.log('[Auto-Close] No departments with slow response alert configured');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in slow response alert step:', err);
    }

    console.log(`[Auto-Close] ✅ Stage 1.5 complete - applied ${slaAlertCount} SLA alerts`);

    // ============================
    // ETAPA 2: Auto-close por departamento (inatividade configurada)
    // ============================
    console.log('[Auto-Close] Starting department-based inactivity check...');

    // 1. Buscar departamentos com auto_close_enabled = true
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, auto_close_enabled, auto_close_minutes, send_rating_on_close, ai_auto_close_minutes, human_auto_close_minutes, slow_response_alert_enabled, slow_response_alert_minutes, slow_response_alert_tag_id')
      .eq('auto_close_enabled', true)
      .not('auto_close_minutes', 'is', null);

    if (deptError) {
      console.error('[Auto-Close] Error fetching departments:', deptError);
      throw deptError;
    }

    let totalClosedCount = 0;
    const closedIds: string[] = [];
    const results: { department: string; closed: number }[] = [];

    if (!departments || departments.length === 0) {
      console.log('[Auto-Close] No departments with legacy auto_close_enabled — skipping Stage 2');
    } else {
      console.log(`[Auto-Close] Found ${departments.length} departments with auto-close enabled:`);
      departments.forEach((dept: DepartmentConfig) => {
        console.log(`  - ${dept.name}: ${dept.auto_close_minutes} min, CSAT: ${dept.send_rating_on_close}`);
      });

      // 2. Processar cada departamento com sua configuração específica
      for (const dept of departments as DepartmentConfig[]) {
      if (!dept.auto_close_minutes) continue;

      const inactivityThreshold = new Date(Date.now() - dept.auto_close_minutes * 60 * 1000).toISOString();
      
      console.log(`[Auto-Close] Processing department "${dept.name}" - threshold: ${dept.auto_close_minutes} min`);

      // 3. Buscar conversas abertas deste departamento que estão inativas
      const { data: conversations, error: fetchError } = await supabase
        .from('conversations')
        .select(`
          id, 
          contact_id, 
          last_message_at,
          ai_mode,
          channel,
          department,
          whatsapp_instance_id,
          whatsapp_meta_instance_id,
          whatsapp_provider
        `)
        .eq('status', 'open')
        .eq('department', dept.id)
        .eq('ai_mode', 'autopilot')
        .lt('last_message_at', inactivityThreshold);

      if (fetchError) {
        console.error(`[Auto-Close] Error fetching conversations for ${dept.name}:`, fetchError);
        continue;
      }

      console.log(`[Auto-Close] Found ${conversations?.length || 0} potentially inactive conversations in "${dept.name}"`);

      if (!conversations || conversations.length === 0) {
        results.push({ department: dept.name, closed: 0 });
        continue;
      }

      let deptClosedCount = 0;

      for (const conversation of conversations as ConversationToClose[]) {
        try {
          // 4. Verificar se o contato enviou mensagem recente (últimas 3 msgs)
          const contactActive = await isContactRecentlyActive(supabase, conversation.id, inactivityThreshold);
          if (contactActive) {
            console.log(`[Auto-Close] Skipping ${conversation.id} - contact recently active (last 3 msgs check)`);
            continue;
          }

          console.log(`[Auto-Close] Processing conversation ${conversation.id} in "${dept.name}"...`);

          // 5. Enviar mensagem de encerramento
          await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              content: INACTIVITY_CLOSE_MESSAGE,
              sender_type: 'user',
            });

           // 6. Adicionar tag do fluxo ou "9.98 Falta de Interação" (respeitar tags existentes da IA)
          const { data: existingTags2 } = await supabase
            .from('conversation_tags')
            .select('tag_id')
            .eq('conversation_id', conversation.id);
          
          if (existingTags2 && existingTags2.length > 0) {
            console.log(`[Auto-Close] Stage 2: Conversa ${conversation.id} já tem ${existingTags2.length} tag(s) — mantendo tags existentes`);
          } else {
            const flowCloseTag3 = await getFlowCloseTagId(supabase, conversation.id);
            await supabase
              .from('conversation_tags')
              .upsert({
                conversation_id: conversation.id,
                tag_id: flowCloseTag3 || FALTA_INTERACAO_TAG_ID,
              }, {
                onConflict: 'conversation_id,tag_id',
                ignoreDuplicates: true
              });
          }

          // 7. Enviar CSAT ANTES de fechar (se configurado)
          if (dept.send_rating_on_close) {
            await supabase
              .from('messages')
              .insert({
                conversation_id: conversation.id,
                content: CSAT_MESSAGE,
                sender_type: 'user',
              });

            // Enviar via WhatsApp se for canal WhatsApp
            if (conversation.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conversation, INACTIVITY_CLOSE_MESSAGE, CSAT_MESSAGE);
            }
          } else if (conversation.channel === 'whatsapp') {
            // Enviar apenas mensagem de encerramento se não envia CSAT
            await sendWhatsAppMessages(supabase, conversation, INACTIVITY_CLOSE_MESSAGE, null);
          }

          // 8. AGORA fechar a conversa (DEPOIS do CSAT)
          const updateData: Record<string, unknown> = {
            status: 'closed',
            auto_closed: true,
            closed_at: new Date().toISOString(),
            closed_reason: 'inactivity',
            ai_mode: 'disabled',
          };

          // Se send_rating_on_close = true, marcar para aguardar avaliação
          if (dept.send_rating_on_close) {
            updateData.awaiting_rating = true;
            updateData.rating_sent_at = new Date().toISOString();
          }

          await supabase
            .from('conversations')
            .update(updateData)
            .eq('id', conversation.id);

          deptClosedCount++;
          totalClosedCount++;
          closedIds.push(conversation.id);
          console.log(`[Auto-Close] ✅ Closed conversation ${conversation.id} (${dept.name}) - closed_reason: inactivity`);
        } catch (err) {
          console.error(`[Auto-Close] Error closing conversation ${conversation.id}:`, err);
        }
      }

      results.push({ department: dept.name, closed: deptClosedCount });
      }

      console.log(`[Auto-Close] ✅ Stage 2 complete - closed ${totalClosedCount} conversations`);
      console.log('[Auto-Close] Results by department:', JSON.stringify(results));
    } // end else (legacy auto_close_enabled)

    // ============================
    // ETAPA 3: AI inactivity auto-close (ai_auto_close_minutes por departamento)
    // ============================
    console.log('[Auto-Close] Starting AI inactivity check (Stage 3)...');

    let aiClosedCount = 0;

    // Buscar departamentos com ai_auto_close_minutes configurado
    const { data: aiDepartments, error: aiDeptError } = await supabase
      .from('departments')
      .select('id, name, ai_auto_close_minutes, send_rating_on_close, ai_auto_close_tag_id')
      .not('ai_auto_close_minutes', 'is', null);

    if (aiDeptError) {
      console.error('[Auto-Close] Error fetching AI departments:', aiDeptError);
    } else if (aiDepartments && aiDepartments.length > 0) {
      console.log(`[Auto-Close] Found ${aiDepartments.length} departments with AI auto-close configured`);

      for (const dept of aiDepartments) {
        const aiThreshold = new Date(Date.now() - dept.ai_auto_close_minutes! * 60 * 1000).toISOString();
        console.log(`[Auto-Close] AI check for "${dept.name}" - threshold: ${dept.ai_auto_close_minutes} min`);

        const { data: aiConvos, error: aiConvError } = await supabase
          .from('conversations')
          .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider')
          .eq('status', 'open')
          .eq('department', dept.id)
          .eq('ai_mode', 'autopilot')
          .lt('last_message_at', aiThreshold);

        if (aiConvError) {
          console.error(`[Auto-Close] Error fetching AI conversations for ${dept.name}:`, aiConvError);
          continue;
        }

        if (!aiConvos || aiConvos.length === 0) {
          console.log(`[Auto-Close] No AI inactive conversations in "${dept.name}"`);
          continue;
        }

        for (const conv of aiConvos as ConversationToClose[]) {
          // Pular se já foi fechado nas etapas anteriores
          if (closedIds.includes(conv.id)) continue;

          try {
            // Verificar se o contato enviou mensagem recente (últimas 3 msgs)
            const contactActive = await isContactRecentlyActive(supabase, conv.id, aiThreshold);
            if (contactActive) {
              console.log(`[Auto-Close] AI skip ${conv.id} - contact recently active (last 3 msgs check)`);
              continue;
            }

            // 🆕 SAFETY NET: Verificar se existe flow ativo com ai_exit_intent
            // Se sim, transferir para o departamento correto em vez de fechar
            const { data: activeFlowState } = await supabase
              .from('chat_flow_states')
              .select('id, collected_data')
              .eq('conversation_id', conv.id)
              .in('status', ['active', 'waiting_input', 'in_progress'])
              .order('started_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeFlowState?.collected_data) {
              const cd = activeFlowState.collected_data as Record<string, any>;
              const exitIntent = cd.ai_exit_intent;
              if (exitIntent) {
                const INTENT_DEPT_MAP = depts.INTENT_MAP;
                const transferDeptId = INTENT_DEPT_MAP[exitIntent];
                if (transferDeptId) {
                  console.log(`[Auto-Close] 🔄 Safety net: conv ${conv.id} tem ai_exit_intent="${exitIntent}" → transferindo para dept ${transferDeptId} em vez de fechar`);
                  await supabase.from('conversations').update({
                    department: transferDeptId,
                    ai_mode: 'waiting_human',
                    assigned_to: null,
                  }).eq('id', conv.id);
                  // Marcar flow como transferred
                  await supabase.from('chat_flow_states').update({
                    status: 'transferred',
                    completed_at: new Date().toISOString(),
                  }).eq('id', activeFlowState.id);
                  console.log(`[Auto-Close] ✅ Safety net applied: conv ${conv.id} → dept ${transferDeptId} (waiting_human)`);
                  continue;
                }
              }
            }

            const AI_CLOSE_MESSAGE = INACTIVITY_CLOSE_MESSAGE;

            // Inserir mensagem de encerramento
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              content: AI_CLOSE_MESSAGE,
              sender_type: 'user',
            });

            // Tag do fluxo → departamento → fallback padrão (respeitar tags existentes da IA)
            const { data: existingTags3a } = await supabase
              .from('conversation_tags')
              .select('tag_id')
              .eq('conversation_id', conv.id);
            
            if (existingTags3a && existingTags3a.length > 0) {
              console.log(`[Auto-Close] Stage 3: Conversa ${conv.id} já tem ${existingTags3a.length} tag(s) — mantendo tags existentes`);
            } else {
              const flowCloseTag3a = await getFlowCloseTagId(supabase, conv.id);
              const aiTagId = flowCloseTag3a || dept.ai_auto_close_tag_id || FALTA_INTERACAO_TAG_ID;
              await supabase.from('conversation_tags').upsert({
                conversation_id: conv.id,
                tag_id: aiTagId,
              }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });
            }

            // CSAT se configurado
            if (dept.send_rating_on_close) {
              await supabase.from('messages').insert({
                conversation_id: conv.id,
                content: CSAT_MESSAGE,
                sender_type: 'user',
              });

              if (conv.channel === 'whatsapp') {
                await sendWhatsAppMessages(supabase, conv, AI_CLOSE_MESSAGE, CSAT_MESSAGE);
              }
            } else if (conv.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conv, AI_CLOSE_MESSAGE, null);
            }

            // Fechar conversa
            const closeData: Record<string, unknown> = {
              status: 'closed',
              auto_closed: true,
              closed_at: new Date().toISOString(),
              closed_reason: 'ai_inactivity',
              ai_mode: 'disabled',
            };

            if (dept.send_rating_on_close) {
              closeData.awaiting_rating = true;
              closeData.rating_sent_at = new Date().toISOString();
            }

            await supabase.from('conversations').update(closeData).eq('id', conv.id);

            aiClosedCount++;
            closedIds.push(conv.id);
            console.log(`[Auto-Close] ✅ AI closed conversation ${conv.id} (${dept.name}) - ai_inactivity`);
          } catch (err) {
            console.error(`[Auto-Close] Error AI-closing ${conv.id}:`, err);
          }
        }
      }
    } else {
      console.log('[Auto-Close] No departments with AI auto-close configured');
    }

    console.log(`[Auto-Close] ✅ Stage 3 complete - AI closed ${aiClosedCount} conversations`);

    // ============================
    // ETAPA 3b: AI inactivity para conversas SEM departamento (fallback 5 min)
    // ============================
    console.log('[Auto-Close] Starting no-department AI inactivity check (Stage 3b)...');

    let noDeptClosedCount = 0;
    const noDeptThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    try {
      const { data: noDeptConvos, error: noDeptError } = await supabase
        .from('conversations')
        .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider')
        .eq('status', 'open')
        .eq('ai_mode', 'autopilot')
        .is('department', null)
        .lt('last_message_at', noDeptThreshold);

      if (noDeptError) {
        console.error('[Auto-Close] Error fetching no-dept conversations:', noDeptError);
      } else if (noDeptConvos && noDeptConvos.length > 0) {
        console.log(`[Auto-Close] Found ${noDeptConvos.length} no-department AI conversations inactive >5min`);

        for (const conv of noDeptConvos as ConversationToClose[]) {
          if (closedIds.includes(conv.id)) continue;

          try {
            // Verificar se o contato enviou mensagem recente (últimas 3 msgs)
            const contactActive = await isContactRecentlyActive(supabase, conv.id, noDeptThreshold);
            if (contactActive) {
              console.log(`[Auto-Close] No-dept skip ${conv.id} - contact recently active (last 3 msgs check)`);
              continue;
            }

            // 🆕 SAFETY NET: Verificar se existe flow ativo com ai_exit_intent
            // Se sim, transferir para o departamento correto em vez de fechar
            const { data: activeFlowState } = await supabase
              .from('chat_flow_states')
              .select('id, collected_data')
              .eq('conversation_id', conv.id)
              .in('status', ['active', 'waiting_input', 'in_progress'])
              .order('started_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeFlowState?.collected_data) {
              const cd = activeFlowState.collected_data as Record<string, any>;
              const exitIntent = cd.ai_exit_intent;
              if (exitIntent) {
                const INTENT_DEPT_MAP = depts.INTENT_MAP;
                const transferDeptId = INTENT_DEPT_MAP[exitIntent];
                if (transferDeptId) {
                  console.log(`[Auto-Close] 🔄 No-dept safety net: conv ${conv.id} tem ai_exit_intent="${exitIntent}" → transferindo para dept ${transferDeptId}`);
                  await supabase.from('conversations').update({
                    department: transferDeptId,
                    ai_mode: 'waiting_human',
                    assigned_to: null,
                  }).eq('id', conv.id);
                  await supabase.from('chat_flow_states').update({
                    status: 'transferred',
                    completed_at: new Date().toISOString(),
                  }).eq('id', activeFlowState.id);
                  console.log(`[Auto-Close] ✅ No-dept safety net applied: conv ${conv.id} → dept ${transferDeptId}`);
                  continue;
                }
              }
            }

            const AI_CLOSE_MESSAGE = INACTIVITY_CLOSE_MESSAGE;

            // Inserir mensagem de encerramento
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              content: AI_CLOSE_MESSAGE,
              sender_type: 'user',
            });

            // Tag do fluxo ou "9.98 Falta de Interação" (respeitar tags existentes da IA)
            const { data: existingTags3b } = await supabase
              .from('conversation_tags')
              .select('tag_id')
              .eq('conversation_id', conv.id);
            
            if (existingTags3b && existingTags3b.length > 0) {
              console.log(`[Auto-Close] Stage 3b: Conversa ${conv.id} já tem ${existingTags3b.length} tag(s) — mantendo tags existentes`);
            } else {
              const flowCloseTag3b = await getFlowCloseTagId(supabase, conv.id);
              await supabase.from('conversation_tags').upsert({
                conversation_id: conv.id,
                tag_id: flowCloseTag3b || FALTA_INTERACAO_TAG_ID,
              }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });
            }

            // Enviar via WhatsApp se necessário (sem CSAT - não há departamento)
            if (conv.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conv, AI_CLOSE_MESSAGE, null);
            }

            // Fechar conversa (sem CSAT - sem departamento para consultar config)
            await supabase.from('conversations').update({
              status: 'closed',
              auto_closed: true,
              closed_at: new Date().toISOString(),
              closed_reason: 'ai_inactivity',
              ai_mode: 'disabled',
            }).eq('id', conv.id);

            noDeptClosedCount++;
            closedIds.push(conv.id);
            console.log(`[Auto-Close] ✅ No-dept AI closed conversation ${conv.id} - ai_inactivity (no department)`);
          } catch (err) {
            console.error(`[Auto-Close] Error closing no-dept conversation ${conv.id}:`, err);
          }
        }
      } else {
        console.log('[Auto-Close] No no-department AI conversations to close');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in no-department AI step:', err);
    }

    console.log(`[Auto-Close] ✅ Stage 3b complete - no-dept AI closed ${noDeptClosedCount} conversations`);

    // ============================
    // ETAPA 3.5: Auto-close awaiting_close_confirmation sem resposta (5 min)
    // ============================
    console.log('[Auto-Close] Starting awaiting_close_confirmation check (Stage 3.5)...');

    let awaitingCloseCount = 0;
    const awaitingCloseThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    try {
      // Buscar conversas abertas com awaiting_close_confirmation=true e inativas >5min
      const { data: awaitingConvos, error: awaitingError } = await supabase
        .from('conversations')
        .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider, customer_metadata')
        .eq('status', 'open')
        .lt('last_message_at', awaitingCloseThreshold);

      if (awaitingError) {
        console.error('[Auto-Close] Error fetching awaiting_close conversations:', awaitingError);
      } else if (awaitingConvos && awaitingConvos.length > 0) {
        // Filtrar apenas as que têm awaiting_close_confirmation=true no metadata
        const confirming = awaitingConvos.filter((c: any) => {
          const meta = c.customer_metadata;
          return meta && (meta.awaiting_close_confirmation === true || meta.awaiting_close_confirmation === 'true');
        });

        console.log(`[Auto-Close] Found ${confirming.length} conversations awaiting close confirmation >5min`);

        for (const conv of confirming) {
          if (closedIds.includes(conv.id)) continue;

          try {
            // Verificar que a última mensagem NÃO é do contato (cliente não respondeu)
            const { data: lastMsg } = await supabase
              .from('messages')
              .select('sender_type')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (lastMsg && lastMsg.sender_type === 'contact') {
              console.log(`[Auto-Close] Stage 3.5 skip ${conv.id} - last message is from contact`);
              continue;
            }

            const AWAITING_CLOSE_MESSAGE = 'Como não recebi resposta, estou encerrando o atendimento. Se precisar, é só nos chamar novamente! 😊';

            // Limpar flag awaiting_close_confirmation do metadata
            const existingMeta = (conv as any).customer_metadata || {};
            const { awaiting_close_confirmation, close_reason, ...cleanMeta } = existingMeta;
            await supabase.from('conversations').update({
              customer_metadata: cleanMeta,
            }).eq('id', conv.id);

            // Inserir mensagem de encerramento
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              content: AWAITING_CLOSE_MESSAGE,
              sender_type: 'user',
            });

            // Tag do fluxo ou "9.98 Falta de Interação"
            const flowCloseTag35 = await getFlowCloseTagId(supabase, conv.id);
            await supabase.from('conversation_tags').upsert({
              conversation_id: conv.id,
              tag_id: flowCloseTag35 || FALTA_INTERACAO_TAG_ID,
            }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

            // Enviar via WhatsApp se necessário
            if (conv.channel === 'whatsapp') {
              await sendWhatsAppMessages(supabase, conv as ConversationToClose, AWAITING_CLOSE_MESSAGE, null);
            }

            // Fechar conversa
            await supabase.from('conversations').update({
              status: 'closed',
              auto_closed: true,
              closed_at: new Date().toISOString(),
              closed_reason: 'awaiting_confirmation_timeout',
              ai_mode: 'disabled',
            }).eq('id', conv.id);

            awaitingCloseCount++;
            closedIds.push(conv.id);
            console.log(`[Auto-Close] ✅ Stage 3.5 closed ${conv.id} - awaiting_confirmation_timeout`);
          } catch (err) {
            console.error(`[Auto-Close] Error in Stage 3.5 closing ${conv.id}:`, err);
          }
        }
      } else {
        console.log('[Auto-Close] No conversations awaiting close confirmation');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in Stage 3.5:', err);
    }

    console.log(`[Auto-Close] ✅ Stage 3.5 complete - closed ${awaitingCloseCount} awaiting-confirmation conversations`);

    // ============================
    // ETAPA 4: Human inactivity auto-close (human_auto_close_minutes por departamento)
    // ============================
    console.log('[Auto-Close] Starting human inactivity check (Stage 4 - Human)...');

    let humanClosedCount = 0;

    try {
      const { data: humanDepts, error: humanDeptError } = await supabase
        .from('departments')
        .select('id, name, human_auto_close_minutes, send_rating_on_close, human_auto_close_tag_id')
        .not('human_auto_close_minutes', 'is', null);

      if (humanDeptError) {
        console.error('[Auto-Close] Error fetching human auto-close departments:', humanDeptError);
      } else if (humanDepts && humanDepts.length > 0) {
        console.log(`[Auto-Close] Found ${humanDepts.length} departments with human auto-close configured`);

        for (const dept of humanDepts) {
          const humanThreshold = new Date(Date.now() - dept.human_auto_close_minutes! * 60 * 1000).toISOString();
          console.log(`[Auto-Close] Human check for "${dept.name}" - threshold: ${dept.human_auto_close_minutes} min`);

          // Buscar conversas abertas NÃO autopilot (humanas: copilot, disabled, waiting_human)
          const { data: humanConvos, error: humanConvError } = await supabase
            .from('conversations')
            .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider')
            .eq('status', 'open')
            .eq('department', dept.id)
            .neq('ai_mode', 'autopilot')
            .lt('last_message_at', humanThreshold);

          if (humanConvError) {
            console.error(`[Auto-Close] Error fetching human conversations for ${dept.name}:`, humanConvError);
            continue;
          }

          if (!humanConvos || humanConvos.length === 0) {
            console.log(`[Auto-Close] No human inactive conversations in "${dept.name}"`);
            continue;
          }

          for (const conv of humanConvos as ConversationToClose[]) {
            if (closedIds.includes(conv.id)) continue;

            try {
              // Verificar se o contato enviou mensagem recente (últimas 3 msgs)
              const contactActive = await isContactRecentlyActive(supabase, conv.id, humanThreshold);
              if (contactActive) {
                console.log(`[Auto-Close] Human skip ${conv.id} - contact recently active (last 3 msgs check)`);
                continue;
              }

              // Inserir mensagem de encerramento
              await supabase.from('messages').insert({
                conversation_id: conv.id,
                content: INACTIVITY_CLOSE_MESSAGE,
                sender_type: 'user',
              });

              // Tag configurada pelo departamento ou fallback padrão
              const tagId = dept.human_auto_close_tag_id || FALTA_INTERACAO_TAG_ID;
              await supabase.from('conversation_tags').upsert({
                conversation_id: conv.id,
                tag_id: tagId,
              }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

              // CSAT se configurado
              if (dept.send_rating_on_close) {
                await supabase.from('messages').insert({
                  conversation_id: conv.id,
                  content: CSAT_MESSAGE,
                  sender_type: 'user',
                });

                if (conv.channel === 'whatsapp') {
                  await sendWhatsAppMessages(supabase, conv, INACTIVITY_CLOSE_MESSAGE, CSAT_MESSAGE);
                }
              } else if (conv.channel === 'whatsapp') {
                await sendWhatsAppMessages(supabase, conv, INACTIVITY_CLOSE_MESSAGE, null);
              }

              // Fechar conversa
              const closeData: Record<string, unknown> = {
                status: 'closed',
                auto_closed: true,
                closed_at: new Date().toISOString(),
                closed_reason: 'human_inactivity',
                ai_mode: 'disabled',
              };

              if (dept.send_rating_on_close) {
                closeData.awaiting_rating = true;
                closeData.rating_sent_at = new Date().toISOString();
              }

              await supabase.from('conversations').update(closeData).eq('id', conv.id);

              humanClosedCount++;
              closedIds.push(conv.id);
              console.log(`[Auto-Close] ✅ Human closed conversation ${conv.id} (${dept.name}) - human_inactivity`);
            } catch (err) {
              console.error(`[Auto-Close] Error human-closing ${conv.id}:`, err);
            }
          }
        }
      } else {
        console.log('[Auto-Close] No departments with human auto-close configured');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in human inactivity step:', err);
    }

    console.log(`[Auto-Close] ✅ Stage 4 (Human) complete - closed ${humanClosedCount} conversations`);

    // ============================
    // ETAPA 5: Flow inactivity timeout check
    // Verifica flow states parados em nós de inatividade que excederam o timeout
    // ============================
    console.log('[Auto-Close] Starting flow inactivity timeout check (Stage 5)...');
    let flowInactivityCount = 0;

    try {
      // Buscar flow states em waiting_input
      const { data: waitingStates, error: waitError } = await supabase
        .from('chat_flow_states')
        .select('id, conversation_id, flow_id, current_node_id, collected_data, status')
        .eq('status', 'waiting_input');

      if (waitError) {
        console.error('[Auto-Close] Error fetching waiting flow states:', waitError);
      } else if (waitingStates && waitingStates.length > 0) {
        const now = Date.now();

        for (const state of waitingStates) {
          const collected = state.collected_data as any;
          if (!collected?.__inactivity?.timeout_minutes || !collected?.__inactivity?.started_at) {
            continue; // Not an inactivity condition
          }

          const startedAt = new Date(collected.__inactivity.started_at).getTime();
          const timeoutMs = collected.__inactivity.timeout_minutes * 60 * 1000;

          if (now - startedAt < timeoutMs) {
            continue; // Not expired yet
          }

          console.log(`[Auto-Close] ⏱ Inactivity timeout expired for flow state ${state.id} (conv: ${state.conversation_id}, timeout: ${collected.__inactivity.timeout_minutes}min)`);

          try {
            // Call process-chat-flow with inactivityTimeout flag to advance via "true" path
            const { data: flowResult, error: flowError } = await supabase.functions.invoke('process-chat-flow', {
              body: {
                conversationId: state.conversation_id,
                userMessage: '',
                inactivityTimeout: true,
              }
            });

            if (flowError) {
              console.error(`[Auto-Close] Error invoking process-chat-flow for inactivity timeout (${state.id}):`, flowError);
            } else {
              flowInactivityCount++;
              console.log(`[Auto-Close] ✅ Flow inactivity timeout processed: state=${state.id} conv=${state.conversation_id}`, flowResult);
            }
          } catch (invokeErr) {
            console.error(`[Auto-Close] Error processing inactivity timeout for ${state.id}:`, invokeErr);
          }
        }
      } else {
        console.log('[Auto-Close] No waiting flow states found');
      }
    } catch (err) {
      console.error('[Auto-Close] Error in flow inactivity check:', err);
    }

    console.log(`[Auto-Close] ✅ Stage 5 complete - processed ${flowInactivityCount} flow inactivity timeouts`);

    // ============================
    // ETAPA 6: After-Hours Cleanup — fechar waiting_human fora do horário
    // ============================
    let afterHoursClosedCount = 0;

    if (!businessHoursInfo.within_hours) {
      console.log('[Auto-Close] 🌙 FORA DO HORÁRIO — Starting after-hours waiting_human cleanup (Stage 6)...');

      try {
        // Buscar after_hours_tag_id e template da config
        const { data: afterHoursConfig } = await supabase
          .from('business_messages_config')
          .select('message_template, after_hours_tag_id')
          .eq('message_key', 'after_hours_handoff')
          .maybeSingle();

        const afterHoursTagId = afterHoursConfig?.after_hours_tag_id;
        const template = afterHoursConfig?.message_template || 'Nosso atendimento humano funciona {schedule}. Retornaremos {next_open}.';
        const afterHoursMsg = template
          .replace(/\{schedule\}/g, businessHoursInfo.schedule_summary)
          .replace(/\{next_open\}/g, businessHoursInfo.next_open_text);

        // Buscar conversas waiting_human abertas inativas há mais de 10 min
        const afterHoursThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { data: waitingConvos, error: waitingErr } = await supabase
          .from('conversations')
          .select('id, contact_id, last_message_at, ai_mode, channel, department, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider, departments:department(after_hours_keep_open)')
          .eq('status', 'open')
          .eq('ai_mode', 'waiting_human')
          .lt('last_message_at', afterHoursThreshold);

        if (waitingErr) {
          console.error('[Auto-Close] Error fetching after-hours waiting_human convos:', waitingErr);
        } else if (waitingConvos && waitingConvos.length > 0) {
          console.log(`[Auto-Close] 🌙 Found ${waitingConvos.length} waiting_human conversations to close after-hours`);

          for (const conv of waitingConvos as ConversationToClose[]) {
            if (closedIds.includes(conv.id)) continue;

            try {
              // Check if department wants to keep conversations open after-hours
              const deptData = (conv as any).departments;
              const keepOpen = deptData?.after_hours_keep_open === true;

              // Enviar mensagem de encerramento after-hours
              await supabase.from('messages').insert({
                conversation_id: conv.id,
                content: afterHoursMsg,
                sender_type: 'user',
                is_ai_generated: true,
                is_bot_message: true,
              });

              // Enviar via WhatsApp se aplicável
              if (conv.channel === 'whatsapp') {
                await sendWhatsAppMessages(supabase, conv, afterHoursMsg, null);
              }

              // Aplicar tag after-hours na conversa
              if (afterHoursTagId) {
                await supabase.from('conversation_tags').upsert({
                  conversation_id: conv.id,
                  tag_id: afterHoursTagId,
                }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });

                // Proteger tag
                await supabase.from('protected_conversation_tags').upsert({
                  conversation_id: conv.id,
                  tag_id: afterHoursTagId,
                }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });
              } else {
                // Fallback: usar tag "Falta de Interação"
                await supabase.from('conversation_tags').upsert({
                  conversation_id: conv.id,
                  tag_id: LEGACY_FALTA_INTERACAO_TAG_ID,
                }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });
              }

              if (keepOpen) {
                // Departamento configurado para manter aberta — NÃO fechar
                console.log(`[Auto-Close] 🌙 🔓 Dept after_hours_keep_open=true — keeping conversation ${conv.id} OPEN (sent msg + tag only)`);
              } else {
                // Fechar conversa
                await supabase.from('conversations').update({
                  status: 'closed',
                  auto_closed: true,
                  closed_at: new Date().toISOString(),
                  closed_reason: 'after_hours_no_agent',
                  ai_mode: 'disabled',
                  assigned_to: null,
                }).eq('id', conv.id);

                // Completar dispatch jobs pendentes desta conversa
                await supabase.from('conversation_dispatch_jobs').update({
                  status: 'completed',
                  last_error: 'closed_after_hours_cleanup',
                  updated_at: new Date().toISOString(),
                }).eq('conversation_id', conv.id).eq('status', 'pending');

                closedIds.push(conv.id);
              }

              afterHoursClosedCount++;
              console.log(`[Auto-Close] 🌙 ✅ Processed after-hours waiting_human conversation ${conv.id} (keepOpen=${keepOpen})`);
            } catch (err) {
              console.error(`[Auto-Close] Error closing after-hours conversation ${conv.id}:`, err);
            }
          }
        } else {
          console.log('[Auto-Close] 🌙 No waiting_human conversations to close after-hours');
        }
      } catch (err) {
        console.error('[Auto-Close] Error in after-hours cleanup:', err);
      }
    } else {
      console.log('[Auto-Close] ☀️ Dentro do horário comercial — Stage 6 skipped');
    }

    console.log(`[Auto-Close] ✅ Stage 6 complete - closed ${afterHoursClosedCount} after-hours waiting_human conversations`);
    console.log(`[Auto-Close] ✅ All stages complete - total: ${totalClosedCount + aiClosedCount + noDeptClosedCount + humanClosedCount + awaitingCloseCount + afterHoursClosedCount} inactivity + ${windowExpiredCount} expired + ${slaAlertCount} SLA alerts + ${flowInactivityCount} flow timeouts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        closed_count: totalClosedCount + aiClosedCount + noDeptClosedCount + humanClosedCount + awaitingCloseCount + afterHoursClosedCount,
        whatsapp_window_expired_count: windowExpiredCount,
        ai_inactivity_closed_count: aiClosedCount,
        human_inactivity_closed_count: humanClosedCount,
        no_dept_closed_count: noDeptClosedCount,
        awaiting_confirmation_closed_count: awaitingCloseCount,
        after_hours_closed_count: afterHoursClosedCount,
        sla_alert_count: slaAlertCount,
        flow_inactivity_timeout_count: flowInactivityCount,
        closed_ids: closedIds,
        by_department: results,
        message: `Closed ${totalClosedCount} by inactivity + ${aiClosedCount} AI + ${humanClosedCount} human + ${noDeptClosedCount} no-dept + ${awaitingCloseCount} awaiting-confirm + ${afterHoursClosedCount} after-hours + ${windowExpiredCount} expired + ${slaAlertCount} SLA alerts + ${flowInactivityCount} flow timeouts` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Auto-Close] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Função auxiliar para enviar mensagens via WhatsApp
async function sendWhatsAppMessages(
  supabase: any, 
  conversation: ConversationToClose, 
  closeMessage: string, 
  csatMessage: string | null
) {
  try {
    // Buscar telefone do contato
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone, whatsapp_id')
      .eq('id', conversation.contact_id)
      .single();

    if (!contact?.phone && !contact?.whatsapp_id) {
      console.log(`[Auto-Close] No phone found for contact ${conversation.contact_id}`);
      return;
    }

    const phoneNumber = contact.whatsapp_id || contact.phone?.replace(/\D/g, '');

    // Determinar qual API usar e enviar mensagens
    if (conversation.whatsapp_provider === 'meta' && conversation.whatsapp_meta_instance_id) {
      // Meta WhatsApp API
      await supabase.functions.invoke('send-meta-whatsapp', {
        body: {
          instance_id: conversation.whatsapp_meta_instance_id,
          phone_number: phoneNumber,
          message: closeMessage,
          conversation_id: conversation.id,
          skip_db_save: true,
        }
      });
      
      if (csatMessage) {
        await supabase.functions.invoke('send-meta-whatsapp', {
          body: {
            instance_id: conversation.whatsapp_meta_instance_id,
            phone_number: phoneNumber,
            message: csatMessage,
            conversation_id: conversation.id,
            skip_db_save: true,
          }
        });
      }
    } else if (conversation.whatsapp_instance_id) {
      // Evolution API
      await supabase.functions.invoke('send-whatsapp', {
        body: {
          instanceId: conversation.whatsapp_instance_id,
          to: phoneNumber,
          message: closeMessage,
          is_bot_message: true,
        }
      });
      
      if (csatMessage) {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            instanceId: conversation.whatsapp_instance_id,
            to: phoneNumber,
            message: csatMessage,
            is_bot_message: true,
          }
        });
      }
    }
  } catch (whatsappError) {
    console.error(`[Auto-Close] ❌ WhatsApp send FAILED for conversation ${conversation.id}, provider=${conversation.whatsapp_provider}:`, whatsappError);
  }
}
