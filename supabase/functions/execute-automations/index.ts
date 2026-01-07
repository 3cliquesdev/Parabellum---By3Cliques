import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Automation {
  id: string;
  name: string;
  trigger_event: string;
  trigger_conditions: any;
  action_type: string;
  action_config: any;
  is_active: boolean;
}

async function executeAction(automation: Automation, triggerData: any) {
  console.log(`Executing action ${automation.action_type} for automation ${automation.name}`);

  try {
    switch (automation.action_type) {
      case 'assign_to_user':
        return await executeAssignToUser(automation, triggerData);
      case 'create_activity':
        return await executeCreateActivity(automation, triggerData);
      case 'add_tag':
        return await executeAddTag(automation, triggerData);
      case 'send_notification':
        return await executeSendNotification(automation, triggerData);
      case 'send_email_to_customer':
        return await executeSendEmailToCustomer(automation, triggerData);
      default:
        console.log(`Unknown action type: ${automation.action_type}`);
        return { success: false, message: 'Unknown action type' };
    }
  } catch (error: any) {
    console.error(`Error executing action:`, error);
    return { success: false, message: error.message };
  }
}

async function executeAssignToUser(automation: Automation, triggerData: any) {
  const { strategy, user_id, department } = automation.action_config;

  console.log('[executeAssignToUser] Starting assignment', { strategy, user_id, department, dealId: triggerData.deal_id });

  if (strategy === 'specific_user' && user_id) {
    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: user_id })
      .eq('id', triggerData.deal_id);

    if (error) throw error;
    return { success: true, assigned_to: user_id };
  }

  if (strategy === 'round_robin') {
    // Primeiro, resolver o UUID do departamento se recebeu string
    let departmentId = department;
    
    // Se department parece ser um nome (não UUID), buscar o UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (department && !uuidRegex.test(department)) {
      console.log('[executeAssignToUser] Department is a name, looking up UUID:', department);
      const { data: dept, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .ilike('name', department)
        .single();
      
      if (deptError) {
        console.log('[executeAssignToUser] Department lookup error:', deptError);
      }
      
      if (dept) {
        departmentId = dept.id;
        console.log('[executeAssignToUser] Found department UUID:', departmentId);
      }
    }

    // Buscar vendedores com role sales_rep, ativos e não bloqueados
    // Primeiro buscar os user_ids com role sales_rep
    const { data: salesRepRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'sales_rep');

    if (rolesError) {
      console.error('[executeAssignToUser] Error fetching sales rep roles:', rolesError);
      throw rolesError;
    }

    if (!salesRepRoles || salesRepRoles.length === 0) {
      console.log('[executeAssignToUser] No users with sales_rep role found');
      return { success: false, message: 'No sales reps with correct role found' };
    }

    const salesRepUserIds = salesRepRoles.map(r => r.user_id);
    console.log('[executeAssignToUser] Found sales_rep user_ids:', salesRepUserIds);

    // Agora buscar profiles desses usuários que estão ativos
    let query = supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', salesRepUserIds)
      .eq('is_blocked', false);

    // Filtrar por departamento se especificado
    if (departmentId) {
      query = query.eq('department', departmentId);
    }

    const { data: salesReps, error: repsError } = await query;

    if (repsError) {
      console.error('[executeAssignToUser] Error fetching sales reps:', repsError);
      throw repsError;
    }

    console.log('[executeAssignToUser] Found active sales reps:', salesReps?.map(r => ({ id: r.id, name: r.full_name })));

    if (!salesReps || salesReps.length === 0) {
      return { success: false, message: 'No active sales reps available in department' };
    }

    // Buscar o último vendedor que recebeu um lead
    const { data: lastAssigned } = await supabase
      .from('deals')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('[executeAssignToUser] Last assigned rep:', lastAssigned?.assigned_to);

    // Determinar próximo vendedor no round robin
    let nextRepIndex = 0;
    if (lastAssigned?.assigned_to) {
      const lastIndex = salesReps.findIndex(rep => rep.id === lastAssigned.assigned_to);
      if (lastIndex >= 0) {
        nextRepIndex = (lastIndex + 1) % salesReps.length;
      }
    }

    const nextRep = salesReps[nextRepIndex];
    console.log('[executeAssignToUser] Assigning to:', { repId: nextRep.id, repName: nextRep.full_name });

    const { error } = await supabase
      .from('deals')
      .update({ assigned_to: nextRep.id })
      .eq('id', triggerData.deal_id);

    if (error) throw error;
    return { success: true, assigned_to: nextRep.id, assigned_name: nextRep.full_name, strategy: 'round_robin' };
  }

  return { success: false, message: 'Invalid strategy' };
}

