import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
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
function evaluateFormula(formula: string, fieldValues: Record<string, any>): { success: boolean; value: any; error?: string } {
  try {
    let expression = formula;
    const fieldPattern = /\{([^}]+)\}/g;
    
    expression = expression.replace(fieldPattern, (match, fieldName) => {
      const value = fieldValues[fieldName];
      if (value === undefined || value === null) return '0';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? '1' : '0';
      const numValue = parseFloat(String(value));
      return isNaN(numValue) ? '0' : String(numValue);
    });

    const processIf = (expr: string): string => {
      const ifPattern = /IF\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
      let result = expr;
      let match;
      
      while ((match = ifPattern.exec(result)) !== null) {
        const condition = match[1].trim();
        const trueVal = match[2].trim();
        const falseVal = match[3].trim();
        const condResult = safeEvaluateCondition(condition);
        const replacement = condResult ? trueVal : falseVal;
        result = result.substring(0, match.index) + replacement + result.substring(match.index + match[0].length);
        ifPattern.lastIndex = 0;
      }
      
      return result;
    };

    expression = processIf(expression);
    const result = safeEvaluateMath(expression);
    return { success: true, value: result };
  } catch (error) {
    console.error('[form-submit-v3] Formula evaluation error:', error);
    return { success: false, value: null, error: String(error) };
  }
}

function safeEvaluateCondition(condition: string): boolean {
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

function safeEvaluateMath(expression: string): number {
  expression = expression.replace(/\s+/g, '');
  const allowedPattern = /^[0-9+\-*/%.()]+$/;
  if (!allowedPattern.test(expression)) {
    throw new Error(`Invalid characters in expression: ${expression}`);
  }
  
  const dangerousPatterns = [
    /[a-zA-Z_$]/,
    /\[\s*\]/,
    /\.\s*[a-zA-Z]/,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      throw new Error(`Unsafe pattern detected in expression: ${expression}`);
    }
  }
  
  return parseExpression(expression);
}

