-- FASE 1: Ajustar temperatura da persona Helper para maior consistência
UPDATE ai_personas 
SET temperature = 0.5 
WHERE name = 'Helper' AND is_active = true;

-- FASE 3: Adicionar templates para reembolso/devolução
INSERT INTO ai_message_templates (key, title, category, content, description, is_active, variables)
VALUES 
(
  'reembolso_coleta_dados',
  'Coleta de Dados - Reembolso',
  'suporte',
  'Entendi que houve um problema com seu pedido. Para resolver rapidamente, preciso de algumas informações:

1️⃣ **Número do pedido:** (ex: #12345)
2️⃣ **Qual produto veio errado/com defeito?**
3️⃣ **O que você esperava receber?**

📷 Se possível, envie uma foto do produto para agilizar a análise.',
  'Template para coleta inicial de dados em casos de reembolso/devolução',
  true,
  '[]'
),
(
  'reembolso_opcoes',
  'Opções de Resolução - Reembolso',
  'suporte',
  'Perfeito! Recebi as informações. Agora me confirma: você prefere:

**A)** Reembolso do valor pago
**B)** Reenvio do produto correto
**C)** Troca por outro item

Responda com a letra da opção desejada.',
  'Template para apresentar opções de resolução ao cliente',
  true,
  '[]'
),
(
  'reembolso_ticket_criado',
  'Ticket Criado - Reembolso',
  'suporte',
  '✅ **Solicitação registrada com sucesso!**

📋 **Protocolo:** #{{ticket_id}}
📦 **Pedido:** {{order_id}}
🔄 **Tipo:** {{resolution_type}}

Nossa equipe analisará o caso em até **48h úteis**.
📧 Você receberá um email com atualizações.

Obrigado pela paciência!',
  'Template de confirmação após criar ticket de reembolso',
  true,
  '[{"name": "ticket_id", "description": "ID do ticket criado"}, {"name": "order_id", "description": "ID do pedido"}, {"name": "resolution_type", "description": "Tipo de resolução escolhida"}]'
)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  variables = EXCLUDED.variables,
  updated_at = now();