async function executeCreateActivity(automation: Automation, triggerData: any) {
  const { type, title, description, days_offset } = automation.action_config;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (days_offset || 0));

  // Buscar o deal para pegar o assigned_to e contact_id
  const { data: deal } = await supabase
    .from('deals')
    .select('assigned_to, contact_id')
    .eq('id', triggerData.deal_id)
    .single();

  if (!deal) {
    return { success: false, message: 'Deal not found' };
  }

  const { error } = await supabase
    .from('activities')
    .insert({
      deal_id: triggerData.deal_id,
      contact_id: deal.contact_id,
      assigned_to: deal.assigned_to,
      type: type || 'task',
      title: title || 'Atividade Automática',
      description: description || '',
      due_date: dueDate.toISOString(),
    });

  if (error) throw error;
  return { success: true, activity_created: true };
}

async function executeAddTag(automation: Automation, triggerData: any) {
  const { tag_name, tag_color } = automation.action_config;

  // Buscar ou criar a tag
  let { data: tag } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tag_name)
    .single();

  if (!tag) {
    const { data: newTag, error: tagError } = await supabase
      .from('tags')
      .insert({ name: tag_name, color: tag_color || '#3B82F6' })
      .select('id')
      .single();

    if (tagError) throw tagError;
    tag = newTag;
  }

  // Buscar o contact_id do deal
  const { data: deal } = await supabase
    .from('deals')
    .select('contact_id')
    .eq('id', triggerData.deal_id)
    .single();

  if (!deal?.contact_id) {
    return { success: false, message: 'Contact not found' };
  }

  // Adicionar tag ao contato (se não existir)
  const { error } = await supabase
    .from('customer_tags')
    .insert({
      customer_id: deal.contact_id,
      tag_id: tag.id,
    });

  // Ignorar erro de duplicidade
  if (error && !error.message.includes('duplicate')) {
    throw error;
  }

  return { success: true, tag_added: tag_name };
}

async function executeSendNotification(automation: Automation, triggerData: any) {
  const { message } = automation.action_config;

  // Por enquanto, apenas registra no log
  // Futuramente pode integrar com sistema de notificações real
  console.log(`NOTIFICATION: ${message}`, triggerData);

  return { success: true, notification_sent: true, message };
}

