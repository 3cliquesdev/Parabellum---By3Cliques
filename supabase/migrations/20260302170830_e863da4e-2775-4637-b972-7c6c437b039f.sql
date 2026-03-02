-- Reset conversa #6FE96859: devolver ao fluxo no nó condition (pós ia_entrada)
-- O condition vai auto-avançar para ask_options "Você já é nosso cliente?"

-- 1. Reativar o flow state
UPDATE chat_flow_states 
SET status = 'waiting_input',
    current_node_id = '1769459318164',
    completed_at = NULL
WHERE id = '246e0b22-96ea-4def-bcba-feab3960ba85';

-- 2. Devolver conversa ao fluxo (autopilot mode, sem dept hardcoded)
UPDATE conversations 
SET ai_mode = 'autopilot',
    department = NULL,
    assigned_to = NULL
WHERE id = '6fe96859-ebf3-44b9-810f-7323058fd3a3';