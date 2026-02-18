
## Nó de Condição com Múltiplas Regras (Múltiplos Caminhos)

### Problema
O nó de Condição atual só tem **2 saídas** (Sim/Não). Para direcionar 3+ caminhos diferentes, você precisa encadear vários nós de condição, o que polui o fluxo.

### Solução
Transformar o nó de Condição para suportar **múltiplas regras**, cada uma com seu próprio handle de saída colorido, mais um handle "Outros" (fallback). Funciona como um switch/case visual.

### Como vai funcionar

```text
                           ┌──── Regra 1 "Preço"     → Mensagem de preços
                           │
[Início] → [Condição]     ├──── Regra 2 "Suporte"   → Transferir humano
                           │
                           ├──── Regra 3 "Pedido"    → Fetch Order
                           │
                           └──── Outros (cinza)       → Resposta IA
```

1. Ao selecionar o nó de Condição, o painel lateral mostra as opções atuais (tipo, campo, valor)
2. Um botão "+ Adicionar Regra" permite criar regras adicionais
3. Cada regra tem: **Rótulo** + **Palavras-chave** (separadas por vírgula, lógica OR)
4. Cada regra gera um **handle colorido** no lado direito do nó (igual ao AskOptionsNode)
5. Um handle cinza "Outros" sempre existe para mensagens que não batem com nenhuma regra
6. O nó continua funcionando com **apenas 1 regra** (Sim/Não) = retrocompatível

### Comportamento no Motor de Fluxo
- Quando o nó tem `condition_rules` (array de regras), o motor itera cada regra na ordem
- Para cada regra, faz split das keywords por vírgula e verifica se a mensagem contém alguma (OR)
- A **primeira regra** que bater define o `sourceHandle` usado para seguir o caminho
- Se nenhuma bater, segue pelo handle `"else"`
- Se `condition_rules` não existir (nós antigos), usa a lógica atual de Sim/Não = **retrocompatível**

### Secao Tecnica

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/chat-flows/nodes/ConditionNode.tsx` | Renderizar handles dinâmicos quando `condition_rules` existir (inspirado no AskOptionsNode). Mostrar badges coloridos por regra + badge cinza "Outros" |
| `src/components/chat-flows/ChatFlowEditor.tsx` | No painel de propriedades da Condição: adicionar UI para gerenciar `condition_rules` (adicionar/remover regras, cada uma com label + keywords). Botao "+ Regra". Default data atualizado |
| `supabase/functions/process-chat-flow/index.ts` | Na travessia (tanto `evaluateCondition` quanto `evalCond`): se `node.data.condition_rules` existir, iterar regras fazendo match contains/equals. Retornar o ID da regra que bateu como sourceHandle, ou "else". Se não existir `condition_rules`, manter lógica true/false atual |
| `bun.lock` | Deletar para corrigir erro de build mux-embed |

### Retrocompatibilidade
- Nós de condição existentes (sem `condition_rules`) continuam usando Sim/Não normalmente
- Quando o usuário adiciona a primeira regra extra, o nó migra para o modo multi-regra
- Kill Switch, Shadow Mode, CSAT, distribuição: inalterados
- Fluxos salvos anteriormente: 100% compatíveis
