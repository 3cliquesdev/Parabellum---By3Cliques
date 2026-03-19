

# Correção: IA Financeira Cria Ticket com Template do Painel

## Problema Real (Auditoria #22D0647F)

O `node_ia_financeiro` tem uma edge `saque → node_escape_financeiro`. O motor auto-infere `forbidFinancial=true` a partir dessa edge, o que faz a IA emitir `[[FLOW_EXIT:financeiro]]` imediatamente quando o cliente diz "quero sacar" — antes mesmo de tentar OTP ou coleta. O nó financeiro se auto-sabota.

Além disso, o template de descrição configurado no painel (com as variáveis `{{customer_name}}`, `{{pix_key}}`, `{{bank}}`, etc.) já existe no `ticket_config` do nó, mas a IA nunca chega a usá-lo porque sai antes.

```text
Fluxo atual (quebrado):
Cliente: "quero sacar"
→ auto-inference: forbidFinancial=true (por causa da edge saque→escape)
→ IA: [[FLOW_EXIT:financeiro]]
→ process-chat-flow: aiExitForced → node_escape_financeiro
→ "Não consegui resolver. O que prefere fazer?"
→ TICKET NUNCA CRIADO

Fluxo esperado:
Cliente: "quero sacar"
→ IA fica no nó financeiro
→ OTP (se necessário) → Coleta estruturada (PIX, banco, valor, motivo)
→ create_ticket usando template do painel
→ Protocolo entregue ao cliente
```

## Correções

### 1. Remover edge `saque` do nó financeiro (Database)
A edge `saque → node_escape_financeiro` está causando a auto-inferência de `forbidFinancial`. Removê-la resolve o problema na raiz. O saque deve ser tratado DENTRO do nó financeiro, não redirecionado para escape.

### 2. Proteger nó financeiro contra auto-inferência (`process-chat-flow`)
No bloco de auto-inferência (~linha 3352), adicionar exceção: se o nó atual **é** o nó financeiro (tem `ticket_config.enabled=true` com `category` financeira ou smart_collection_fields com campos financeiros), NÃO inferir `forbidFinancial`.

### 3. Garantir que `create_ticket` use 100% os templates do painel (`ai-autopilot-chat`)
O código já lê `tc.subject_template` e `tc.description_template` — mas precisa garantir que:
- O `description_template` do painel substitua a `internalNote` hardcoded quando existir
- Variáveis como `{{reason}}`, `{{customer_name}}`, `{{pix_key}}`, `{{bank}}`, `{{amount}}` sejam resolvidas corretamente
- Se o template do painel estiver configurado, ele tem prioridade absoluta sobre qualquer lógica hardcoded

### 4. Corrigir categoria do ticket no nó (`Database`)
No `ticket_config` do `node_ia_financeiro`, a `category` está como `cancelamento` — precisa ser `saque` ou `financeiro` para refletir o objetivo real do nó.

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | Exceção na auto-inferência para nós com ticket financeiro ativo |
| `supabase/functions/ai-autopilot-chat/index.ts` | Template do painel tem prioridade sobre internalNote hardcoded |
| Database (migration) | Remover edge `saque→escape` do V5; corrigir `ticket_config.category` para `financeiro` |

## Resultado

- Template configurado no painel será usado fielmente na criação do ticket
- Mudanças futuras no template não dependem de código — basta editar no painel visual
- A IA não sai mais do nó financeiro prematuramente
- Categoria, departamento, prioridade e responsável vêm do `ticket_config` do nó

