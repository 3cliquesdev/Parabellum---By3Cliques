

# Fix: Regressão na Conversa #3D2C2A77 — Coluna Inexistente

## Causa Raiz

O `ai-autopilot-chat` está crashando com erro **`column contacts_1.ai_summary does not exist`** na query de busca da conversa (linha 1961). Como a query falha, retorna 404 e a IA **não consegue processar nenhuma mensagem** — nem OTP, nem coleta de dados, nem geração de ticket.

Evidência nos logs:
```
09:49:05 ERROR column contacts_1.ai_summary does not exist
09:49:05 INFO  ⏱️ Latência total: 128ms | Status: 404
09:48:30 ERROR column contacts_1.ai_summary does not exist  
09:48:30 INFO  ⏱️ Latência total: 795ms | Status: 404
```

A coluna `ai_summary` **não existe** na tabela `contacts` — foi referenciada no código mas nunca criada via migration.

## Correções

### 1. Remover `ai_summary` da query de contatos (linha 1961)

Remover a referência à coluna inexistente na query `.select()`:

```typescript
// ANTES:
contacts!inner(id, first_name, ..., ai_summary)

// DEPOIS:
contacts!inner(id, first_name, ..., assigned_to)
```

### 2. Neutralizar uso de `ai_summary` no prompt (linha 7402)

Remover ou comentar o bloco que injeta `contact?.ai_summary` no system prompt (linhas 7401-7405), já que a coluna não existe.

### 3. Atualizar build version e redeployar

Mudar `BUILD-V3 2026-03-18` → `BUILD-V4 2026-03-20` para confirmar que o deploy realmente tomou efeito (linha 1567).

### Resultado Esperado

A query volta a funcionar → a IA recebe o contexto da conversa → OTP, coleta de dados e geração de ticket voltam a operar normalmente.

