/**
 * Template: Onboarding Completo (14+ nós)
 * Esqueleto pronto para vincular templates de email e formulários.
 */

const X_LEFT = 0;
const X_TRUE = 350;
const X_FALSE = 350;
const Y_STEP = 160;

let y = 0;
const nextY = () => { const cur = y; y += Y_STEP; return cur; };

export function getOnboardingCompletoTemplate() {
  y = 0; // reset

  const nodes = [
    // NÓ 1 — Email Boas-vindas
    {
      id: "node_1",
      type: "email",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Boas-vindas", subject: "", template_id: "" },
    },
    // NÓ 2 — Delay 1 dia
    {
      id: "node_2",
      type: "delay",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Aguardar 1 dia", delay_type: "days", delay_value: 1 },
    },
    // NÓ 3 — Email de Valor
    {
      id: "node_3",
      type: "email",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Email de Valor", subject: "", template_id: "" },
    },
    // NÓ 4 — Delay 2 dias
    {
      id: "node_4",
      type: "delay",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Aguardar 2 dias", delay_type: "days", delay_value: 2 },
    },
    // NÓ 5 — Condition: email_clicked
    {
      id: "node_5",
      type: "condition",
      position: { x: X_LEFT, y: nextY() },
      data: {
        label: "Clicou no email?",
        condition_type: "email_clicked",
        condition_value: "",
      },
    },
    // NÓ 6A — Form (TRUE path)
    {
      id: "node_6a",
      type: "form",
      position: { x: X_TRUE, y: y - Y_STEP + 20 },
      data: {
        label: "Formulário — Cliente Engajado",
        form_id: "",
        form_name: "",
        pause_execution: true,
        timeout_days: 4,
      },
    },
    // NÓ 6B — Email Reengajamento (FALSE path)
    {
      id: "node_6b",
      type: "email",
      position: { x: -X_FALSE, y: y - Y_STEP + 20 },
      data: { label: "Reengajamento", subject: "", template_id: "" },
    },
    // NÓ 7 — Delay 2 dias (merge)
    {
      id: "node_7",
      type: "delay",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Aguardar 2 dias", delay_type: "days", delay_value: 2 },
    },
    // NÓ 8 — Condition: form_score >= 1
    {
      id: "node_8",
      type: "condition",
      position: { x: X_LEFT, y: nextY() },
      data: {
        label: "Score do formulário?",
        condition_type: "form_score",
        score_operator: "gte",
        score_threshold: 1,
        score_name: "leadScoringTotal",
      },
    },
    // NÓ 9A — Email Consultor Definido (TRUE)
    {
      id: "node_9a",
      type: "email",
      position: { x: X_TRUE, y: y - Y_STEP + 20 },
      data: { label: "Consultor Definido", subject: "", template_id: "" },
    },
    // NÓ 9B — Email Lembrete Urgente (FALSE)
    {
      id: "node_9b",
      type: "email",
      position: { x: -X_FALSE, y: y - Y_STEP + 20 },
      data: { label: "Lembrete Urgente — Formulário", subject: "", template_id: "" },
    },
    // NÓ 10 — Delay 2 dias (merge)
    {
      id: "node_10",
      type: "delay",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Aguardar 2 dias", delay_type: "days", delay_value: 2 },
    },
    // NÓ 11 — Condition: form_score >= 1
    {
      id: "node_11",
      type: "condition",
      position: { x: X_LEFT, y: nextY() },
      data: {
        label: "Score do formulário? (2ª vez)",
        condition_type: "form_score",
        score_operator: "gte",
        score_threshold: 1,
        score_name: "leadScoringTotal",
      },
    },
    // NÓ 11B — Email Último Lembrete (FALSE)
    {
      id: "node_11b",
      type: "email",
      position: { x: -X_FALSE, y: y - Y_STEP + 20 },
      data: { label: "Último Lembrete", subject: "", template_id: "" },
    },
    // NÓ 12 — Delay 3 dias (merge TRUE + 11B)
    {
      id: "node_12",
      type: "delay",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Aguardar 3 dias", delay_type: "days", delay_value: 3 },
    },
    // NÓ 13 — Email Check-in 14 dias
    {
      id: "node_13",
      type: "email",
      position: { x: X_LEFT, y: nextY() },
      data: { label: "Check-in 14 dias", subject: "", template_id: "" },
    },
    // NÓ 14 — Task final
    {
      id: "node_14",
      type: "task",
      position: { x: X_LEFT, y: nextY() },
      data: {
        label: "Verificar conclusão de onboarding — {{primeiro_nome}}",
        task_type: "manual",
        description:
          "Cliente passou por toda a sequência. Verificar se formulário foi preenchido e consultor designado. Se não, contato manual.",
      },
    },
  ];

  const edges = [
    // Sequência linear inicial
    { id: "e1-2", source: "node_1", target: "node_2" },
    { id: "e2-3", source: "node_2", target: "node_3" },
    { id: "e3-4", source: "node_3", target: "node_4" },
    { id: "e4-5", source: "node_4", target: "node_5" },

    // NÓ 5 branches
    { id: "e5-6a", source: "node_5", target: "node_6a", sourceHandle: "true", label: "Sim" },
    { id: "e5-6b", source: "node_5", target: "node_6b", sourceHandle: "false", label: "Não" },

    // Merge para NÓ 7
    { id: "e6a-7", source: "node_6a", target: "node_7" },
    { id: "e6b-7", source: "node_6b", target: "node_7" },

    // Sequência pós-merge
    { id: "e7-8", source: "node_7", target: "node_8" },

    // NÓ 8 branches
    { id: "e8-9a", source: "node_8", target: "node_9a", sourceHandle: "true", label: "Sim" },
    { id: "e8-9b", source: "node_8", target: "node_9b", sourceHandle: "false", label: "Não" },

    // Merge para NÓ 10
    { id: "e9a-10", source: "node_9a", target: "node_10" },
    { id: "e9b-10", source: "node_9b", target: "node_10" },

    // Sequência pós-merge
    { id: "e10-11", source: "node_10", target: "node_11" },

    // NÓ 11 branches
    { id: "e11-12", source: "node_11", target: "node_12", sourceHandle: "true", label: "Sim" },
    { id: "e11-11b", source: "node_11", target: "node_11b", sourceHandle: "false", label: "Não" },

    // 11B merge para NÓ 12
    { id: "e11b-12", source: "node_11b", target: "node_12" },

    // Sequência final
    { id: "e12-13", source: "node_12", target: "node_13" },
    { id: "e13-14", source: "node_13", target: "node_14" },
  ];

  return { nodes, edges };
}

export const ONBOARDING_COMPLETO_META = {
  name: "Onboarding Completo (14 dias)",
  description:
    "Sequência completa de onboarding: boas-vindas, emails de valor, formulário de engajamento, verificações de score e check-in final com task manual.",
};
