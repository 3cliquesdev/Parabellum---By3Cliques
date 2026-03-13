import type { Node, Edge } from "reactflow";

// ============================================================
// Variable Catalog — single source of truth for flow editor
// Used by: autocomplete, orphan warnings, condition selector
// ============================================================

export interface VariableItem {
  value: string;
  label: string;
  group: "flow" | "contact" | "conversation" | "order";
}

// Fixed contact variables (always available)
export const CONTACT_VARS: VariableItem[] = [
  { value: "contact_name", label: "Nome do Contato", group: "contact" },
  { value: "contact_email", label: "Email do Contato", group: "contact" },
  { value: "contact_phone", label: "Telefone do Contato", group: "contact" },
  { value: "contact_cpf", label: "CPF do Contato", group: "contact" },
  { value: "contact_city", label: "Cidade", group: "contact" },
  { value: "contact_state", label: "Estado", group: "contact" },
  { value: "contact_tags", label: "Tags", group: "contact" },
  { value: "contact_lead_score", label: "Lead Score", group: "contact" },
  { value: "contact_kiwify_validated", label: "Cliente Kiwify Validado", group: "contact" },
  { value: "contact_source", label: "Origem", group: "contact" },
  { value: "contact_company", label: "Empresa", group: "contact" },
  { value: "contact_document", label: "Documento", group: "contact" },
  { value: "contact_consultant_id", label: "Consultor do Contato", group: "contact" },
  { value: "contact_is_customer", label: "É Cliente? (Kiwify Validado)", group: "contact" },
  { value: "contact_onboarding_completed", label: "Onboarding Concluído", group: "contact" },
  { value: "contact_organization_id", label: "Organização", group: "contact" },
];

// Business hours & SLA variables (injected by engine at runtime)
export const BUSINESS_VARS: VariableItem[] = [
  { value: "business_within_hours", label: "Dentro do Horário Comercial", group: "conversation" },
  { value: "business_schedule_summary", label: "Horário de Atendimento", group: "conversation" },
  { value: "business_next_open_text", label: "Próxima Abertura", group: "conversation" },
  { value: "business_is_holiday", label: "É Feriado", group: "conversation" },
  { value: "business_holiday_name", label: "Nome do Feriado", group: "conversation" },
  { value: "business_today_open", label: "Abertura Hoje", group: "conversation" },
  { value: "business_today_close", label: "Fechamento Hoje", group: "conversation" },
  { value: "sla_first_response_met", label: "SLA Primeira Resposta Cumprido", group: "conversation" },
];

// Fixed conversation variables
export const CONVERSATION_VARS: VariableItem[] = [
  { value: "conversation_channel", label: "Canal", group: "conversation" },
  { value: "conversation_status", label: "Status", group: "conversation" },
  { value: "conversation_priority", label: "Prioridade", group: "conversation" },
  { value: "conversation_protocol_number", label: "Protocolo", group: "conversation" },
  { value: "conversation_queue", label: "Fila", group: "conversation" },
  { value: "conversation_created_at", label: "Criada em", group: "conversation" },
  { value: "conversation_resolved_at", label: "Resolvida em", group: "conversation" },
];

// Fixed validation variables (from validate_customer nodes)
export const CUSTOMER_VALIDATION_VARS: VariableItem[] = [
  { value: "customer_validated", label: "Cliente Validado", group: "contact" },
  { value: "customer_name_found", label: "Nome Encontrado", group: "contact" },
  { value: "customer_email_found", label: "Email Encontrado", group: "contact" },
];

// Fixed order variables (from fetch_order nodes)
export const ORDER_VARS: VariableItem[] = [
  { value: "order_found", label: "Pedido Encontrado", group: "order" },
  { value: "order_status", label: "Status do Pedido", group: "order" },
  { value: "order_box_number", label: "Nº da Caixa", group: "order" },
  { value: "order_platform", label: "Plataforma", group: "order" },
  { value: "order_is_packed", label: "Empacotado", group: "order" },
];