async function executeSendEmailToCustomer(automation: Automation, triggerData: any) {
  console.log('[executeSendEmailToCustomer] Starting email send action', {
    automationId: automation.id,
    dealId: triggerData.deal_id,
  });

  const { template_id } = automation.action_config;

  if (!template_id) {
    return { success: false, message: 'Template ID not provided' };
  }

  // Buscar template
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', template_id)
    .single();

  if (templateError || !template) {
    console.error('[executeSendEmailToCustomer] Template not found:', templateError);
    return { success: false, message: 'Template not found' };
  }

  console.log('[executeSendEmailToCustomer] Template fetched:', template.name);

  // Buscar deal com dados completos (customer, organization, sales rep)
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select(`
      *,
      contact:contacts(*),
      organization:organizations(*),
      sales_rep:profiles!deals_assigned_to_fkey(*)
    `)
    .eq('id', triggerData.deal_id)
    .single();

  if (dealError || !deal || !deal.contact) {
    console.error('[executeSendEmailToCustomer] Deal or contact not found:', dealError);
    return { success: false, message: 'Deal or contact not found' };
  }

  const contact = deal.contact as any;
  const organization = deal.organization as any;
  const salesRep = deal.sales_rep as any;

  console.log('[executeSendEmailToCustomer] Deal data fetched:', {
    dealTitle: deal.title,
    customerEmail: contact?.email,
  });

  if (!contact.email) {
    console.error('[executeSendEmailToCustomer] Contact has no email');
    return { success: false, message: 'Contact has no email' };
  }

  // Get current date/time
  const now = new Date();
  const currentDate = now.toLocaleDateString('pt-BR');
  const currentTime = now.toLocaleTimeString('pt-BR');
  const currentYear = now.getFullYear().toString();

  // Build comprehensive variables object with new format [VARIABLE]
  const variables: Record<string, string> = {
    // Customer variables
    '[CUSTOMER_FIRST_NAME]': contact.first_name || '',
    '[CUSTOMER_LAST_NAME]': contact.last_name || '',
    '[CUSTOMER_FULL_NAME]': `${contact.first_name} ${contact.last_name}`,
    '[CUSTOMER_EMAIL]': contact.email || '',
    '[CUSTOMER_PHONE]': contact.phone || '',
    '[CUSTOMER_COMPANY]': contact.company || '',
    '[CUSTOMER_STATUS]': contact.status || '',
    
    // Deal variables
    '[DEAL_TITLE]': deal.title || '',
    '[DEAL_VALUE]': deal.value?.toString() || '0',
    '[DEAL_CURRENCY]': deal.currency || 'BRL',
    '[DEAL_STATUS]': deal.status || '',
    '[DEAL_PROBABILITY]': deal.probability?.toString() || '',
    
    // Sales rep variables
    '[SALES_REP_NAME]': salesRep?.full_name || '',
    '[SALES_REP_EMAIL]': '', // Email não está no profiles
    '[SALES_REP_JOB_TITLE]': salesRep?.job_title || '',
    
    // Organization variables
    '[ORGANIZATION_NAME]': organization?.name || '',
    '[ORGANIZATION_DOMAIN]': organization?.domain || '',
    
    // Contextual variables
    '[CURRENT_DATE]': currentDate,
    '[CURRENT_TIME]': currentTime,
    '[CURRENT_YEAR]': currentYear,
  };

  let subject = template.subject;
  let html_body = template.html_body;

  // Replace all variables in subject and html_body using new format [VARIABLE]
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(key.replace(/[[\]]/g, '\\$&'), 'g');
    subject = subject.replace(regex, value);
    html_body = html_body.replace(regex, value);
  });

  console.log('[executeSendEmailToCustomer] Template variables replaced');

  // Chamar send-email Edge Function com branding de cliente
  const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-email', {
    body: {
      to: contact.email,
      to_name: `${contact.first_name} ${contact.last_name}`,
      subject: subject,
      html: html_body,
      customer_id: contact.id,
      is_customer_email: true, // Usar branding de cliente
      branding_id: template.branding_id || null, // Usar branding específico do template se configurado
    },
  });

  if (emailError) {
    console.error('[executeSendEmailToCustomer] Error sending email:', emailError);
    return { success: false, message: emailError.message };
  }

  console.log('[executeSendEmailToCustomer] Email sent successfully', emailResult);

  return { success: true, email_sent: true, to: contact.email, template_used: template.name };
}

async function logExecution(
  automationId: string,
  triggerData: any,
  status: string,
  result: any,
  errorMessage?: string
) {
  await supabase
    .from('automation_logs')
    .insert({
      automation_id: automationId,
      trigger_data: triggerData,
      execution_status: status,
      execution_result: result,
      error_message: errorMessage,
    });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trigger_event, data } = await req.json();

    console.log(`Processing trigger event: ${trigger_event}`, data);

    // Buscar automações ativas para este evento
    const { data: automations, error: automationsError } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_event', trigger_event)
      .eq('is_active', true);

    if (automationsError) throw automationsError;

    if (!automations || automations.length === 0) {
      console.log(`No active automations for event: ${trigger_event}`);
      return new Response(
        JSON.stringify({ message: 'No active automations found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const automation of automations) {
      console.log(`Processing automation: ${automation.name}`);

      // Verificar condições do trigger
      const conditions = automation.trigger_conditions || {};
      let shouldExecute = true;

      if (conditions.value_gte && data.value < conditions.value_gte) {
        shouldExecute = false;
      }

      if (conditions.pipeline_id && data.pipeline_id !== conditions.pipeline_id) {
        shouldExecute = false;
      }

      if (!shouldExecute) {
        console.log(`Skipping automation ${automation.name} - conditions not met`);
        await logExecution(automation.id, data, 'skipped', { reason: 'conditions not met' });
        continue;
      }

      // Executar ação
      const result = await executeAction(automation, data);

      if (result.success) {
        await logExecution(automation.id, data, 'success', result);
        results.push({ automation: automation.name, status: 'success', result });
      } else {
        await logExecution(automation.id, data, 'error', result, result.message);
        results.push({ automation: automation.name, status: 'error', message: result.message });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing automations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
