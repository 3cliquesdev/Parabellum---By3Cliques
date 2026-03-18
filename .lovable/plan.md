

# Auditoria do Sistema — 2026-03-18 03:28 UTC

## Estado Geral

| Item | Status |
|------|--------|
| Fallback Inteligente (KB + LLM vazio) | ✅ Código presente, aguardando próximo trigger |
| skipLLMForGreeting | ✅ Ativo |
| skipInitialMessage (6 caminhos) | ✅ Código presente, aguardando teste em produção |
| Saudação proativa | ✅ Funcionando |
| **Loop de Reconciliação de Órfãos** | **❌ AINDA ATIVO — 11 conversas, cada 60s** |

---

## Bug Ativo: Cooldown NÃO Funciona (UNIQUE constraint)

**Evidência nos logs**: "Reconciled 11 orphan conversations" a cada 60s. Zero logs de "Cooldown". As mesmas 11 conversas: `4b381f40`, `93db802d`, `08683f94`, `be2cb3ac`, `9c136a19`, `d023674f`, `7459b846`, `67ac6dff`, `e09127b4`, `3f5b822d`, `675c4540`.

**Causa raiz descoberta**: A tabela `conversation_dispatch_jobs` tem um **UNIQUE constraint em `conversation_id`** (`conversation_dispatch_jobs_conversation_id_key`). Cada conversa já tem 1 job `completed` (de ontem). O fluxo:

```text
1. Reconciliação: busca job pending/escalated → não encontra ✅
2. Cooldown: busca job completed com updated_at >= 30min → não encontra
   (jobs foram completados há 4-7 horas) ✅
3. INSERT novo job → FALHA SILENCIOSA (UNIQUE constraint violada)
4. Código NÃO verifica o erro do insert → incrementa reconciled → loga "Created"
```

O INSERT falha mas o código não verifica o resultado. Resultado: 11 INSERTs falhados + 11 logs falsos a cada 60 segundos. Sem impacto funcional, mas gera noise e desperdiça recursos.

---

## Plano de Correção

### 1. `dispatch-conversations/index.ts` — Usar UPSERT em vez de INSERT

Substituir o `insert()` por `upsert()` com `onConflict: 'conversation_id'`. Se já existe um job `completed` para a conversa, ele será atualizado para `pending`. Isso resolve tanto o loop quanto a constraint.

Adicionalmente, adicionar verificação de erro no resultado do upsert para evitar logs falsos.

### 2. Adicionar log de "fora do horário"

Verificar `within_hours` antes de reconciliar. Se estiver fora do expediente e não houver agentes online, NÃO recriar jobs — apenas logar "⏳ Fora do horário, skip reconciliation" uma vez.

### 3. Deploy

Deploy de `dispatch-conversations`.