function parseExpression(expr: string): number {
  let pos = 0;
  
  function parseNumber(): number {
    let numStr = '';
    const start = pos;
    
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
      pos++;
      const result = parseAddSub();
      if (expr[pos] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      pos++;
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

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

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
    const answers = body.answers || body.responses;

    // Validate form_id is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!form_id || typeof form_id !== 'string' || !uuidRegex.test(form_id)) {
      console.error('[form-submit-v3] Invalid form_id:', form_id);
      return new Response(
        JSON.stringify({ error: 'form_id é obrigatório e deve ser um UUID válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      console.error('[form-submit-v3] Invalid answers format:', typeof answers);
      return new Response(
        JSON.stringify({ error: 'answers deve ser um objeto com as respostas do formulário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize answers
    const sanitizedAnswers: Record<string, any> = {};
    const MAX_ANSWER_LENGTH = 10000;
    const MAX_TOTAL_SIZE = 1000000;
    
    let totalSize = 0;
    for (const [key, value] of Object.entries(answers)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(key) || key.length > 100) {
        console.warn('[form-submit-v3] Skipping invalid answer key:', key);
        continue;
      }
      
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
    
    // ============================================
    // STEP: CHECK SUBMISSION LIMIT PER CONTACT
    // ============================================
    // First, try to find the email in answers to check limit before processing
    const fieldsForLimit = schema?.fields || [];
    let emailForLimit: string | null = null;
    
    // Find email field by type
    let emailFieldForLimit = fieldsForLimit.find((f: any) => f.type === 'email');
    if (!emailFieldForLimit) {
      // Fallback: search by label
      emailFieldForLimit = fieldsForLimit.find((f: any) => 
        f.label?.toLowerCase().includes('email') || f.label?.toLowerCase().includes('e-mail')
      );
    }
    if (!emailFieldForLimit) {
      // Fallback: search by content validation
      emailFieldForLimit = fieldsForLimit.find((f: any) => {
        const value = sanitizedAnswers[f.id];
        return typeof value === 'string' && validators.email(value);
      });
    }
    
    if (emailFieldForLimit) {
      emailForLimit = sanitizedAnswers[emailFieldForLimit.id];
    }
    
    // Check submission limit if form has one and we have an email
    if (form.max_submissions_per_contact && emailForLimit) {
      console.log(`[form-submit-v3] Checking submission limit: max=${form.max_submissions_per_contact}, email=${emailForLimit}`);
      
      const { data: limitCheck, error: limitError } = await supabase.rpc('check_submission_limit', {
        p_form_id: form_id,
        p_email: emailForLimit
      });
      
      if (limitError) {
        console.error('[form-submit-v3] Error checking submission limit:', limitError);
      } else if (limitCheck && !limitCheck.allowed) {
        console.warn(`[form-submit-v3] Submission limit reached for ${emailForLimit}: ${limitCheck.current_count}/${form.max_submissions_per_contact}`);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'submission_limit_reached',
            message: limitCheck.message || 'Você já preencheu este formulário o número máximo de vezes permitido.',
            remaining: 0,
            current_count: limitCheck.current_count
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log(`[form-submit-v3] Submission allowed. Remaining: ${limitCheck?.remaining}`);
      }
    }
    const fields = schema?.fields || [];
    const validationErrors: Record<string, string> = {};

    // Step 1: Validate all fields
    for (const field of fields) {
      const value = sanitizedAnswers[field.id];
      
      if (field.required && (!value || value === '')) {
        validationErrors[field.id] = field.validation_message || `${field.label} é obrigatório`;
        continue;
      }

      if (!value) continue;

      if (field.type === 'email' && !field.validation_type) {
        if (!validators.email(value)) {
          validationErrors[field.id] = field.validation_message || 'E-mail inválido';
          continue;
        }
      }

      const validationType = field.validation_type;
      if (validationType && validators[validationType as keyof typeof validators]) {
        const isValid = validators[validationType as keyof typeof validators](value);
        if (!isValid) {
          validationErrors[field.id] = field.validation_message || `${field.label} inválido`;
        }
      }

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

    // ============================================
    // STEP 2.5: DYNAMIC LEAD SCORING FROM SCHEMA
    // Calculate score based on field scoring configuration
    // ============================================
    let leadScoringTotal = 0;
    const leadScoringBreakdown: Record<string, number> = {};
    let hasLeadScoring = false;

    for (const field of fields) {
      if (field.scoring?.enabled && field.scoring?.options?.length > 0) {
        hasLeadScoring = true;
        const answer = sanitizedAnswers[field.id];
        
        if (answer !== undefined && answer !== null && answer !== '') {
          // Normalize answer to string for comparison
          const answerStr = String(answer);
          
          // Find matching scoring option
          const scoringOption = field.scoring.options.find(
            (opt: any) => String(opt.value) === answerStr
          );
          
          if (scoringOption && typeof scoringOption.points === 'number') {
            leadScoringBreakdown[field.id] = scoringOption.points;
            leadScoringTotal += scoringOption.points;
            console.log(`[form-submit-v3] Lead scoring: field "${field.label}" = ${scoringOption.points} pts (answer: ${answerStr})`);
          } else {
            leadScoringBreakdown[field.id] = 0;
            console.log(`[form-submit-v3] Lead scoring: field "${field.label}" = 0 pts (no match for: ${answerStr})`);
          }
        }
      }
    }

    // Determine classification based on scoring_ranges table
    let leadClassification = 'frio';
    if (hasLeadScoring) {
      const { data: ranges } = await supabase
        .from('scoring_ranges')
        .select('classification, min_score, max_score')
        .order('min_score', { ascending: false });
      
      if (ranges) {
        for (const range of ranges) {
          const minOk = leadScoringTotal >= range.min_score;
          const maxOk = range.max_score === null || leadScoringTotal <= range.max_score;
          if (minOk && maxOk) {
            leadClassification = range.classification;
            break;
          }
        }
      }
      
      console.log(`[form-submit-v3] Lead score total: ${leadScoringTotal}, classification: ${leadClassification}`);
      
      // Add to calculated_scores
      calculatedScores.lead_score = {
        total: leadScoringTotal,
        breakdown: leadScoringBreakdown,
        classification: leadClassification,
      };
    }

    // Step 3: Create or update contact
    // Smart email detection: by type, by label, or by content validation
    let contactId: string | null = null;
    let emailField = fields.find((f: any) => f.type === 'email');
    let emailDetectionMethod = 'type';
    
    // Fallback 1: Search by label containing "email" or "e-mail"
    if (!emailField) {
      emailField = fields.find((f: any) => 
        f.label?.toLowerCase().includes('email') || 
        f.label?.toLowerCase().includes('e-mail')
      );
      if (emailField) emailDetectionMethod = 'label';
    }
    
    // Fallback 2: Search text fields with valid email content
    if (!emailField) {
      emailField = fields.find((f: any) => {
        const value = sanitizedAnswers[f.id];
        return typeof value === 'string' && validators.email(value);
      });
      if (emailField) emailDetectionMethod = 'content';
    }
    
    const email = emailField ? sanitizedAnswers[emailField.id] : null;
    
    if (emailField) {
      console.log(`[form-submit-v3] Email field detected: "${emailField.label}" (type: ${emailField.type}, detection: ${emailDetectionMethod})`);
    } else {
      console.warn('[form-submit-v3] No email field detected - contact will not be created');
    }

    if (email) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', email)
        .single();

      if (existingContact) {
        contactId = existingContact.id;
        
        // Update contact with lead score if we have scoring
        if (hasLeadScoring) {
          await supabase
            .from('contacts')
            .update({
              lead_score: leadScoringTotal,
              lead_classification: leadClassification,
            })
            .eq('id', contactId);
          console.log(`[form-submit-v3] Updated contact ${contactId} with lead score: ${leadScoringTotal}`);
        }
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
            // Add lead score if we have scoring
            ...(hasLeadScoring ? {
              lead_score: leadScoringTotal,
              lead_classification: leadClassification,
            } : {}),
          })
          .select()
          .single();

        if (newContact) {
          contactId = newContact.id;
          console.log(`[form-submit-v3] Created contact ${contactId} with lead score: ${leadScoringTotal}`);
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

    // ============================================
    // STEP 4.5: FULL ROUTING LOGIC BASED ON target_type
    // Uses get_assignee_for_form() to determine assignment
    // ============================================
    
    // Get assignee using the database function
    // Now respects pipeline_sales_reps when target_pipeline_id is set
    let assignedTo: string | null = null;
    if (form.distribution_rule) {
      const { data: assigneeId } = await supabase.rpc('get_assignee_for_form', {
        p_distribution_rule: form.distribution_rule,
        p_target_user_id: form.target_user_id || null,
        p_department_id: form.target_department_id || null,
        p_pipeline_id: form.target_pipeline_id || null  // NEW: Filter by pipeline team
      });
      assignedTo = assigneeId;
      console.log(`[form-submit-v3] Assignee determined: ${assignedTo} (rule: ${form.distribution_rule}, pipeline: ${form.target_pipeline_id || 'none'})`);
    }

    // TARGET TYPE: TICKET
    if (form.target_type === 'ticket' && contactId) {
      console.log(`[form-submit-v3] Creating TICKET with routing`);
      
      const ticketSettings = schema?.ticket_settings || {};
      
      // Build subject
      const subjectField = fields.find((f: any) => f.ticket_field === 'subject');
      let ticketSubject = ticketSettings.default_subject || `Solicitação via ${form.name}`;
      if (subjectField && sanitizedAnswers[subjectField.id]) {
        ticketSubject = sanitizedAnswers[subjectField.id];
      }
      
      // Build description
      const descriptionField = fields.find((f: any) => f.ticket_field === 'description');
      let ticketDescription = '';
      if (descriptionField && sanitizedAnswers[descriptionField.id]) {
        ticketDescription = sanitizedAnswers[descriptionField.id];
      } else {
        const descriptionLines = fields.map((f: any) => {
          const val = sanitizedAnswers[f.id];
          if (!val || val === '') return null;
          // Skip file fields from description text (they'll be attachments)
          if (f.type === 'file') return null;
          return `**${f.label}:** ${val}`;
        }).filter(Boolean);
        ticketDescription = descriptionLines.join('\n\n');
      }
      
      // Collect file attachments from file fields
      const fileAttachments: Array<{ name: string; url: string; type: string }> = [];
      for (const field of fields) {
        if (field.type === 'file' && sanitizedAnswers[field.id]) {
          const fileValues = sanitizedAnswers[field.id];
          if (Array.isArray(fileValues)) {
            for (const file of fileValues) {
              if (file && file.url) {
                fileAttachments.push({
                  name: file.name || 'arquivo',
                  url: file.url,
                  type: file.type || 'application/octet-stream',
                });
              }
            }
          }
        }
      }
      console.log(`[form-submit-v3] Found ${fileAttachments.length} file attachments`);
      
      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          customer_id: contactId,
          subject: ticketSubject,
          description: ticketDescription,
          priority: ticketSettings.default_priority || 'medium',
          category: ticketSettings.default_category || 'outro',
          department_id: form.target_department_id || null,
          assigned_to: assignedTo, // ROUTING: use the assignee from get_assignee_for_form
          status: 'open',
          channel: 'form',
          attachments: fileAttachments.length > 0 ? fileAttachments : null,
        })
        .select('*, ticket_number')
        .single();
      
      if (ticketError) {
        console.error('[form-submit-v3] Error creating ticket:', ticketError);
      } else if (newTicket) {
        console.log(`[form-submit-v3] Ticket created: ${newTicket.id}, assigned_to: ${assignedTo}`);
        
        // Send auto-reply email if enabled
        if (ticketSettings.send_auto_reply && email) {
          try {
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
                ticket_number: newTicket.ticket_number || newTicket.id.substring(0, 8).toUpperCase(),
                customer_email: email,
                customer_name: customerName,
                subject: ticketSubject,
                description: ticketDescription,
                priority: newTicket.priority,
              },
            });
            console.log('[form-submit-v3] Auto-reply email sent');
          } catch (emailError) {
            console.error('[form-submit-v3] Failed to send auto-reply email:', emailError);
          }
        }
        
        // Notify manager if enabled
        if (form.notify_manager && form.target_department_id) {
          try {
            // Get department manager (note: profiles doesn't have email, only full_name)
            const { data: deptManager } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('department', form.target_department_id)
              .limit(1)
              .single();
            
            if (deptManager) {
              console.log(`[form-submit-v3] Manager notification would be sent to: ${deptManager.full_name}`);
              // Could invoke email function here for manager notification
            }
          } catch (notifyError) {
            console.error('[form-submit-v3] Failed to notify manager:', notifyError);
          }
        }
      }
    }

    // TARGET TYPE: DEAL
    if (form.target_type === 'deal' && contactId) {
      console.log(`[form-submit-v3] Creating DEAL with routing`);
      
      // Apply score-based routing if enabled
      let pipelineId = form.target_pipeline_id;
      let playbookConfig: { playbook_id: string; start_node_id: string | null } | null = null;
      
      if (hasLeadScoring && form.score_routing_rules?.enabled && form.score_routing_rules?.rules?.length > 0) {
        const rules = form.score_routing_rules.rules;
        for (const rule of rules) {
          const inRange = leadScoringTotal >= rule.min_score && 
                         (rule.max_score === null || leadScoringTotal <= rule.max_score);
          if (inRange) {
            if (rule.pipeline_id) {
              pipelineId = rule.pipeline_id;
              console.log(`[form-submit-v3] Score routing: ${leadScoringTotal}pts -> pipeline ${pipelineId} (${rule.classification})`);
            }
            if (rule.playbook_id) {
              playbookConfig = {
                playbook_id: rule.playbook_id,
                start_node_id: rule.playbook_start_node_id || null
              };
              console.log(`[form-submit-v3] Score routing: ${leadScoringTotal}pts -> playbook ${rule.playbook_id}, start node: ${rule.playbook_start_node_id || 'first'}`);
            }
            break;
          }
        }
      }
      
      if (pipelineId) {
        // Verificar se já existe deal aberto para este contato no mesmo pipeline
        const { data: existingDeal } = await supabase
          .from('deals')
          .select('id')
          .eq('contact_id', contactId)
          .eq('status', 'open')
          .eq('pipeline_id', pipelineId)
          .maybeSingle();

        if (existingDeal) {
          console.log(`[form-submit-v3] Deal já existe para este contato: ${existingDeal.id}`);
          // Deal already exists, skip creation
        } else {
          // Get first stage of the pipeline
          const { data: firstStage } = await supabase
            .from('stages')
            .select('id')
            .eq('pipeline_id', pipelineId)
            .order('position', { ascending: true })
            .limit(1)
            .single();

          const dealTitle = `Lead via ${form.name}`;
          
          const { data: newDeal, error: dealError } = await supabase
            .from('deals')
            .insert({
              title: dealTitle,
              contact_id: contactId,
              pipeline_id: pipelineId,
              stage_id: firstStage?.id,
              assigned_to: assignedTo,
              lead_source: 'formulario',
              status: 'open',
              value: 0,
            })
            .select()
            .single();

          if (dealError) {
            console.error('[form-submit-v3] Error creating deal:', dealError);
          } else if (newDeal) {
            console.log(`[form-submit-v3] Deal created: ${newDeal.id}, assigned_to: ${assignedTo}`);
            
            // Verificar se é cliente existente com compras anteriores no Kiwify
            const { data: contact } = await supabase
              .from('contacts')
              .select('email, total_ltv')
              .eq('id', contactId)
              .single();
            
            if (contact?.email) {
              // Buscar compras anteriores no Kiwify
              const { data: previousPurchases } = await supabase
                .from('kiwify_events')
                .select('id, payload')
                .eq('customer_email', contact.email.toLowerCase())
                .in('event_type', ['paid', 'order_approved'])
                .order('created_at', { ascending: false });
              
              if (previousPurchases && previousPurchases.length > 0) {
                console.log(`[form-submit-v3] Cliente existente detectado! ${previousPurchases.length} compras anteriores`);
                
                // Extrair nomes dos produtos únicos
                const existingProducts = [...new Set(
                  previousPurchases
                    .map(p => (p.payload as any)?.Product?.product_name)
                    .filter(Boolean)
                )];
                
                // Atualizar deal com flag de cliente existente
                await supabase
                  .from('deals')
                  .update({
                    is_returning_customer: true,
                    existing_products: existingProducts,
                  })
                  .eq('id', newDeal.id);
                
                // Registrar nota na timeline para o vendedor
                const totalLTV = contact.total_ltv || 0;
                const ltvFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLTV);
                
                await supabase
                  .from('interactions')
                  .insert({
                    customer_id: contactId,
                    type: 'note',
                    channel: 'system',
                    content: `🌟 **Cliente Existente Detectado!**\n\nEste lead já é nosso cliente e possui ${existingProducts.length} produto(s):\n• ${existingProducts.join('\n• ')}\n\n💰 LTV Total: ${ltvFormatted}\n\n💡 **Oportunidade de Upsell:** Considere oferecer um upgrade ou produto complementar!`,
                    metadata: { 
                      auto_generated: true, 
                      type: 'returning_customer_alert',
                      existing_products: existingProducts,
                      total_ltv: totalLTV
                    }
                  });
              }
            }
          }
        }
        
        // Trigger playbook based on score routing (if configured)
        if (playbookConfig && contactId) {
          try {
            const { data: execution, error: execError } = await supabase
              .from('playbook_executions')
              .insert({
                playbook_id: playbookConfig.playbook_id,
                contact_id: contactId,
                status: 'pending',
                current_node_id: playbookConfig.start_node_id || null,
                triggered_by: 'score_routing',
                execution_context: {
                  lead_score: leadScoringTotal,
                  lead_classification: leadClassification,
                  form_id: form_id,
                  start_node_override: playbookConfig.start_node_id
                }
              })
              .select()
              .single();

            if (execError) {
              console.error('[form-submit-v3] Error creating playbook execution:', execError);
            } else if (execution) {
              console.log(`[form-submit-v3] Playbook execution created: ${execution.id} for playbook ${playbookConfig.playbook_id}`);
              
              // If we have a specific start node, queue it
              if (playbookConfig.start_node_id) {
                await supabase.from('playbook_execution_queue').insert({
                  execution_id: execution.id,
                  node_id: playbookConfig.start_node_id,
                  status: 'pending',
                  scheduled_for: new Date().toISOString()
                });
              }
            }
          } catch (playbookError) {
            console.error('[form-submit-v3] Error triggering playbook:', playbookError);
          }
        }
      } else {
        console.warn('[form-submit-v3] target_type=deal but no target_pipeline_id configured');
      }
    }

    // TARGET TYPE: INTERNAL REQUEST
    if (form.target_type === 'internal_request') {
      console.log(`[form-submit-v3] Creating INTERNAL REQUEST with routing`);
      
      // Build title from first text field or form name
      const titleField = fields.find((f: any) => f.type === 'text' || f.type === 'short_text');
      const requestTitle = titleField && sanitizedAnswers[titleField.id] 
        ? sanitizedAnswers[titleField.id] 
        : `Solicitação Interna via ${form.name}`;
      
      // Build description from all answers
      const descriptionLines = fields.map((f: any) => {
        const val = sanitizedAnswers[f.id];
        if (!val || val === '') return null;
        return `**${f.label}:** ${val}`;
      }).filter(Boolean);
      const requestDescription = descriptionLines.join('\n\n');
      
      const { data: newRequest, error: requestError } = await supabase
        .from('internal_requests')
        .insert({
          title: requestTitle,
          description: requestDescription,
          department_id: form.target_department_id || null,
          assigned_to: assignedTo, // ROUTING: use the assignee from get_assignee_for_form
          contact_id: contactId,
          form_submission_id: submission?.id,
          priority: 'medium',
          status: 'pending',
          metadata: {
            form_id,
            form_name: form.name,
            answers: sanitizedAnswers,
            calculated_scores: calculatedScores,
          }
        })
        .select()
        .single();

      if (requestError) {
        console.error('[form-submit-v3] Error creating internal request:', requestError);
      } else if (newRequest) {
        console.log(`[form-submit-v3] Internal request created: ${newRequest.id}, assigned_to: ${assignedTo}`);
      }
    }

    // ============================================
    // STEP 4.6: UPDATE EXISTING KIWIFY KANBAN CARD
    // If contact has card from Kiwify sale, update and move it
    // ============================================
    if (contactId) {
      const { data: existingKiwifyCard } = await supabase
        .from('project_cards')
        .select('id, board_id, column_id, description')
        .eq('contact_id', contactId)
        .not('kiwify_order_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingKiwifyCard) {
        console.log(`[form-submit-v3] Found existing Kiwify card: ${existingKiwifyCard.id}`);

        // Build description from form answers
        const formDescriptionLines = fields.map((f: any) => {
          const val = sanitizedAnswers[f.id];
          if (!val || val === '') return null;
          if (f.type === 'file') return null;
          return `**${f.label}:** ${val}`;
        }).filter(Boolean);
        const formDescription = formDescriptionLines.join('\n\n');

        // Append form data to existing description
        const updatedDescription = existingKiwifyCard.description + 
          '\n\n---\n✅ **Formulário Preenchido:**\n\n' + formDescription;

        const updateData: any = {
          description: updatedDescription,
          form_submission_id: submission?.id,
          updated_at: new Date().toISOString(),
        };

        // Check if there's a product_board_mapping for this form to move card
        const { data: boardMapping } = await supabase
          .from('product_board_mappings')
          .select('form_filled_column_id')
          .eq('board_id', existingKiwifyCard.board_id)
          .eq('form_id', form_id)
          .eq('is_active', true)
          .single();

        if (boardMapping?.form_filled_column_id) {
          // Calculate new position in target column
          const { data: cardsInTarget } = await supabase
            .from('project_cards')
            .select('position')
            .eq('column_id', boardMapping.form_filled_column_id)
            .order('position', { ascending: false })
            .limit(1);
          
          updateData.column_id = boardMapping.form_filled_column_id;
          updateData.position = (cardsInTarget?.[0]?.position ?? -1) + 1;
          console.log(`[form-submit-v3] Moving card to column: ${boardMapping.form_filled_column_id}`);
        }

        await supabase
          .from('project_cards')
          .update(updateData)
          .eq('id', existingKiwifyCard.id);

        console.log(`[form-submit-v3] Kiwify card updated${boardMapping?.form_filled_column_id ? ' and moved' : ''}`);
      }
    }

    // ============================================
    // STEP 4.7: KANBAN BOARD INTEGRATION
    // Creates a card automatically when form is submitted
    // ============================================
    if (contactId) {
      const { data: boardIntegration } = await supabase
        .from('form_board_integrations')
        .select('*')
        .eq('form_id', form_id)
        .eq('is_active', true)
        .single();

      if (boardIntegration) {
        console.log(`[form-submit-v3] Found board integration for board: ${boardIntegration.board_id}`);
        
        // Determine target column (first column if not specified)
        let targetColumnId = boardIntegration.target_column_id;
        if (!targetColumnId) {
          const { data: firstColumn } = await supabase
            .from('project_columns')
            .select('id')
            .eq('board_id', boardIntegration.board_id)
            .order('position', { ascending: true })
            .limit(1)
            .single();
          targetColumnId = firstColumn?.id;
        }

        if (targetColumnId) {
          // Build card title from form fields
          const titleField = fields.find((f: any) => 
            f.label?.toLowerCase().includes('título') || 
            f.label?.toLowerCase().includes('assunto') ||
            f.label?.toLowerCase().includes('nome')
          );
          const cardTitle = titleField && sanitizedAnswers[titleField.id] 
            ? sanitizedAnswers[titleField.id] 
            : `Nova Solicitação via ${form.name}`;

          // Build card description from all answers
          const descriptionLines = fields.map((f: any) => {
            const val = sanitizedAnswers[f.id];
            if (!val || val === '') return null;
            if (f.type === 'file') return null;
            return `**${f.label}:** ${val}`;
          }).filter(Boolean);
          const cardDescription = descriptionLines.join('\n\n');

          // Get max position in column
          const { data: existingCards } = await supabase
            .from('project_cards')
            .select('position')
            .eq('column_id', targetColumnId)
            .order('position', { ascending: false })
            .limit(1);
          const nextPosition = (existingCards?.[0]?.position ?? -1) + 1;

          // Create the card
          const { data: newCard, error: cardError } = await supabase
            .from('project_cards')
            .insert({
              board_id: boardIntegration.board_id,
              column_id: targetColumnId,
              title: cardTitle,
              description: cardDescription,
              priority: 'medium',
              position: nextPosition,
            })
            .select()
            .single();

          if (cardError) {
            console.error('[form-submit-v3] Error creating kanban card:', cardError);
          } else if (newCard) {
            console.log(`[form-submit-v3] Kanban card created: ${newCard.id}`);

            // Update submission with card_id
            if (submission?.id) {
              await supabase
                .from('form_submissions')
                .update({ card_id: newCard.id })
                .eq('id', submission.id);
            }

            // Assign user if configured
            if (boardIntegration.auto_assign_user_id) {
              await supabase.from('project_card_assignees').insert({
                card_id: newCard.id,
                user_id: boardIntegration.auto_assign_user_id,
              });
              console.log(`[form-submit-v3] Card assigned to user: ${boardIntegration.auto_assign_user_id}`);
            }

            // Link contact to board for notifications
            await supabase
              .from('project_boards')
              .update({ contact_id: contactId })
              .eq('id', boardIntegration.board_id);
            console.log(`[form-submit-v3] Contact ${contactId} linked to board`);

            // Send confirmation email if enabled
            if (boardIntegration.send_confirmation_email && email) {
              try {
                const { data: contact } = await supabase
                  .from('contacts')
                  .select('first_name, last_name')
                  .eq('id', contactId)
                  .single();

                let emailHtml = `<p>Olá ${contact?.first_name || 'Cliente'},</p><p>Recebemos sua solicitação e já estamos trabalhando nela.</p><p>Você receberá atualizações sobre o progresso por email.</p><p>Obrigado!</p>`;
                let emailSubject = 'Recebemos sua solicitação';

                // Use custom template if configured
                if (boardIntegration.confirmation_email_template_id) {
                  const { data: template } = await supabase
                    .from('email_templates')
                    .select('subject, html_body')
                    .eq('id', boardIntegration.confirmation_email_template_id)
                    .single();
                  
                  if (template) {
                    emailSubject = template.subject
                      .replace(/\{\{card_title\}\}/g, cardTitle)
                      .replace(/\{\{client_name\}\}/g, `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim());
                    emailHtml = template.html_body
                      .replace(/\{\{card_title\}\}/g, cardTitle)
                      .replace(/\{\{client_name\}\}/g, `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim());
                  }
                }

                // Send email
                await supabase.functions.invoke('send-email', {
                  body: {
                    to: email,
                    to_name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Cliente',
                    subject: emailSubject,
                    html: emailHtml,
                    customer_id: contactId,
                    is_customer_email: true,
                  },
                });
                console.log('[form-submit-v3] Confirmation email sent for kanban card');
              } catch (emailError) {
                console.error('[form-submit-v3] Failed to send confirmation email:', emailError);
              }
            }
          }
        }
      }
    }

    // Step 5: Execute form automations
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
              // Suporte a ticket_title_template com variáveis {{campo}}
              let ticketSubject = actionConfig?.ticket_title_template || actionConfig?.subject || `Formulário: ${form.name}`;
              
              // Substituir variáveis do template usando mapeamento de campos
              if (ticketSubject.includes('{{')) {
                for (const field of form.fields || []) {
                  if (field.mapping && answers[field.id] !== undefined) {
                    const regex = new RegExp(`\\{\\{${field.mapping}\\}\\}`, 'g');
                    ticketSubject = ticketSubject.replace(regex, String(answers[field.id]) || '');
                  }
                }
                // Remover placeholders não substituídos
                ticketSubject = ticketSubject.replace(/\{\{[^}]+\}\}/g, '').trim() || `Formulário: ${form.name}`;
              }
              
              const ticketDescription = JSON.stringify(answers, null, 2);
              const ticketPriority = actionConfig?.ticket_priority || actionConfig?.priority || 'medium';
              const ticketCategory = actionConfig?.ticket_category || actionConfig?.category || 'general';
              
              const { data: newTicket } = await supabase.from('tickets').insert({
                customer_id: contactId,
                subject: ticketSubject,
                description: ticketDescription,
                priority: ticketPriority,
                category: ticketCategory,
                status: 'open',
                channel: 'form',
              }).select().single();

              if (newTicket && email) {
                try {
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
                // NOVO: Adicionar tag à CONVERSA (não ao contato)
                // Extrair conversation_id do session_metadata
                const targetConversationId = session_metadata?.conversation_id;
                
                if (targetConversationId) {
                  const { data: existingConvTag } = await supabase
                    .from('conversation_tags')
                    .select('id')
                    .eq('conversation_id', targetConversationId)
                    .eq('tag_id', actionConfig.tag_id)
                    .maybeSingle();
                  
                  if (!existingConvTag) {
                    await supabase.from('conversation_tags').insert({
                      conversation_id: targetConversationId,
                      tag_id: actionConfig.tag_id,
                    });
                    console.log(`[form-submit-v3] Tag added to conversation ${targetConversationId}`);
                  }
                } else {
                  // Fallback para contato se não houver conversation_id
                  const { data: existingTag } = await supabase
                    .from('customer_tags')
                    .select('id')
                    .eq('customer_id', contactId)
                    .eq('tag_id', actionConfig.tag_id)
                    .maybeSingle();
                  
                  if (!existingTag) {
                    await supabase.from('customer_tags').insert({
                      customer_id: contactId,
                      tag_id: actionConfig.tag_id,
                    });
                    console.log(`[form-submit-v3] Tag added to contact ${contactId} (fallback)`);
                  }
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
        assigned_to: assignedTo,
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
