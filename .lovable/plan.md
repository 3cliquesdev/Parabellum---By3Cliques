

# Plano: Transferência Marca "Não Respondida" para Novo Agente

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

A RPC `transfer_conversation_secure` (migration `20260130143125`) atualiza `conversations` (assigned_to, department, ai_mode) mas **não toca no `inbox_view.last_sender_type`**. O trigger de inbox só dispara em INSERT de `messages`, não em UPDATE de `conversations`. Resultado: conversa transferida mantém `last_sender_type = 'user'` e o novo agente não a vê em "Não respondidas".

## Solução

Uma migration SQL que recria `transfer_conversation_secure` adicionando um UPDATE no `inbox_view` após o UPDATE em `conversations`.

### Alteração na RPC (única mudança)

Após a linha 69 (UPDATE conversations), adicionar:

```sql
-- Reset inbox_view para que novo agente veja como "não respondida"
UPDATE inbox_view
SET assigned_to = p_to_user_id,
    department = p_to_department_id,
    last_sender_type = 'contact'
WHERE conversation_id = p_conversation_id;
```

O reset para `'contact'` é correto porque:
- Se já era `'contact'`, é idempotente
- Se era `'user'` (agente anterior respondeu), o novo agente ainda não respondeu — deve ver como pendente
- Não depende de mensagem `system` — UPDATE direto, atômico dentro da mesma transação

### Arquivo

| Arquivo | Mudança |
|---|---|
| **Migration SQL (nova)** | `CREATE OR REPLACE FUNCTION transfer_conversation_secure` com UPDATE adicional no `inbox_view` |

A função completa será idêntica à versão atual (migration `20260130143125`), com a adição do bloco acima entre o step 5 (UPDATE conversations) e o step 6 (audit log).

## Fluxo Corrigido

```text
1. Cliente envia msg         → last_sender_type = 'contact'  ✅ "Não respondida" para A
2. Agente A responde          → last_sender_type = 'user'    ✅ sai de "Não respondidas"
3. A transfere para B         → last_sender_type = 'contact' ✅ "Não respondida" para B
4. B responde                 → last_sender_type = 'user'    ✅ sai de "Não respondidas"
```

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas adiciona UPDATE, sem remover lógica existente |
| Kill Switch | Não afetado |
| Trigger guard (system) | Preservado — este UPDATE é direto, não via mensagem |
| Badge/counts | Consistente — critério `contact` mantido |
| Atomicidade | Sim — mesmo bloco transacional da RPC |

