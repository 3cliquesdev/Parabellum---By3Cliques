import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enterprise validators
const validators = {
  cpf: (value: string): boolean => {
    const cpf = value.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let digit1 = (sum * 10) % 11;
    if (digit1 === 10) digit1 = 0;
    if (digit1 !== parseInt(cpf[9])) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    let digit2 = (sum * 10) % 11;
    if (digit2 === 10) digit2 = 0;
    return digit2 === parseInt(cpf[10]);
  },
  
  cnpj: (value: string): boolean => {
    const cnpj = value.replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights1[i];
    let digit1 = sum % 11;
    digit1 = digit1 < 2 ? 0 : 11 - digit1;
    if (digit1 !== parseInt(cnpj[12])) return false;
    
    sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights2[i];
    let digit2 = sum % 11;
    digit2 = digit2 < 2 ? 0 : 11 - digit2;
    return digit2 === parseInt(cnpj[13]);
  },
  
  // Validação de email básico (aceita qualquer domínio)
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  // Validação de email corporativo (bloqueia pessoais)
  corporate_email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return false;
    
    const blockedDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'yahoo.com.br', 'uol.com.br', 'bol.com.br', 'terra.com.br'];
    const domain = value.split('@')[1]?.toLowerCase();
    return domain ? !blockedDomains.includes(domain) : false;
  },
  
  phone_br: (value: string): boolean => {
    const phone = value.replace(/\D/g, '');
    return phone.length === 10 || phone.length === 11;
  },
  
  cep: (value: string): boolean => {
    const cep = value.replace(/\D/g, '');
    return cep.length === 8;
  },
  
  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
};

// Safe formula parser for calculations - NO eval/new Function
// Only allows: numbers, basic math operators, field references, and IF statements
function evaluateFormula(formula: string, fieldValues: Record<string, any>): { success: boolean; value: any; error?: string } {
  try {
    // Step 1: Replace field references {field_name} with actual values
    let expression = formula;
    const fieldPattern = /\{([^}]+)\}/g;
    
    expression = expression.replace(fieldPattern, (match, fieldName) => {
      const value = fieldValues[fieldName];
      if (value === undefined || value === null) return '0';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? '1' : '0';
      // For strings, try to parse as number, otherwise return 0
      const numValue = parseFloat(String(value));
      return isNaN(numValue) ? '0' : String(numValue);
    });

    // Step 2: Handle IF statements recursively
    const processIf = (expr: string): string => {
      const ifPattern = /IF\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
      let result = expr;
      let match;
      
      while ((match = ifPattern.exec(result)) !== null) {
        const condition = match[1].trim();
        const trueVal = match[2].trim();
        const falseVal = match[3].trim();
        
        // Evaluate the condition safely
        const condResult = safeEvaluateCondition(condition);
        const replacement = condResult ? trueVal : falseVal;
        
        result = result.substring(0, match.index) + replacement + result.substring(match.index + match[0].length);
        ifPattern.lastIndex = 0; // Reset for next iteration
      }
      
      return result;
    };

    expression = processIf(expression);

    // Step 3: Safe mathematical evaluation using tokenization
    const result = safeEvaluateMath(expression);
    return { success: true, value: result };
  } catch (error) {
    console.error('[form-submit-v3] Formula evaluation error:', error);
    return { success: false, value: null, error: String(error) };
  }
}

// Safe condition evaluator - only allows comparison operators
function safeEvaluateCondition(condition: string): boolean {
  // Match patterns like: value1 > value2, value1 == value2, etc.
  const comparisonPattern = /^\s*(-?\d+(?:\.\d+)?)\s*(>=|<=|>|<|==|!=)\s*(-?\d+(?:\.\d+)?)\s*$/;
  const match = condition.match(comparisonPattern);
  
  if (!match) {
    console.warn('[form-submit-v3] Invalid condition format:', condition);
    return false;
  }
  
  const left = parseFloat(match[1]);
  const operator = match[2];
  const right = parseFloat(match[3]);
  
  switch (operator) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '==': return left === right;
    case '!=': return left !== right;
    default: return false;
  }
}

// Safe math evaluator - only allows numbers and basic operators (+, -, *, /, %, parentheses)
function safeEvaluateMath(expression: string): number {
  // Remove all whitespace
  expression = expression.replace(/\s+/g, '');
  
  // Validate: only allow numbers, operators, parentheses, and decimal points
  const allowedPattern = /^[0-9+\-*/%.()]+$/;
  if (!allowedPattern.test(expression)) {
    throw new Error(`Invalid characters in expression: ${expression}`);
  }
  
  // Prevent dangerous patterns (function calls, property access)
  const dangerousPatterns = [
    /[a-zA-Z_$]/, // No letters/identifiers
    /\[\s*\]/, // No array access
    /\.\s*[a-zA-Z]/, // No property access
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      throw new Error(`Unsafe pattern detected in expression: ${expression}`);
    }
  }
  
  // Parse and evaluate using a safe recursive descent parser
  return parseExpression(expression);
}

