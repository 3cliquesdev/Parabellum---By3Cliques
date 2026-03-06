
# Plano: Condição V2 — Nó separado com Sim/Não por regra ✅

## Status: IMPLEMENTADO

## Resumo

Novo tipo de nó `condition_v2` no editor de fluxos. Cada regra tem saídas explícitas **Sim** (verde) e **Não** (vermelho), permitindo definir caminhos para ambos os resultados. O nó `condition` original permanece 100% intocado.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/chat-flows/nodes/ConditionV2Node.tsx` | **Novo** — Visual com handles Sim/Não por regra |
| `src/components/chat-flows/nodes/index.ts` | Export do novo nó |
| `src/components/chat-flows/ChatFlowNodeWrapper.tsx` | Tipo `condition_v2` adicionado |
| `src/components/chat-flows/ChatFlowEditor.tsx` | nodeType, menu, painel de config, edge cleanup |
| `supabase/functions/process-chat-flow/index.ts` | `evaluateConditionV2Path()` + todos os pontos de travessia |

## Lógica V2 (engine)

Para cada regra em ordem:
1. **TRUE** → segue handle `rule.id` (Sim)
2. **FALSE** → se existe edge no handle `rule.id_false` (Não), segue por ela
3. **FALSE sem edge Não** → continua para próxima regra (fallthrough)
4. Se nenhuma regra bater → segue "Outros" (`else`)

## Garantias

- Nó `condition` original: **zero alteração na lógica**
- Master Flow e fluxos existentes: **sem impacto**
- Pode testar V2 em fluxo de teste antes de usar em produção
