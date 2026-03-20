import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveDepartments } from "../_shared/department-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[run-email-backfill] 🚀 Iniciando backfill de emails...');
    const depts = await resolveDepartments(supabase);
    const SUPORTE_DEPT_ID = depts.SUPORTE_ID;
    
    let emailsFound = 0;
    let contactsUpdated = 0;
    let conversationsMoved = 0;

    // 1. Buscar mensagens com @ de contatos que não têm email cadastrado
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        content,
        conversations!inner(id, contact_id, department, contacts!inner(id, email, status))
      `)
      .eq('sender_type', 'contact')
      .ilike('content', '%@%')
      .limit(1000);

    if (msgError) {
      console.error('[run-email-backfill] ❌ Erro ao buscar mensagens:', msgError);
      throw msgError;
    }

    console.log('[run-email-backfill] 📧 Mensagens com @ encontradas:', messages?.length || 0);

    // Regex para extrair email (tolerante a espaços/quebras)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

    // Agrupar por conversation_id para processar apenas uma vez
    const conversationMap = new Map<string, { 
      conversationId: string; 
      contactId: string; 
      currentEmail: string | null;
      currentStatus: string | null;
      currentDept: string | null;
      extractedEmail: string | null;
    }>();

    for (const msg of messages || []) {
      const conv = msg.conversations as any;
      if (!conv?.contact_id) continue;

      const contact = conv.contacts;
      if (!contact) continue;

      // Se já processamos essa conversa, pular
      if (conversationMap.has(msg.conversation_id)) continue;

      // Extrair email (removendo espaços/quebras)
      const cleanContent = msg.content.replace(/\s+/g, '');
      const emailMatches = cleanContent.match(emailRegex);
      const extractedEmail = emailMatches?.[0]?.toLowerCase() || null;

      if (extractedEmail) {
        conversationMap.set(msg.conversation_id, {
          conversationId: msg.conversation_id,
          contactId: contact.id,
          currentEmail: contact.email,
          currentStatus: contact.status,
          currentDept: conv.department,
          extractedEmail
        });
      }
    }

    console.log('[run-email-backfill] 📊 Conversas únicas com email extraído:', conversationMap.size);

    // 2. Para cada conversa, verificar se o email pertence a um customer
    for (const [convId, data] of conversationMap) {
      emailsFound++;

      // Verificar se email existe como customer
      const { data: existingCustomer } = await supabase
        .from('contacts')
        .select('id, email')
        .eq('email', data.extractedEmail!)
        .eq('status', 'customer')
        .maybeSingle();

      if (existingCustomer) {
        console.log('[run-email-backfill] ✅ Email encontrado como customer:', data.extractedEmail);

        // Atualizar contato atual (se não tiver email ou for diferente)
        if (data.currentEmail !== data.extractedEmail || data.currentStatus !== 'customer') {
          const { error: updateContactErr } = await supabase
            .from('contacts')
            .update({
              email: data.extractedEmail,
              status: 'customer',
              source: data.currentEmail ? undefined : 'backfill_email'
            })
            .eq('id', data.contactId);

          if (!updateContactErr) {
            contactsUpdated++;
            console.log('[run-email-backfill] 📝 Contato atualizado:', data.contactId);
          }
        }

        // Mover conversa para Suporte (se não estiver lá)
        if (data.currentDept !== SUPORTE_DEPT_ID) {
          const { error: updateConvErr } = await supabase
            .from('conversations')
            .update({ department: SUPORTE_DEPT_ID })
            .eq('id', data.conversationId);

          if (!updateConvErr) {
            conversationsMoved++;
            console.log('[run-email-backfill] 📁 Conversa movida para Suporte:', convId);
          }
        }
      }
    }

    const result = {
      success: true,
      emails_found: emailsFound,
      contacts_updated: contactsUpdated,
      conversations_moved: conversationsMoved
    };

    console.log('[run-email-backfill] ✅ Backfill concluído:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[run-email-backfill] ❌ Exception:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