// Recursive descent parser for safe math evaluation
function parseExpression(expr: string): number {
  let pos = 0;
  
  function parseNumber(): number {
    let numStr = '';
    const start = pos;
    
    // Handle negative numbers
    if (expr[pos] === '-') {
      numStr += '-';
      pos++;
    }
    
    while (pos < expr.length && (/[0-9.]/.test(expr[pos]))) {
      numStr += expr[pos];
      pos++;
    }
    
    if (numStr === '' || numStr === '-') {
      throw new Error(`Expected number at position ${start}`);
    }
    
    return parseFloat(numStr);
  }
  
  function parseFactor(): number {
    if (expr[pos] === '(') {
      pos++; // skip '('
      const result = parseAddSub();
      if (expr[pos] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      pos++; // skip ')'
      return result;
    }
    return parseNumber();
  }
  
  function parseMulDiv(): number {
    let left = parseFactor();
    
    while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/' || expr[pos] === '%')) {
      const op = expr[pos];
      pos++;
      const right = parseFactor();
      
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      }
      else if (op === '%') {
        if (right === 0) throw new Error('Modulo by zero');
        left = left % right;
      }
    }
    
    return left;
  }
  
  function parseAddSub(): number {
    let left = parseMulDiv();
    
    while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
      const op = expr[pos];
      pos++;
      const right = parseMulDiv();
      
      if (op === '+') left = left + right;
      else left = left - right;
    }
    
    return left;
  }
  
  const result = parseAddSub();
  
  if (pos < expr.length) {
    throw new Error(`Unexpected character at position ${pos}: ${expr[pos]}`);
  }
  
  return result;
}

