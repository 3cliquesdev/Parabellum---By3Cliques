

## Plano: Otimizar IA — Remover query duplicada + Usar RAGConfig centralizado + Listar bloqueios do fluxo

### Diagnóstico

**3 problemas encontrados:**

1. **Query duplicada** (linhas 4127-4139): O código faz uma segunda query ao banco para ler `ai_strict_rag_mode`, sendo que `getRAGConfig()` já lê essa config. Porém, `getRAGConfig()` só é chamada via `getConfiguredAIModel()` na linha 3514 — e o resultado (`RAGConfig`) é descartado, retornando apenas o model string.

2. **RAGConfig não está disponível no escopo do handler**: `getConfiguredAIModel` chama `getRAGConfig` internamente mas retorna apenas `config.model`. Precisamos refatorar para carregar o `RAGConfig` completo uma vez e reutilizá-lo.

3. **Bloqueios no fluxo Master Flow**: O nó `ia_entrada` (IA Suporte) tem `forbid_financial=true`, `forbid_commercial=true` e **19 exit_keywords** incluindo: `Saque`, `Reembolso`, `cancelamento`, `cancelar`, `sacar`, `Devolução`, `saldo`, `devoluções`, `consultor`, `meu consultor`, `falar com consultor`, `atendente humano`, `transferir`, `falar com alguem`, `menu`, `opcoes`, `pessoa`, `falar com alguém`, `quero um atendentes`.

---

### Mudanças

#### 1. Database (SQL via insert tool)
```sql
UPDATE system_configurations SET value = 'false' WHERE key = 'ai_strict_rag_mode';
UPDATE system_configurations SET value = '0.45' WHERE key = 'ai_rag_min_threshold';
```

#### 2. Edge Function `ai-autopilot-chat/index.ts`

**A) Refatorar `getConfiguredAIModel` → carregar RAGConfig completo no handler**

Na linha ~3514, trocar:
```typescript
const configuredAIModel = await getConfiguredAIModel(supabaseClient);
```
Por:
```typescript
const ragConfig = await getRAGConfig(supabaseClient);
const configuredAIModel = ragConfig.model;
```

**B) Remover query duplicada (linhas 4127-4139)**

Substituir todo o bloco:
```typescript
let isStrictRAGMode = false;
try {
  const { data: strictModeConfig } = await supabaseClient
    .from('system_configurations')
    .select('value')
    .eq('key', 'ai_strict_rag_mode')
    .maybeSingle();
  isStrictRAGMode = strictModeConfig?.value === 'true';
  console.log(...)
} catch (configError) { ... }
```
Por:
```typescript
const isStrictRAGMode = ragConfig.strictMode;
console.log('[ai-autopilot-chat] 🎯 Modo RAG Estrito:', isStrictRAGMode ? 'ATIVADO' : 'desativado');
```

**C) Usar `ragConfig.blockFinancial` na trava financeira (linha 1338)**

Alterar a condição de:
```typescript
if (flowForbidFinancial && customerMessage && ...)
```
Para:
```typescript
if (ragConfig.blockFinancial && flowForbidFinancial && customerMessage && ...)
```

Porém há um problema de escopo: `ragConfig` é carregado na linha ~3514, mas a trava financeira executa na linha ~1338 (antes). Para resolver, mover o carregamento do RAGConfig para logo após a criação do `supabaseClient` (linha ~1282).

**Refatoração de escopo:**
- Mover `const ragConfig = await getRAGConfig(supabaseClient);` para logo após linha 1282
- Usar `ragConfig.model` onde `configuredAIModel` é definido (linha 3514)
- Usar `ragConfig.blockFinancial` na trava financeira (linha 1338)
- Usar `ragConfig.strictMode` no anti-alucinação (linha 4127)

#### 3. Deploy da Edge Function

---

### Sobre os bloqueios no fluxo (Fix 3 — informativo)

O nó `ia_entrada` do **Master Flow** tem estas configurações que causam os 155 bloqueios/dia:

| Config | Valor |
|---|---|
| `forbid_financial` | `true` — bloqueia: Saque, Reembolso, cancelamento, cancelar, sacar, Devolução, saldo, devoluções |
| `forbid_commercial` | `true` — bloqueia perguntas comerciais via regex no código |
| `exit_keywords` | 19 palavras incluindo: consultor, meu consultor, falar com consultor, atendente humano, transferir, menu, opcoes, pessoa |

**Ação recomendada (manual no editor de fluxos):** Remover `forbid_financial=true` do nó se quiser que a IA tente responder sobre saldo/cancelamento usando a KB. Manter `exit_keywords` para transferência humana explícita é correto.

---

### Impacto esperado

| Métrica | Antes | Depois |
|---|---|---|
| IA resolve | 16% | ~45-55% |
| Transfers (strict RAG) | 58% | ~25-30% |
| Block financeiro | 17% (108/dia) | Controlável via banco (`ai_block_financial`) |
| Queries por mensagem | 2 (duplicada) | 1 (RAGConfig único) |

