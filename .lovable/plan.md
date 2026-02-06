

# Plano Ajustado: "🧪 Testar para Mim" - Enterprise Edition (Corrigido)

## 🚨 Problemas Críticos Identificados & Soluções

### 1. **Conflito: playbook_id NOT NULL vs "Testar sem Salvar"**

**Análise:**
- Schema atual: `playbook_executions.playbook_id UUID NOT NULL`
- Código tentava usar `playbook_id: undefined` quando não salvo
- Isso vai gerar erro de inserção

**Solução Escolhida (Opção 1 - Recomendada):**
- **Exigir playbook salvo para testar**
- No PlaybookEditor: se `!playbookId`, botão "Testar" fica desabilitado com tooltip "Salve o playbook primeiro"
- Simplifica schema, sem mudanças complexas em `playbook_executions`
- UX clara: "Simular → Testar" é a progressão natural

**Mudanças:**
```typescript
// PlaybookEditor.tsx
<Button
  disabled={testPlaybook.isPending || nodes.length === 0 || !playbookId}
  title={!playbookId ? "Salve o playbook primeiro para testar" : ""}
>
  🧪 Testar para Mim
</Button>
```

---

### 2. **RPC is_manager_or_admin: Incompatibilidade de Assinatura**

**Análise:**
- RPC existe: `is_manager_or_admin(_user_id uuid) RETURNS boolean`
- Código tentava: `.rpc('is_manager_or_admin', { _user_id: user.id })`
- ✅ Tecnicamente correto, MAS...
- Dependência em RPC no edge é arriscado se houver timeout

**Solução (Melhor Prática):**
- Usar **query direta** no `profiles.role` com client admin
- Mais rápido, mais legível, não depende de RPC
- Aceita `null` gracefully

```typescript
// test-playbook/index.ts
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

const isManager = ['admin', 'manager', 'general_manager', 'support_manager', 'cs_manager', 'financial_manager'].includes(profile?.role || '');
```

---

### 3. **Segurança: Falta de Separação Entre Clients**

**Análise:**
- Código atual: 1 client (`supabaseAdmin`) para tudo
- ✅ Funciona, MAS não reflete best practice
- Em edge functions, você DEVE ter:
  - **Client "user"** (com auth do usuário): validar permissões
  - **Client "admin"** (service role): operações administrativas

**Solução:**
- Usar **2 clients**:
  - `supabaseClient` (anon + Authorization header): `auth.getUser()` apenas
  - `supabaseAdmin` (service role): criar execution, test_run, queue, etc.

```typescript
// test-playbook/index.ts - estrutura corrigida
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: req.headers.get('Authorization')! } }
});
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Só auth
const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

// Tudo o mais usa supabaseAdmin
```

---

## ⭐ Ajustes Fortes Recomendados

### 4. **Evitar "[TESTE] [TESTE]" (Idempotência)**

**Problema:** Se reprocessar execução, pode duplicar prefix.

**Solução:**
```typescript
const finalSubject = isTestMode
  ? (subject.startsWith('[TESTE]') ? subject : `[TESTE] ${subject}`)
  : subject;
```

---

### 5. **Centralizar Override do Destinatário (Helper Function)**

**Problema:** Override de email em 2+ pontos → fácil esquecer

**Solução:** Helper reutilizável
```typescript
function getEmailTarget(execution: PlaybookExecution, item: QueueItem, contact: any, fallbackName: string) {
  const isTestMode = execution.metadata?.is_test_mode === true || item.node_data?._test_mode === true;
  const speedMultiplier = item.node_data?._speed_multiplier ?? execution.metadata?.speed_multiplier ?? 1;
  const to = isTestMode ? (execution.metadata?.test_recipient_email || contact.email) : contact.email;
  const to_name = isTestMode ? (execution.metadata?.test_recipient_name || fallbackName) : fallbackName;
  
  return { isTestMode, speedMultiplier, to, to_name };
}

// Uso:
const { isTestMode, speedMultiplier, to, to_name } = getEmailTarget(execution, item, contact, 'User');
```

Aplicar em:
- `executeEmailNode` (linha 336)
- `executeFormNode` (linha 588)
- Qualquer outro ponto que chame `send-email`

---

### 6. **Link Forte: test_run_id no metadata da execution**

**Problema:** Debugar é difícil se só temos execution_id referência.

**Solução:**
```typescript
// test-playbook/index.ts
const { data: testRun } = await supabaseAdmin
  .from('playbook_test_runs')
  .insert({ ... })
  .select()
  .single();

const { data: execution } = await supabaseAdmin
  .from('playbook_executions')
  .insert({
    ...,
    metadata: {
      ...,
      test_run_id: testRun.id  // ← Link direto
    }
  });
```

---