// Evaluate condition
function evaluateCondition(condition: any, fieldValues: Record<string, any>): boolean {
  const fieldValue = fieldValues[condition.field_id];
  const targetValue = condition.value;
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue == targetValue;
    case 'not_equals':
      return fieldValue != targetValue;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
    case 'greater_than':
      return Number(fieldValue) > Number(targetValue);
    case 'less_than':
      return Number(fieldValue) < Number(targetValue);
    case 'is_empty':
      return !fieldValue || fieldValue === '';
    case 'is_not_empty':
      return !!fieldValue && fieldValue !== '';
    case 'matches_regex':
      return new RegExp(String(targetValue)).test(String(fieldValue));
    default:
      return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    // Rate limit check: 10 requests per minute, block for 60 minutes if exceeded
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      p_identifier: clientIp,
      p_action_type: 'form_submission',
      p_max_requests: 10,
      p_window_minutes: 1,
      p_block_minutes: 60
    });

    if (rateLimitOk === false) {
      console.warn(`[form-submit-v3] Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Tente novamente mais tarde.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { form_id, session_metadata } = body;
    // Accept both 'answers' and 'responses' for compatibility
    const answers = body.answers || body.responses;

    // ============================================
    // ENTERPRISE VALIDATION: Validate request structure
    // ============================================
    
    // Validate form_id is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!form_id || typeof form_id !== 'string' || !uuidRegex.test(form_id)) {
      console.error('[form-submit-v3] Invalid form_id:', form_id);
      return new Response(
        JSON.stringify({ error: 'form_id é obrigatório e deve ser um UUID válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate answers is an object
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      console.error('[form-submit-v3] Invalid answers format:', typeof answers);
      return new Response(
        JSON.stringify({ error: 'answers deve ser um objeto com as respostas do formulário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate answer values - max length and sanitization
    const sanitizedAnswers: Record<string, any> = {};
    const MAX_ANSWER_LENGTH = 10000; // 10KB per answer
    const MAX_TOTAL_SIZE = 1000000; // 1MB total
    
    let totalSize = 0;
    for (const [key, value] of Object.entries(answers)) {
      // Validate key format (should be a field ID - alphanumeric/underscore/hyphen)
      if (!/^[a-zA-Z0-9_-]+$/.test(key) || key.length > 100) {
        console.warn('[form-submit-v3] Skipping invalid answer key:', key);
        continue;
      }
      
      // Handle different value types
      if (value === null || value === undefined) {
        sanitizedAnswers[key] = null;
      } else if (typeof value === 'string') {
        if (value.length > MAX_ANSWER_LENGTH) {
          return new Response(
            JSON.stringify({ error: `Resposta para ${key} excede o limite de ${MAX_ANSWER_LENGTH} caracteres` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        sanitizedAnswers[key] = value.trim();
        totalSize += value.length;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitizedAnswers[key] = value;
        totalSize += String(value).length;
      } else if (Array.isArray(value)) {
        // For multi-select fields
        sanitizedAnswers[key] = value.map(v => typeof v === 'string' ? v.trim() : v);
        totalSize += JSON.stringify(value).length;
      } else {
        sanitizedAnswers[key] = value;
        totalSize += JSON.stringify(value).length;
      }
      
      if (totalSize > MAX_TOTAL_SIZE) {
        return new Response(
          JSON.stringify({ error: 'Tamanho total das respostas excede o limite permitido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[form-submit-v3] Validated ${Object.keys(sanitizedAnswers).length} answers, total size: ${totalSize} bytes`);

    console.log(`[form-submit-v3] Processing form ${form_id}`);

    // Fetch form with fields
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', form_id)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schema = form.schema as any;
    const fields = schema?.fields || [];
    const validationErrors: Record<string, string> = {};

    // Step 1: Validate all fields using sanitized answers
    for (const field of fields) {
      const value = sanitizedAnswers[field.id];
      
      // Required validation
      if (field.required && (!value || value === '')) {
        validationErrors[field.id] = field.validation_message || `${field.label} é obrigatório`;
        continue;
      }

      if (!value) continue;

      // Validação automática de email para campos do tipo email (se não tiver validation_type específico)
      if (field.type === 'email' && !field.validation_type) {
        if (!validators.email(value)) {
          validationErrors[field.id] = field.validation_message || 'E-mail inválido';
          continue;
        }
      }

      // Enterprise validations
      const validationType = field.validation_type;
      if (validationType && validators[validationType as keyof typeof validators]) {
        const isValid = validators[validationType as keyof typeof validators](value);
        if (!isValid) {
          validationErrors[field.id] = field.validation_message || `${field.label} inválido`;
        }
      }

      // Custom regex validation
      if (field.validation_regex) {
        const regex = new RegExp(field.validation_regex);
        if (!regex.test(value)) {
          validationErrors[field.id] = field.validation_message || `${field.label} formato inválido`;
        }
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', validationErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Execute calculations
    const { data: calculations } = await supabase
      .from('form_calculations')
      .select('*')
      .eq('form_id', form_id);

    const calculatedScores: Record<string, any> = {};
    
    if (calculations) {
      for (const calc of calculations) {
        const result = evaluateFormula(calc.formula, sanitizedAnswers);
        calculatedScores[calc.name] = result.success ? result.value : null;
        console.log(`[form-submit-v3] Calculation ${calc.name}: ${result.value}`);
      }
    }

    // Step 3: Create or update contact
    let contactId: string | null = null;
    const emailField = fields.find((f: any) => f.type === 'email');
    const email = emailField ? sanitizedAnswers[emailField.id] : null;

    if (email) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', email)
        .single();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const nameField = fields.find((f: any) => f.type === 'text' && f.label?.toLowerCase().includes('nome'));
        const phoneField = fields.find((f: any) => f.type === 'phone');
        
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            email,
            first_name: nameField ? sanitizedAnswers[nameField.id]?.split(' ')[0] || 'Lead' : 'Lead',
            last_name: nameField ? sanitizedAnswers[nameField.id]?.split(' ').slice(1).join(' ') || '' : '',
            phone: phoneField ? sanitizedAnswers[phoneField.id] : null,
            source: 'form',
            status: 'lead',
          })
          .select()
          .single();

        if (newContact) {
          contactId = newContact.id;
        }
      }
    }

    // Step 4: Save submission
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .insert({
        form_id,
        contact_id: contactId,
        answers: sanitizedAnswers,
        calculated_scores: calculatedScores,
        session_metadata,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (submissionError) {
      console.error('[form-submit-v3] Submission error:', submissionError);
    }

    // Step 5: Execute automations
    const { data: automations } = await supabase
      .from('form_automations')
      .select('*')
      .eq('form_id', form_id)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    const automationsTriggered: any[] = [];

    if (automations && contactId) {
      for (const automation of automations) {
        let shouldTrigger = false;

        // Evaluate trigger
        if (automation.trigger_type === 'on_submit') {
          shouldTrigger = true;
        } else if (automation.trigger_type === 'on_score_threshold') {
          const config = automation.trigger_config as any;
          const scoreValue = calculatedScores[config?.score_name];
          if (scoreValue !== undefined && config?.operator && config?.threshold !== undefined) {
            switch (config.operator) {
              case 'greater_than':
                shouldTrigger = scoreValue > config.threshold;
                break;
              case 'less_than':
                shouldTrigger = scoreValue < config.threshold;
                break;
              case 'equals':
                shouldTrigger = scoreValue === config.threshold;
                break;
            }
          }
        } else if (automation.trigger_type === 'on_condition_match') {
          const config = automation.trigger_config as any;
          if (config?.field_id && config?.operator) {
            shouldTrigger = evaluateCondition(config, sanitizedAnswers);
          }
        }

        if (!shouldTrigger) continue;

        console.log(`[form-submit-v3] Triggering automation: ${automation.name}`);
        const actionConfig = automation.action_config as any;

        try {
          switch (automation.action_type) {
            case 'start_playbook':
              if (actionConfig?.playbook_id) {
                await supabase.from('playbook_executions').insert({
                  playbook_id: actionConfig.playbook_id,
                  contact_id: contactId,
                  status: 'pending',
                  triggered_by: 'automatic',
                });
              }
              break;

            case 'send_email':
              if (actionConfig?.template_id && email) {
                await supabase.functions.invoke('send-template-email', {
                  body: {
                    template_id: actionConfig.template_id,
                    to_email: email,
                    variables: { ...sanitizedAnswers, ...calculatedScores },
                  },
                });
              }
              break;

            case 'create_deal':
              if (actionConfig?.pipeline_id) {
                const { data: firstStage } = await supabase
                  .from('stages')
                  .select('id')
                  .eq('pipeline_id', actionConfig.pipeline_id)
                  .order('position', { ascending: true })
                  .limit(1)
                  .single();

                await supabase.from('deals').insert({
                  title: actionConfig?.title || `Lead - Formulário ${form.name}`,
                  contact_id: contactId,
                  pipeline_id: actionConfig.pipeline_id,
                  stage_id: firstStage?.id,
                  value: calculatedScores[actionConfig?.value_field] || actionConfig?.default_value || 0,
                  status: 'open',
                });
              }
              break;

            case 'create_ticket':
              const ticketSubject = actionConfig?.subject || `Formulário: ${form.name}`;
              const ticketDescription = JSON.stringify(answers, null, 2);
              const ticketPriority = actionConfig?.priority || 'medium';
              const ticketCategory = actionConfig?.category || 'general';
              
              const { data: newTicket } = await supabase.from('tickets').insert({
                contact_id: contactId,
                subject: ticketSubject,
                description: ticketDescription,
                priority: ticketPriority,
                category: ticketCategory,
                status: 'open',
              }).select().single();

              // Send notification email to customer
              if (newTicket && email) {
                try {
                  // Get customer name from contact
                  const { data: contact } = await supabase
                    .from('contacts')
                    .select('first_name, last_name')
                    .eq('id', contactId)
                    .single();
                  
                  const customerName = contact 
                    ? `${contact.first_name} ${contact.last_name}`.trim() 
                    : 'Cliente';
                  
                  await supabase.functions.invoke('send-ticket-notification', {
                    body: {
                      ticket_id: newTicket.id,
                      ticket_number: newTicket.id.substring(0, 8).toUpperCase(),
                      customer_email: email,
                      customer_name: customerName,
                      subject: ticketSubject,
                      description: ticketDescription,
                      priority: ticketPriority,
                    },
                  });
                  console.log('[form-submit-v3] Ticket notification email sent');
                } catch (emailError) {
                  console.error('[form-submit-v3] Failed to send ticket notification:', emailError);
                }
              }
              break;

            case 'add_tag':
              if (actionConfig?.tag_id) {
                // Check if tag already exists before inserting
                const { data: existingTag } = await supabase
                  .from('customer_tags')
                  .select('id')
                  .eq('customer_id', contactId)
                  .eq('tag_id', actionConfig.tag_id)
                  .single();
                
                if (!existingTag) {
                  await supabase.from('customer_tags').insert({
                    customer_id: contactId,
                    tag_id: actionConfig.tag_id,
                  });
                }
              }
              break;

            case 'webhook':
              if (actionConfig?.url) {
                await fetch(actionConfig.url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    form_id,
                    submission_id: submission?.id,
                    contact_id: contactId,
                    answers,
                    calculated_scores: calculatedScores,
                  }),
                });
              }
              break;

            case 'update_contact':
              if (actionConfig?.fields) {
                const updateData: Record<string, any> = {};
                for (const [contactField, formField] of Object.entries(actionConfig.fields)) {
                  updateData[contactField] = answers[formField as string];
                }
                await supabase.from('contacts').update(updateData).eq('id', contactId);
              }
              break;
          }

          automationsTriggered.push({
            automation_id: automation.id,
            automation_name: automation.name,
            action_type: automation.action_type,
            triggered_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`[form-submit-v3] Automation error: ${automation.name}`, error);
        }
      }
    }

    // Update submission with automations log
    if (submission && automationsTriggered.length > 0) {
      await supabase
        .from('form_submissions')
        .update({ automations_triggered: automationsTriggered })
        .eq('id', submission.id);
    }

    console.log(`[form-submit-v3] Form submitted successfully. Automations: ${automationsTriggered.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: submission?.id,
        contact_id: contactId,
        calculated_scores: calculatedScores,
        automations_triggered: automationsTriggered.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[form-submit-v3] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