// Contact fields for condition selector (unprefixed — backend resolves via getVar)
export const CONDITION_CONTACT_FIELDS = [
  { value: "email", label: "Email" },
  { value: "name", label: "Nome" },
  { value: "phone", label: "Telefone" },
  { value: "cpf", label: "CPF" },
  { value: "tags", label: "Tags" },
  { value: "lead_score", label: "Lead Score" },
  { value: "kiwify_validated", label: "Cliente Kiwify" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "Estado" },
  { value: "source", label: "Origem" },
  { value: "is_validated_customer", label: "Cliente Validado" },
  { value: "consultant_id", label: "Tem Consultor?" },
  { value: "is_customer", label: "É Cliente? (Kiwify Validado)" },
  { value: "organization_id", label: "Tem Organização?" },
  { value: "onboarding_completed", label: "Onboarding Concluído?" },
];

// Conversation fields for condition selector
export const CONDITION_CONVERSATION_FIELDS = [
  { value: "channel", label: "Canal" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Prioridade" },
  { value: "protocol_number", label: "Protocolo" },
  { value: "queue", label: "Fila" },
  { value: "ai_exit_intent", label: "Intenção de Saída IA" },
];

/**
 * Get ancestor node IDs by traversing the graph backwards from the given node.
 * This ensures we only include variables from nodes that are actual predecessors,
 * not from parallel branches.
 */
export function getAncestorNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === current && !ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return ancestors;
}

/**
 * Get all available variables for a given node in the flow.
 * Flow variables are extracted only from ancestor nodes (backwards graph traversal).
 */
export function getAvailableVariables(
  nodes: Node[],
  edges: Edge[],
  selectedNodeId?: string
): {
  flowVars: VariableItem[];
  contactVars: VariableItem[];
  conversationVars: VariableItem[];
  orderVars: VariableItem[];
  all: VariableItem[];
} {
  let flowVars: VariableItem[] = [];

  if (selectedNodeId) {
    const ancestorIds = getAncestorNodeIds(selectedNodeId, edges);
    
    const seen = new Set<string>();
    for (const node of nodes) {
      if (ancestorIds.has(node.id) && node.data?.save_as) {
        const saveAs = node.data.save_as as string;
        if (!seen.has(saveAs)) {
          seen.add(saveAs);
          flowVars.push({
            value: saveAs,
            label: `${saveAs} (${node.data.label || node.type})`,
            group: "flow",
          });
        }
      }
    }
  }

  // Check if any ancestor has a fetch_order node
  const ancestorSet = selectedNodeId ? getAncestorNodeIds(selectedNodeId, edges) : null;
  const hasOrderNode = ancestorSet
    ? nodes.some(n => ancestorSet.has(n.id) && n.type === "fetch_order")
    : nodes.some(n => n.type === "fetch_order");

  const orderVars = hasOrderNode ? ORDER_VARS : [];

  // Check if any ancestor has a validate_customer node
  const hasValidateNode = ancestorSet
    ? nodes.some(n => ancestorSet.has(n.id) && n.type === "validate_customer")
    : nodes.some(n => n.type === "validate_customer");

  const customerValidationVars = hasValidateNode ? CUSTOMER_VALIDATION_VARS : [];

  const all = [...flowVars, ...CONTACT_VARS, ...CONVERSATION_VARS, ...BUSINESS_VARS, ...orderVars, ...customerValidationVars];

  return {
    flowVars,
    contactVars: CONTACT_VARS,
    conversationVars: CONVERSATION_VARS,
    orderVars,
    all,
  };
}

/**
 * Check if a variable name is a known system variable (contact_*, conversation_*, order_*, internal __*).
 */
export function isKnownSystemVariable(varName: string): boolean {
  const trimmed = varName.trim();
  if (trimmed.startsWith("__")) return true; // internal vars
  const allSystem = [...CONTACT_VARS, ...CONVERSATION_VARS, ...ORDER_VARS, ...BUSINESS_VARS];
  return allSystem.some(v => v.value === trimmed);
}

/**
 * Find orphan variables in a text — variables used but not available in the current context.
 */
export function findOrphanVariables(
  text: string,
  nodes: Node[],
  edges: Edge[],
  selectedNodeId?: string
): string[] {
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const { all } = getAvailableVariables(nodes, edges, selectedNodeId);
  const knownValues = new Set(all.map(v => v.value));
  
  const orphans: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const varName = match[1];
    if (!knownValues.has(varName) && !varName.startsWith("__")) {
      orphans.push(varName);
    }
  }
  return [...new Set(orphans)];
}
