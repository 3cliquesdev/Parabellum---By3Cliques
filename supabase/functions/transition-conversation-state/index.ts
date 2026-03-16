import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type TransitionType =
  | 'handoff_to_human'
  | 'assign_agent'
  | 'unassign_agent'
  | 'engage_ai'
  | 'set_copilot'
  | 'update_department'
  | 'close';

interface TransitionRequest {
  conversationId: string;
  transition: TransitionType;
  departmentId?: string;
  agentId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: TransitionRequest = await req.json();
    const { conversationId, transition, departmentId, agentId, reason, metadata } = body;

    if (!conversationId || !transition) {
      return new Response(JSON.stringify({ error: 'conversationId e transition são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[transition-conversation-state] 🔄 ${transition} → conv ${conversationId.substring(0, 8)}`);

    // 1. Buscar estado atual
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, ai_mode, status, department, assigned_to, contact_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (conv.status === 'closed' && transition !== 'close') {
      return new Response(JSON.stringify({ error: 'Conversa já está fechada', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Buscar dept Suporte para fallback (busca dinâmica)
    const { data: deptSuporte } = await supabase
      .from('departments')
      .select('id')
      .ilike('name', '%suporte%')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const FALLBACK_DEPT = deptSuporte?.id || null;

    // 3. Executar transição
    const updateData: Record<string, unknown> = {};
    let shouldCreateDispatch = false;
    let shouldCloseDispatch = false;
    let shouldReopenDispatch = false;
    const effectiveDept = departmentId || conv.department || FALLBACK_DEPT;

    switch (transition) {
      case 'handoff_to_human':
        updateData.ai_mode = 'waiting_human';
        updateData.assigned_to = null;
        if (!conv.department && effectiveDept) updateData.department = effectiveDept;
        shouldCreateDispatch = true;
        break;

      case 'assign_agent':
        if (!agentId) throw new Error('agentId obrigatório para assign_agent');
        updateData.ai_mode = 'copilot';
        updateData.assigned_to = agentId;
        if (!conv.department && effectiveDept) updateData.department = effectiveDept;
        shouldCloseDispatch = true;
        break;

      case 'unassign_agent':
        updateData.ai_mode = 'waiting_human';
        updateData.assigned_to = null;
        shouldReopenDispatch = true;
        break;

      case 'engage_ai':
        updateData.ai_mode = 'autopilot';
        updateData.assigned_to = null;
        shouldCloseDispatch = true;
        break;

      case 'set_copilot':
        updateData.ai_mode = 'copilot';
        if (!conv.department && effectiveDept) updateData.department = effectiveDept;
        break;

      case 'update_department':
        if (!departmentId) throw new Error('departmentId obrigatório para update_department');
        updateData.department = departmentId;
        // Atualizar dispatch job com novo dept se existir
        await supabase.from('conversation_dispatch_jobs')
          .update({ department_id: departmentId, updated_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('status', 'pending');
        break;

      case 'close':
        updateData.status = 'closed';
        updateData.closed_at = new Date().toISOString();
        shouldCloseDispatch = true;
        break;

      default:
        return new Response(JSON.stringify({ error: `Transição desconhecida: ${transition}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Aplicar update na conversa
    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId);
      if (updateErr) throw updateErr;
    }

    // 5. Gerenciar dispatch job
    const deptForDispatch = (updateData.department as string) || conv.department || effectiveDept;

    if (shouldCreateDispatch && deptForDispatch) {
      await supabase.from('conversation_dispatch_jobs')
        .upsert({
          conversation_id: conversationId,
          department_id: deptForDispatch,
          priority: 1,
          status: 'pending',
          next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id' });
      console.log(`[transition] ✅ Dispatch job criado/reativado para ${conversationId.substring(0, 8)}`);
    }

    // 🔒 FIX 2: Guarantee block — toda conversa waiting_human DEVE ter dispatch job ativo
    if (transition === 'handoff_to_human' && deptForDispatch) {
      const { data: existingJob } = await supabase
        .from('conversation_dispatch_jobs')
        .select('id')
        .eq('conversation_id', conversationId)
        .in('status', ['pending', 'escalated'])
        .maybeSingle();

      if (!existingJob) {
        await supabase.from('conversation_dispatch_jobs').insert({
          conversation_id: conversationId,
          department_id: deptForDispatch,
          priority: 1,
          status: 'pending',
          next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        console.log(`[transition] 🔒 GUARANTEE: Dispatch job criado para órfã ${conversationId.substring(0, 8)}`);
      }
    }

    if (shouldCloseDispatch) {
      await supabase.from('conversation_dispatch_jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('status', 'completed');
    }

    if (shouldReopenDispatch && deptForDispatch) {
      await supabase.from('conversation_dispatch_jobs')
        .upsert({
          conversation_id: conversationId,
          department_id: deptForDispatch,
          priority: 1,
          status: 'pending',
          next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id' });
    }

    // 6. Logar transição em ai_events (non-blocking)
    Promise.resolve(supabase.from('ai_events').insert({
      entity_type: 'conversation',
      entity_id: conversationId,
      event_type: `state_transition_${transition}`,
      model: 'system',
      input_summary: reason || transition,
      output_json: {
        from_ai_mode: conv.ai_mode,
        to_ai_mode: updateData.ai_mode || conv.ai_mode,
        from_dept: conv.department,
        to_dept: updateData.department || conv.department,
        agent_id: agentId || null,
        reason,
        metadata,
      },
    })).catch((e: any) => console.warn('[transition] Log failed (non-blocking):', e));

    console.log(`[transition-conversation-state] ✅ ${transition} aplicado com sucesso`);

    return new Response(JSON.stringify({
      success: true,
      transition,
      conversationId,
      previous_state: { ai_mode: conv.ai_mode, department: conv.department, assigned_to: conv.assigned_to },
      new_state: { ...updateData },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[transition-conversation-state] ❌ Erro:', error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
