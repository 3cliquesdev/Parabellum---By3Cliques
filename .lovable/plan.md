

# Validação Automática de Cliente — Ambos (Nó AI Response + Autopilot Global)

## Resumo

Adicionar triagem silenciosa de cliente em dois níveis:
1. **Autopilot Global**: validação por CPF (novo) que complementa telefone e email já existentes — acontece antes de qualquer fluxo
2. **Painel do nó AI Response**: toggle para ativar/desativar validação automática dentro do nó, com controle granular

## Mudanças

### 1. Nova Edge Function: `validate-by-cpf/index.ts`
- Recebe `cpf` e `contact_id`
- Busca na tabela `contacts` por `document = cpf` (normalizado, apenas dígitos)
- Fallback: busca em `kiwify_events` pelo campo `payload->Customer->document`
- Se encontrar: retorna `found: true` + dados, atualiza contato para `kiwify_validated = true`

### 2. Autopilot Global (`ai-autopilot-chat/index.ts`)
- Na fase de carregamento do contato (onde já ocorre `validate-by-kiwify-phone`), adicionar chamada a `validate-by-cpf` quando `contact.document` existe mas `kiwify_validated` é falso
- Executar em paralelo com validação por telefone (já existente)
- Resultado: contato é promovido silenciosamente antes de qualquer interação

### 3. Painel AI Response — Toggle de Validação (`BehaviorControlsSection.tsx`)
- Nova seção "Validar Cliente Automaticamente" com switch
- Quando ativo, o nó AI Response executa triagem (telefone + email + CPF) antes de responder
- Campos configuráveis: quais dados usar (telefone/email/CPF) — checkboxes
- Armazena: `auto_validate_customer: boolean`, `validate_fields: string[]` no `nodeData`

### 4. Motor de Execução (`process-chat-flow/index.ts`)
- No handler de `ai_response`, se `auto_validate_customer === true`:
  - Verificar se contato já é `kiwify_validated`
  - Se não, executar validação por telefone/email/CPF conforme `validate_fields`
  - Atualizar `contactData.kiwify_validated` e `contactData.is_customer` no contexto do fluxo
  - Variável `{{is_customer}}` fica atualizada para nós seguintes (condições)

### 5. Catálogo de variáveis (`variableCatalog.ts`)
- Adicionar `contact_cpf` / `contact_document` ao `CONTACT_VARS` (se não existir)
- Garantir `cpf` no `CONDITION_CONTACT_FIELDS` para condições

### 6. `supabase/config.toml`
- Registrar `validate-by-cpf` com `verify_jwt = false`

## Fluxo Resultante

```text
AUTOPILOT GLOBAL (antes de tudo):
  Contato entra → telefone ✓ email ✓ CPF ✓ → kiwify_validated = true/false

DENTRO DO FLUXO (nó AI Response com toggle ativo):
  [AI Response node] → valida telefone/email/CPF → atualiza is_customer
      ↓
  [Condition: É Cliente?] → Yes / No
```

## Arquivos Afetados
1. `supabase/functions/validate-by-cpf/index.ts` — **novo**
2. `supabase/functions/ai-autopilot-chat/index.ts` — chamada validate-by-cpf na fase de triagem
3. `supabase/functions/process-chat-flow/index.ts` — handler auto_validate no nó ai_response
4. `src/components/chat-flows/panels/BehaviorControlsSection.tsx` — seção de toggle validação
5. `src/components/chat-flows/variableCatalog.ts` — CPF/document vars
6. `supabase/config.toml` — registrar nova function

