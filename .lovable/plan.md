

# Auditoria 100% — ChatFlow Soberano para TODO o Inbox

## Resumo do Estado Atual

As correções anteriores já eliminaram UUIDs de departamento de 7 edge functions (centralizados no `department-resolver.ts`). O `ai-autopilot-chat` tem resolução dinâmica no início do handler.

**Problemas residuais encontrados:**

## Problemas Encontrados

### 🔴 P1 — Tag IDs hardcoded no `auto-close-conversations` (2 UUIDs, usados em 7 locais)

```
const DESISTENCIA_TAG_ID = 'aa44b48d-...';   // "9.04 Desistência da conversa"
const FALTA_INTERACAO_TAG_ID = '3eb75d67-...'; // "9.98 Falta de Interação"
```

Usados como fallback em 7 pontos do auto-close. Se alguém renomear/excluir essas tags no dashboard, o código aplica uma tag fantasma.

**Solução:** Resolver por nome no início do handler com fallback ao UUID atual. Adicionar ao `department-resolver.ts` ou criar um `tag-resolver.ts` dedicado.

### 🔴 P2 — Pipeline/Stage IDs hardcoded no `ai-autopilot-chat` (L8328-8329)

```
const PIPELINE_VENDAS_ID = '00000000-0000-0000-0000-000000000001';  // "Recuperação - Nacional"
const STAGE_LEAD_ID = '11111111-1111-1111-1111-111111111111';      // "Oportunidade"
```

Usados para criar deals de lead. Se o pipeline mudar, deals vão para lugar errado.

**Solução:** Resolver por nome no momento da criação do deal, com fallback ao UUID atual.

### 🔴 P3 — Pipeline ID hardcoded no `ai-governor` (L367)

```
if (deal.pipeline_id === '00000000-0000-0000-0000-000000000001') return 'recuperacao';
```

Comparação direta com UUID. Se o pipeline mudar, a categorização quebra.

**Solução:** Resolver pipeline "Recuperação" por nome, com fallback.

### 🟡 P4 — "Seu Armazém Drop" hardcoded em emails (2 functions)

- `kiwify-webhook/index.ts` L1197: footer de email de boas-vindas
- `send-quote-email/index.ts` L93, L172: header/footer de email de proposta

Estes são fora do inbox, mas comprometem a soberania da marca. Devem buscar o nome da organização do banco.

### 🟡 P5 — Workspace ID default `00000000-...` nas integrações (4 functions)

`integrations-set`, `integrations-get`, `integrations-test`, `integration-encrypt`, `instagram-start-oauth` usam `"00000000-0000-0000-0000-000000000001"` como workspace default. Isso é infraestrutura single-tenant (o sistema só tem 1 workspace), não é um problema de soberania de fluxo. **Não alterar**.

---

## Plano de Correção (foco inbox)

### Correção 1 — Tag resolver dinâmico no `auto-close-conversations`

Adicionar resolução por nome no início do handler:

```typescript
const { data: tagRows } = await supabase
  .from('tags')
  .select('id, name')
  .in('name', ['9.04 Desistência da conversa', '9.98 Falta de Interação']);

const tagMap = new Map((tagRows || []).map((t: any) => [t.name.trim(), t.id]));
const DESISTENCIA_TAG_ID = tagMap.get('9.04 Desistência da conversa') || 'aa44b48d-...';
const FALTA_INTERACAO_TAG_ID = tagMap.get('9.98 Falta de Interação') || '3eb75d67-...';
```

### Correção 2 — Pipeline/Stage dinâmico no `ai-autopilot-chat` (L8328-8329)

Resolver por nome antes de criar o deal:

```typescript
const { data: pipeline } = await supabaseClient
  .from('pipelines').select('id').eq('name', 'Recuperação - Nacional').maybeSingle();
const { data: stage } = await supabaseClient
  .from('stages').select('id').eq('name', 'Oportunidade')
  .eq('pipeline_id', pipeline?.id || '00000000-...').maybeSingle();
const PIPELINE_VENDAS_ID = pipeline?.id || '00000000-0000-0000-0000-000000000001';
const STAGE_LEAD_ID = stage?.id || '11111111-1111-1111-1111-111111111111';
```

### Correção 3 — Pipeline dinâmico no `ai-governor` (L367)

Resolver nome do pipeline para comparação:

```typescript
const { data: recPipeline } = await supabase
  .from('pipelines').select('id').eq('name', 'Recuperação - Nacional').maybeSingle();
const RECUPERACAO_PIPELINE_ID = recPipeline?.id || '00000000-0000-0000-0000-000000000001';
// Depois: if (deal.pipeline_id === RECUPERACAO_PIPELINE_ID) return 'recuperacao';
```

### Correção 4 — Branding dinâmico nos emails (P4)

Substituir "Seu Armazém Drop" por busca ao nome da organização em `kiwify-webhook` e `send-quote-email`. Fallback: "Sua Empresa".

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `auto-close-conversations/index.ts` | +1 query tags por nome, substituir 2 constantes |
| `ai-autopilot-chat/index.ts` | +2 queries pipeline/stage por nome (L8328) |
| `ai-governor/index.ts` | +1 query pipeline por nome (L367) |
| `kiwify-webhook/index.ts` | +1 query org name, substituir "Seu Armazém Drop" |
| `send-quote-email/index.ts` | +1 query org name, substituir "Seu Armazém Drop" |

## O que NÃO alterar
- Workspace IDs nas integrações — infraestrutura single-tenant legítima
- `kiwify_events`, `kiwify_validated` — schema real
- `allowed_sources: 'kiwify'` — tipo de interface
- `department-resolver.ts` — já está correto

**Estimativa:** ~40 linhas alteradas, 5 functions editadas, 5 deploys

