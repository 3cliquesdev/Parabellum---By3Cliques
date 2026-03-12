

# Plano de Implementação — Opção A: Separar Cancelamento + Handle `ai_exit` + Renomear Nós

## 3 Correções a Implementar

### Correção 1: Handle `ai_exit` dedicado no AIResponseNode

**Problema**: O nó IA não tem handle com ID `ai_exit`. Quando `path='ai_exit'`, o `findNextNode` (linha 262) procura `sourceHandle === 'ai_exit'` e não encontra. Cai no fallback que pega qualquer edge — potencialmente a errada.

**Arquivo**: `src/components/chat-flows/nodes/AIResponseNode.tsx`

- Usar `customHandles` no `ChatFlowNodeWrapper` (como `ConditionNode` já faz)
- Adicionar Handle target (esquerda) + Handle source padrão (direita, sem ID) + Handle source `ai_exit` (direita, ID=`ai_exit`, cor verde, label "Saída IA")
- O handle `ai_exit` aparece **sempre** (para consistência visual), posicionado abaixo do handle padrão

### Correção 2: Separar cancelamento do financeiro (Engine)

**Problema**: Termos como "cancelar assinatura" casam com `financialActionPattern` e setam `ai_exit_intent = 'financeiro'`. O ramo "Cancelamento" (keyword `cancelamento`) nunca é atingido.

**Arquivos**: `supabase/functions/process-chat-flow/index.ts` + `supabase/functions/ai-autopilot-chat/index.ts`

Alterações em ambos:
1. **Criar** `cancellationActionPattern`:
   ```
   cancelar\s*(minha\s*)?(assinatura|cobran[çc]a|pagamento|plano|conta|servi[çc]o)|
   quero\s+cancelar|desistir\s*(do|da|de)|
   n[ãa]o\s+quero\s+mais|encerrar\s*(minha\s*)?(conta|assinatura|plano)
   ```
2. **Remover** de `financialActionPattern` o trecho: `cancelar\s*(minha\s*)?(assinatura|cobran[çc]a|pagamento)`
3. **Adicionar** detecção de `cancellationIntentMatch` (mesma lógica que financial/commercial)
4. **Setar** `ai_exit_intent = 'cancelamento'` quando cancelamento detectado
5. **Setar** `path = 'ai_exit'` para cancelamento também
6. No `ai-autopilot-chat`: mesma regex + bloqueio na entrada com `forceCancel` flag + `financialGuardInstruction` expandido para incluir cancelamento

### Correção 3: Renomear nós genéricos via SQL

**Método**: Migration SQL que atualiza o JSON `flow_definition` do fluxo de teste (ID `912b366e-fc12-4a2d-9f5c-335e0bc611da`).

Renomeações principais baseadas no fluxo visual:
- Nós "Condição" → nomes descritivos (Triagem, Verificar Tipo, etc.)
- Nós "Transferir" → "Transferir → [Departamento]"
- Nós "Trava" → "Trava: [Motivo]"
- Nós "Múltipla Escolha" → "Menu [Contexto]"

Isso será feito via `jsonb_set` ou replace no JSON dos labels dos nós.

---

## Resultado Final

```text
[Início] → [Boas-vindas IA] → [IA Suporte]
                                   |
                         handle "ai_exit" (dedicado)
                                   ↓
                        [Roteamento de Intenção]
                        /         |           \
                  financeiro  cancelamento   else
                     ↓            ↓             ↓
              [Segurança]  [Motivo Cancel.]  [Sub-roteamento]
                  ↓              ↓
              [OTP+PIX]    [Ticket Cancel.]
```

| Mensagem | ai_exit_intent | Ramo |
|---|---|---|
| "Quero sacar" | financeiro | Financeiro |
| "Cancelar assinatura" | cancelamento | Cancelamento |
| "Quero comprar" | comercial | Comercial (Outros) |
| "Dúvida sobre saque" | — (info) | IA responde via KB |

