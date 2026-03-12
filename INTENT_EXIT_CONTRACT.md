# 🎯 Contrato de Saídas de Intenção — Regras Travadas

> **Status**: ATIVO | **Última atualização**: 2026-03-12
> Este contrato é referência imutável. Qualquer mudança nas saídas de intenção deve respeitar estas regras.

---

## 1. Arquitetura de Saídas (nó `ai_response`)

- **6 handles** de saída no editor visual:
  | Handle | Cor | Ícone | Descrição |
  |---|---|---|---|
  | `default` | Cinza | — | Fallback / saída padrão |
  | `financeiro` | Amarelo | 💰 | Intenção financeira confirmada |
  | `cancelamento` | Vermelho | ❌ | Intenção de cancelamento confirmada |
  | `comercial` | Esmeralda | 🛒 | Intenção comercial confirmada |
  | `suporte` | Azul | 🧑 | Solicitação de atendimento humano |
  | `consultor` | Roxo | 💼 | Solicitação de consultor vinculado |

- **Hierarquia de fallback** para busca de arestas:
  `[intent path]` → `ai_exit` (legado) → `default`

- **Consultor → Suporte**: Se o contato **não** possui `consultant_id`, o path `consultor` faz fallback automático para `suporte`

## 2. Formato de Saída da IA

- **Formato obrigatório**: `[[FLOW_EXIT:intent]]`
- Intents válidos: `financeiro`, `cancelamento`, `comercial`, `consultor`, `suporte`
- **Proibido**: `[[FLOW_EXIT]]` genérico (sem `:intent`)
- O regex `ESCAPE_PATTERNS` reconhece o formato e o parser `isCleanExit` extrai o `ai_exit_intent`

## 3. Prompts (`generateRestrictedPrompt`)

Cada intent tem um bloco no prompt base com:
1. **Instrução de detecção** — quando a IA deve suspeitar da intenção
2. **Desambiguação obrigatória** — a IA DEVE perguntar antes de confirmar
3. **Instrução de confirmação** — se o cliente confirmar, responder com `[[FLOW_EXIT:intent]]`
4. **Instrução de dúvida** — se for apenas dúvida, responder usando a Base de Conhecimento

| Intent | Exit Tag | Desambiguação |
|---|---|---|
| Financeiro | `[[FLOW_EXIT:financeiro]]` | "Dúvida sobre financeiro ou quer SOLICITAR/REALIZAR?" |
| Cancelamento | `[[FLOW_EXIT:cancelamento]]` | "Dúvida sobre cancelamento ou quer CANCELAR?" |
| Comercial | `[[FLOW_EXIT:comercial]]` | "Dúvida sobre produto ou quer COMPRAR/CONTRATAR?" |
| Consultor | `[[FLOW_EXIT:consultor]]` | "Dúvida ou quer FALAR com seu consultor?" |

- **Proibido**: Disparar `[[FLOW_EXIT:*]]` sem desambiguação prévia

## 4. Guards Contextualizados (`*GuardInstruction`)

4 guards injetados no `contextualizedSystemPrompt` quando flags `forbid*` estão ativas:

| Guard | Flag de ativação | Exit Tag |
|---|---|---|
| `financialGuardInstruction` | `forbidFinancial` | `[[FLOW_EXIT:financeiro]]` |
| `cancellationGuardInstruction` | `forbidCancellation` | `[[FLOW_EXIT:cancelamento]]` |
| `commercialGuardInstruction` | `forbidCommercial` | `[[FLOW_EXIT:comercial]]` |
| `consultorGuardInstruction` | `forbidConsultant` | `[[FLOW_EXIT:consultor]]` |

- Cada guard tem flag `ambiguous*Detected` para reforço contextualizado
- Todos os 4 guards são injetados simultaneamente no `contextualizedSystemPrompt`
- Guards **complementam** o `generateRestrictedPrompt`, não o substituem

## 5. Propagação de Flags (`forbid*`)

4 flags propagadas em **todas** as camadas:

| Flag | Descrição |
|---|---|
| `forbidFinancial` | Proíbe IA de resolver tema financeiro |
| `forbidCommercial` | Proíbe IA de resolver tema comercial |
| `forbidCancellation` | Proíbe IA de resolver tema de cancelamento |
| `forbidConsultant` | Proíbe IA de resolver solicitação de consultor |

### Locais de propagação:

| Camada | Arquivo | Contexto |
|---|---|---|
| Meta buffer | `meta-whatsapp-webhook/index.ts` | Buffer context (4 flags) |
| Meta direct | `meta-whatsapp-webhook/index.ts` | Direct context (4 flags) |
| Evolution | `handle-whatsapp-event/index.ts` | `flow_context` (4 flags) |
| Motor | `process-chat-flow/index.ts` | Lidas do nó `ai_response` |

## 6. Propagação de `intentData`

Todas as re-invocações de `process-chat-flow` incluem `intentData: { ai_exit_intent: 'intent' }`:

| Webhook | Intent | Ocorrências |
|---|---|---|
| Meta (`meta-whatsapp-webhook`) | `financeiro` | 2x (normal + retry) |
| Meta (`meta-whatsapp-webhook`) | `comercial` | 2x (normal + retry) |
| Meta (`meta-whatsapp-webhook`) | `cancelamento` | 1x |
| Evolution (`handle-whatsapp-event`) | `financeiro` | 1x |
| Evolution (`handle-whatsapp-event`) | `comercial` | 1x |
| Evolution (`handle-whatsapp-event`) | `cancelamento` | 1x |
| Evolution (`handle-whatsapp-event`) | Clean exit (`ai_exit_intent`) | 1x |

## 7. Motor de Fluxos (`process-chat-flow`)

### 7.1 Destructuring de force flags
- `forceCancellationExit`, `forceFinancialExit`, `forceCommercialExit`, `forceSupportExit`, `forceConsultorExit`

### 7.2 Forbids lidos do nó
- `forbid_financial`, `forbid_commercial`, `forbid_cancellation`, `forbid_support`, `forbid_consultant`

### 7.3 Intent mapping (5 intents)
- `intentData.ai_exit_intent` mapeado para force flags correspondentes

### 7.4 Auto-detect (5 intents)
- Detecta intenção por keywords no texto do usuário quando não há `intentData`
- 5 blocos de detecção: financeiro, cancelamento, comercial, suporte, consultor

### 7.5 Path selection (6 paths)
- `financeiro` → handle `financeiro`
- `cancelamento` → handle `cancelamento`
- `comercial` → handle `comercial`
- `suporte` → handle `suporte`
- `consultor` → handle `consultor` (com fallback para `suporte` sem `consultant_id`)
- `default` → handle `default`

---

## Referências de Código

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Prompts, guards, parser `isCleanExit`, `ESCAPE_PATTERNS` |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Propagação forbid flags (Meta), re-invocações com `intentData` |
| `supabase/functions/handle-whatsapp-event/index.ts` | Propagação forbid flags (Evolution), re-invocações com `intentData` |
| `supabase/functions/process-chat-flow/index.ts` | Destructuring, mapping, auto-detect, path selection |

---

> ⚠️ **Regra de ouro**: Qualquer alteração nas saídas de intenção deve ser validada contra este contrato. Se a mudança viola alguma regra, é uma **regressão** e deve ser bloqueada.