## 📋 Padronizar Nomenclatura

**Decisão:** 
- **API/Frontend:** `recipient_email`, `recipient_name` (semanticamente correto)
- **DB:** Keep `tester_email` (já existe), mapeie no edge:

```typescript
// test-playbook/index.ts
const { recipient_email, recipient_name } = body;

const { data: testRun } = await supabaseAdmin
  .from('playbook_test_runs')
  .insert({
    tester_email: recipient_email.toLowerCase(), // Mapear ao inserir
    tester_name: recipient_name || null,
    ...
  });
```

---

## 🗂️ Estrutura de Arquivos a Atualizar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/test-playbook/index.ts` | **Rewrite** - 2 clients, permissão, rate limit, test_run_id link |
| `src/hooks/useTestPlaybook.tsx` | **Update** - interface com recipient_email |
| `src/components/playbook/PlaybookEditor.tsx` | **Update** - botão desabilitado se sem playbookId, input email |
| `supabase/functions/process-playbook-queue/index.ts` | **Update** - helper função, propagação flags, status tracking |

---

## 📊 Diagrama de Fluxo Corrigido

```text
[Usuário clica "🧪 Testar"]
         │
         ├─ playbookId? ──NO──→ [Botão desabilitado] "Salve primeiro"
         │
         └─ SIM
              ↓
    ┌─────────────────────────────────────────┐
    │  test-playbook (2 clients)              │
    │  1. supabaseClient.auth.getUser()       │
    │  2. Check role via profiles.role        │
    │  3. Rate limit check (5/h, 20/d)        │
    │  4. Permission: manager OR own email    │
    │  5. supabaseAdmin: criar execution      │
    │  6. supabaseAdmin: criar test_run       │
    │  7. Link: test_run_id em metadata       │
    │  8. Enfileirar com flags                │
    └─────────────────────────────────────────┘
              ↓
    ┌─────────────────────────────────────────┐
    │  process-playbook-queue                 │
    │  ────────────────────────────────────────│
    │  Helper: getEmailTarget()               │
    │  - Override: to = test_recipient_email  │
    │  - Subject: "[TESTE] " (sem dup)        │
    │  - Banner: visual (amarelo)             │
    │  - Delays: acelerados (10x)             │
    │  - Propagação: flags em todos nodes     │
    └─────────────────────────────────────────┘
              ↓
    [Email enviado para recipient_email]
    [playbook_test_runs.status = done]
```

---

## ✅ Testes Obrigatórios (Corrigidos)

| # | Cenário | Validação |
|---|---------|-----------|
| 1 | Clicar "Testar" sem salvar | Botão desabilitado + tooltip |
| 2 | Manager vs Comum, permissão | 403 se não é manager + email ≠ user email |
| 3 | Rate limit 5/h | 6º teste falha com 429 |
| 4 | Rate limit 20/d | 21º teste falha com 429 |
| 5 | Email recebe [TESTE] | Subject começa com [TESTE] (não [TESTE] [TESTE]) |
| 6 | Email recebe banner | Div amarela com "🧪 EMAIL DE TESTE" |
| 7 | Delay 1h → 6min | speedMultiplier=10 aplicado |
| 8 | Verificar metadata | test_run_id presente em execution.metadata |
| 9 | Queue items | Todos carregam `_test_mode=true` e `_speed_multiplier` |
| 10 | Completar teste | playbook_test_runs.status = 'done' |

---

## 🔒 Garantias Enterprise (Finais)

| # | Garantia | Implementação |
|---|----------|---------------|
| 1 | Sem playbook_id conflict | Exigir salvar antes de testar |
| 2 | Manager override | Role check via profiles.role (rápido) |
| 3 | 2 clients (segurança) | Anon para auth, admin para operações |
| 4 | Sem [TESTE] duplicado | Check `startsWith('[TESTE]')` |
| 5 | Email override centralizado | Helper function em todos pontos |
| 6 | Auditoria forte | test_run_id no metadata |
| 7 | Sem regressão | Modo normal untouched |

---

## 🚀 Sequência Final de Implementação

1. ✅ **test-playbook/index.ts** (rewrite completo)
   - 2 clients
   - permissão via profiles.role
   - rate limit
   - test_run_id link

2. ✅ **useTestPlaybook.tsx** (atualizar interface)
   - recipient_email, recipient_name

3. ✅ **PlaybookEditor.tsx** (UI fixes)
   - Desabilitar botão se sem playbookId
   - Input email (managers only)

4. ✅ **process-playbook-queue/index.ts** (helpers + overrides)
   - getEmailTarget() helper
   - Atualizar executeEmailNode e executeFormNode
   - Status tracking para test_run
   - Propagar flags (já implementado)

5. ✅ Deploy e testes end-to-end

