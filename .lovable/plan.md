

# Auditoria do Motor de Fluxos (`process-chat-flow`)

## Resultado Geral: 1 bug real encontrado, 2 pontos de atenção

---

## BUG 1: Referência a função inexistente `rebuildVariablesContext` (Linha 1289)

**Severidade: Média** — não causa crash, mas silenciosamente falha.

No bloco de auto-validação de cliente dentro do nó `ai_response` (linha 1289), o código chama:
```js
if (typeof rebuildVariablesContext === 'function') rebuildVariablesContext();
```

Mas a função real se chama `rebuildCtx` (definida na linha 1150). O `typeof` guard impede o crash, mas o `variablesContext` nunca é atualizado após a validação do cliente, fazendo com que variáveis como `contact_is_customer` fiquem desatualizadas durante a sessão da IA.

**Correção:** Substituir `rebuildVariablesContext` por `rebuildCtx` e atualizar `variablesContext`.

---

## PONTO DE ATENÇÃO 1: `minMatches` sempre = 1 (Linha 2061)

```js
const minMatches = essentialKeywords.length <= 1 ? 1 : 1;
```

A lógica ternária resulta sempre em `1` independente da condição. Funciona, mas parece ser um TODO esquecido. Se a intenção era exigir mais matches para triggers com muitas keywords, nunca foi implementado. Não causa erro, mas pode gerar falsos positivos em triggers longos.

**Recomendação:** Manter como está (conservador) ou ajustar para `Math.ceil(essentialKeywords.length * 0.5)` se quiser mais precisão.

---

## PONTO DE ATENÇÃO 2: `masterVariablesContext` não é reconstruído (Linha 2195)

No Master Flow, o `masterVariablesContext` é construído uma vez e nunca atualizado quando `collectedData` muda. No cenário atual isso é irrelevante porque o Master Flow não coleta dados antes de chegar ao nó de conteúdo, mas seria um problema se a estrutura do fluxo mudar no futuro.

---

## Demais verificações — tudo OK

| Área | Status |
|------|--------|
| Kill Switch (`ai_global_enabled`) | Bloqueia corretamente, exceto Test Mode |
| Proteção `ai_mode` (waiting_human/copilot/disabled) | Funciona |
| `ask_options` validação estrita | Match por número ou texto exato — correto |
| Anti-duplicação IA (janela 5s) | Implementado e funcional |
| Trava financeira (`forbid_financial`) | Regex + `forceFinancialExit` — correto |
| Exit keywords | Case-insensitive includes — correto |
| Max interactions → avança para próximo nó | Correto (não hardcoda transfer) |
| Auto-travessia de nós sem conteúdo | Limite de 12-20 steps, sem loop infinito |
| Cleanup de estados duplicados | Delete + cancel — correto |
| Inactivity condition | Respeita mensagem ativa do usuário |
| Master Flow fallback | Upsert de state, cascata de handles — correto |

---

## Plano de Correção

1. **Corrigir linha 1289**: Trocar `rebuildVariablesContext` por `rebuildCtx` e adicionar `variablesContext = rebuildCtx()` para atualizar o contexto.

2. **Redeployar** a edge function `process-chat-flow`.

Nenhum downgrade. A correção garante que o contexto de variáveis fique atualizado quando o cliente é validado automaticamente durante um nó `ai_response`.

