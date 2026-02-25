

# Plano: Atribuição Automática ao Consultor Pós-Onboarding

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema Identificado

Conversas criadas durante o onboarding entram em `autopilot` com `assigned_to = null`. Quando o contato recebe um `consultant_id` (via distribuição de deal ou atribuição manual), a conversa **aberta** não é atualizada — fica "presa" em autopilot sem agente.

O ROUTING-LOCK (linha 479) resolve apenas conversas **novas** de clientes recorrentes. Para conversas já existentes, não há mecanismo de sincronização.

## Solução

Criar um **trigger no banco de dados** que, ao detectar atualização de `consultant_id` em `contacts`, busca conversas abertas sem `assigned_to` desse contato e as atribui automaticamente ao consultor.

## Mudanças

### 1. Migration SQL — Trigger `sync_consultant_to_open_conversations`

Criar função + trigger na tabela `contacts`:

- **Dispara quando**: `UPDATE` em `contacts` onde `consultant_id` muda de `NULL` para um valor (ou muda para um novo valor)
- **Ação**: Busca conversas do contato com `status = 'open'` e `assigned_to IS NULL`
- **Atualiza**: `assigned_to = NEW.consultant_id`, `ai_mode = 'copilot'`
- **Proteção**: Não altera conversas que já têm `assigned_to` (respeita atribuições manuais/transferências)
- **Log**: Insere registro em `interactions` para auditoria

```text
contacts (UPDATE consultant_id)
        │
        ▼
┌─────────────────────────────┐
│  trigger: sync_consultant   │
│  AFTER UPDATE ON contacts   │
│  WHEN NEW.consultant_id     │
│       IS DISTINCT FROM      │
│       OLD.consultant_id     │
│       AND NEW.consultant_id │
│       IS NOT NULL           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  UPDATE conversations       │
│  SET assigned_to = consultor│
│      ai_mode = 'copilot'    │
│  WHERE contact_id = NEW.id  │
│    AND status = 'open'      │
│    AND assigned_to IS NULL  │
└─────────────────────────────┘
```

### 2. Nenhuma mudança no código frontend ou Edge Functions

- O trigger é puramente server-side (DB-level)
- Não afeta ROUTING-LOCK nem TRANSFER-PERSIST-LOCK
- Não altera fluxos, distribuição ou kill switch

## Regras de Segurança

| Regra | Respeitada |
|---|---|
| Só atualiza conversas sem `assigned_to` | Sim — `WHERE assigned_to IS NULL` |
| Não altera conversas fechadas | Sim — `WHERE status = 'open'` |
| Não interfere com kill switch | Sim — trigger não envia mensagens |
| Não interfere com fluxos ativos | Sim — apenas muda atribuição |
| Auditoria | Sim — log em `interactions` |

## Impacto

- **Upgrade**: Contatos que recebem consultor passam a ter suas conversas abertas atribuídas automaticamente
- **Zero regressão**: Conversas já atribuídas, fechadas ou em transferência não são afetadas
- **Rollback**: Basta dropar o trigger (`DROP TRIGGER sync_consultant_to_open_conversations ON contacts`)

## Arquivos

| Arquivo | Tipo | Mudança |
|---|---|---|
| Migration SQL (novo) | Database | Função + trigger `sync_consultant_to_open_conversations` |

