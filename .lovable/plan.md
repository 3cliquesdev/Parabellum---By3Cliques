

# Atualizar descrições das tags 9.98 e 9.04

As duas tags já existem no banco. O pedido é atualizar suas descrições com as definições mais completas fornecidas.

## Alterações

**Via update no banco (insert tool):**

1. **Tag 9.98 – Falta de Interação** (id: `3eb75d67-...`)
   - Atualizar `description` para a definição completa: critérios de uso (atendimento respondeu no prazo, solicitou info, cliente não retornou, demanda pendente)

2. **Tag 9.04 – Desistência da Conversa** (id: `aa44b48d-...`)
   - Atualizar `description` para a definição completa: critérios de uso (cliente abandona por demora, falta de entendimento, decisão de não prosseguir, resolução por outros meios)

Nenhuma alteração de código. Apenas update de dados nas duas linhas existentes da tabela `tags`.

