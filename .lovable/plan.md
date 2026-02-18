
## Suporte a Multiplos Valores no "Contem" da Condicao

### Problema Atual
O no de condicao do Chat Flow aceita apenas **um unico valor** no campo "Valor esperado". Para verificar se a mensagem contem "preco" OU "valor" OU "quanto custa", o usuario precisa criar 3 nos de condicao encadeados, o que e trabalhoso e poluente visualmente.

### Solucao
Permitir que o campo "Valor esperado" aceite **multiplos valores separados por virgula** quando o tipo for "Contem" (contains). A logica sera: se a mensagem contem **qualquer um** dos valores, a condicao e verdadeira (logica OR).

### Exemplo de uso
- Tipo: Contem
- Valor esperado: `preco, valor, quanto custa, orcamento`
- Mensagem do usuario: "Qual o valor do plano?"
- Resultado: TRUE (contem "valor")

### Alteracoes

**1. Frontend - Editor da Condicao (src/components/chat-flows/ChatFlowEditor.tsx)**
- No campo "Valor esperado", quando tipo for "contains", trocar o `Input` por um `Textarea` com placeholder explicativo: "Separe multiplas frases por virgula"
- Adicionar texto de ajuda abaixo: "Use virgula para verificar multiplas frases (qualquer uma = verdadeiro)"

**2. Frontend - Exibicao do No (src/components/chat-flows/nodes/ConditionNode.tsx)**
- Se `condition_value` contem virgula, mostrar no subtitle algo como: `Contem (Mensagem): "preco, valor, ..." (3 termos)` em vez de mostrar a string inteira

**3. Backend - Motor de Fluxo (supabase/functions/process-chat-flow/index.ts)**
- Na funcao `evaluateCondition` (e na funcao `evalCond` duplicada mais abaixo), quando `condition_type === "contains"`:
  - Fazer split por virgula no `condition_value`
  - Verificar se a mensagem contem **qualquer um** dos termos (OR)
  - Codigo:
    ```
    case "contains": {
      const terms = (condition_value || "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      const msg = userMessage.toLowerCase();
      return terms.length > 0 && terms.some(term => msg.includes(term));
    }
    ```

### O que NAO muda
- Condicoes existentes com valor unico continuam funcionando (split de um valor = array de 1)
- Todos os outros tipos (equals, has_data, regex, etc.) nao sao afetados
- Nenhuma alteracao de banco de dados
- Kill Switch, Shadow Mode, CSAT, distribuicao: nao afetados
- Fluxos salvos anteriormente continuam compativeis

### Secao Tecnica - Arquivos e Linhas

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/chat-flows/ChatFlowEditor.tsx` (~linha 631-639) | Trocar Input por Textarea + hint quando tipo=contains |
| `src/components/chat-flows/nodes/ConditionNode.tsx` (~linha 38-42) | Mostrar contagem de termos quando ha virgula |
| `supabase/functions/process-chat-flow/index.ts` (~linhas 146-147 e 1058-1070) | Split por virgula no case "contains" das duas funcoes de avaliacao |
