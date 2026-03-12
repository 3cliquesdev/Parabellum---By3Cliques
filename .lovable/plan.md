

# Bug: Nó de condição não avança — cai no "Desculpe, não entendi"

## Diagnóstico

O motor de fluxos (`process-chat-flow`) tem um **bug de escopo de código**. Quando o nó ativo é do tipo `condition` (como o nó `1769459229369` do fluxo de teste), o motor:

1. Avalia corretamente a condição → `path="else"` (logs confirmam)
2. Mas **nunca resolve `nextNode`** porque a linha `nextNode = findNextNode(flowDef, currentNode, path)` (L2673) está **dentro** do bloco `else if (ai_response)`, e não **depois** da cadeia if/else

O resultado: `path` é definido, mas `nextNode` permanece `null`. O código não retorna nenhuma resposta dentro do `if (activeState)`, cai no bloco de trigger matching (L3594+), encontra o estado ativo existente e retorna a mensagem genérica "Desculpe, não entendi sua resposta".

## Evidências nos logs

```
📌 Active flow found: node=1769459229369 status=waiting_input
🔄 Processing node: type=condition → path="else"
⚠️ Estado ativo encontrado - NÃO iniciar Master Flow   ← NUNCA deveria chegar aqui
```

O log `➡️ Transition: from=condition(...)` da L2675 **NUNCA aparece**, confirmando que L2673 não é alcançada para nós de condição.

## Correção

Mover a resolução de `nextNode` para **depois** da cadeia if/else completa, garantindo que `condition` e `condition_v2` também tenham seus paths resolvidos. Especificamente:

1. **Extrair** `nextNode = findNextNode(flowDef, currentNode, path)` e todo o código de auto-travessia/delivery que segue (L2673-3575) para **fora** do bloco `else if (ai_response)`
2. **Garantir** que o bloco `ai_response` EXIT (que faz `delete collectedData.__ai` e "cai no findNextNode") continue funcionando — ele já seta `path` implicitamente ou usa `findNextNode` com path adequado
3. Adicionar um guard: se `path` está definido e `nextNode` ainda é null após a cadeia if/else, resolver via `findNextNode(flowDef, currentNode, path)`

A correção estrutural: fechar o bloco `else if (ai_response)` **antes** da L2673, para que condition, condition_v2 e ai_response EXIT todos alcancem o `findNextNode`.

## Impacto

- Corrige o nó de condição (tipo `equals` com multi-regra) que fica travado em `waiting_input`
- O caminho `else` → `welcome_ia` será seguido corretamente
- Não afeta nós `ask_*` (já tratados separadamente com return) nem `ai_response` STAY (já retorna)

## Teste de validação

Após o deploy, enviar qualquer mensagem na conversa `#AC05E4D4` e verificar que:
- A condição avalia `path="else"` → avança para `welcome_ia` (nó de mensagem "Oi! Sou o Cliker IA...")
- A IA começa a responder em vez de repetir "Desculpe, não entendi"

