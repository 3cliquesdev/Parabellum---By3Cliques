

# Condição V2 — Novo tipo de nó, zero impacto no existente

## Análise da preocupação

A preocupação é válida. Modificar o `ConditionNode` existente e o motor de fluxos impacta **todos os fluxos ativos** imediatamente — inclusive o Master Flow em produção. Qualquer bug na lógica de avaliação poderia causar roteamento incorreto.

## Decisão: Criar `condition_v2` como tipo separado

O nó atual (`condition`) permanece **100% intocado** — visual, motor, edges, tudo. Um novo tipo `condition_v2` é adicionado ao canvas com o comportamento de Sim/Não por regra.

### O que muda

**1. Novo tipo de nó no editor**
- Registrar `condition_v2` em `nodeTypes` do ReactFlow
- Criar `ConditionV2Node.tsx` com handles Sim (verde) + Não (vermelho) por regra + "Outros" (cinza)
- Adicionar ao menu de inserção de nós como "Condição V2 (Sim/Não)"

**2. Painel de configuração**
- Reutilizar a lógica existente do painel de condição multi-regra (mesmos campos, check_type, etc.)
- Diferença: o preview mostra os pares Sim/Não

**3. Motor (edge function)**
- Adicionar bloco `case 'condition_v2':` no `process-chat-flow`
- Lógica: para cada regra, se TRUE → handle `rule.id`, se FALSE → handle `rule.id_false`, se nenhum match → `else`
- O bloco `case 'condition':` existente **não é tocado**

**4. Arquivos afetados**
- `src/components/chat-flows/nodes/ConditionV2Node.tsx` (novo)
- `src/components/chat-flows/ChatFlowEditor.tsx` (registrar nodeType + menu)
- `src/components/chat-flows/panels/` (painel de config, reutilizar existente)
- `supabase/functions/process-chat-flow/index.ts` (novo case block)

### Garantias
- Master Flow e todos os fluxos atuais: **zero alteração**
- Pode testar o V2 em um fluxo de teste antes de usar em produção
- Se quiser, depois migra os nós condition para condition_v2 manualmente no canvas

