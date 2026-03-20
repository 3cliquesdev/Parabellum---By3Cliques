

# Auditoria Completa: Lógica Hardcoded Remanescente no `ai-autopilot-chat`

## Diagnóstico

A refatoração do `buildCollectionMessage` foi bem-sucedida — os 5 call-sites usam o helper centralizado. Porém o **system prompt** (L7200-7473) ainda contém **blocos massivos de lógica hardcoded** que ignoram completamente a configuração do fluxo e da persona.

---

## Problemas Encontrados

### 🔴 P1 — `persona.system_prompt` é buscado do banco mas NUNCA injetado
- **L4047:** `system_prompt` é carregado da tabela `ai_personas`
- **L7241:** Em vez de usar `persona.system_prompt`, o código tem **hardcoded**: `"Você é a Lais, assistente virtual inteligente da Parabellum / 3Cliques."`
- **Impacto:** Qualquer instrução configurada no dashboard da persona é 100% ignorada

### 🔴 P2 — "Cérebro Financeiro" hardcoded com referências a "Seu Armazém Drop" e "Kiwify"
- **L7269-7441:** Bloco de ~170 linhas com cenários A/B/C hardcoded:
  - `"Cancelar sua assinatura/curso (comprado na Kiwify)?"`
  - `"Sacar o saldo da sua carteira (Seu Armazém Drop)?"`
  - `"7 dias de garantia"`, link `https://reembolso.kiwify.com.br/login`
  - `"Cenário C: REEMBOLSO/DEVOLUÇÃO"` com passos fixos
- **Impacto:** Qualquer cliente que use esta plataforma verá referências a "Seu Armazém Drop" e "Kiwify", ignorando o branding e as regras do fluxo

### 🔴 P3 — Bypass direto de cancelamento com texto hardcoded
- **L6082-6093:** `isCancellationRequest` dispara resposta fixa com link Kiwify e "7 dias de garantia"
- **Impacto:** Qualquer pedido de cancelamento recebe resposta fixa, sem consultar KB ou fluxo

### 🔴 P4 — Menu A/B hardcoded no OTP inline handler
- **L8841-8847:** Quando intent não é detectada pós-OTP, mostra menu fixo:
  - `"A) Cancelar sua assinatura/curso (comprado na Kiwify)?"`
  - `"B) Sacar o saldo da sua carteira (Seu Armazém Drop)?"`
- **Impacto:** Ignora completamente o objetivo/contexto configurado no nó do fluxo

### 🟡 P5 — Textos de confirmação de ticket hardcoded
- **L6345, L8097:** `"7 dias úteis"`, `"equipe financeira vai processar o PIX"`
- **Impacto:** Menor, mas ainda acopla a um modelo de negócio específico

---

## Solução Proposta

### Passo 1 — Injetar `persona.system_prompt` no prompt principal
Substituir a linha hardcoded `"Você é a Lais..."` (L7241-7242) por:
```
${persona.system_prompt || `Você é ${persona.name || 'uma assistente virtual'}${persona.role ? `, ${persona.role}` : ''}. Sua missão é AJUDAR o cliente.`}
```

### Passo 2 — Extrair "Cérebro Financeiro" para a Knowledge Base
- Remover o bloco L7269-7441 do system prompt
- Substituir por uma instrução genérica que delega ao `description_template`, `smartCollectionFields` e à KB:
```
**SOLICITAÇÕES FINANCEIRAS:**
Quando o cliente solicitar uma ação financeira (saque, reembolso, cancelamento):
1. Se OTP verificado → use o template de coleta configurado no fluxo (já injetado acima)
2. Se não verificado → peça verificação de identidade primeiro
3. Para dúvidas informativas → consulte a base de conhecimento
4. NÃO invente cenários, menus A/B, ou procedimentos — siga APENAS o que está configurado no fluxo e na KB
```

### Passo 3 — Eliminar bypass hardcoded de cancelamento (L6082-6093)
- Remover a resposta fixa com link Kiwify
- Deixar o fluxo visual decidir o que fazer com cancelamentos (via `[[FLOW_EXIT:cancelamento]]` ou KB)

### Passo 4 — Eliminar menu A/B hardcoded pós-OTP (L8841-8847)
- Substituir por fallback genérico que usa o `flowObjective` ou `flow_context.contextPrompt`:
```
assistantMessage = `Identidade verificada com sucesso, ${verifiedContact.first_name}! ✅\n\nComo posso te ajudar?`;
```

### Passo 5 — Parametrizar textos de confirmação de ticket
- Substituir `"7 dias úteis"` e `"equipe financeira"` por variáveis do `ticketConfig` (ex: `tc?.sla_text || 'em breve'`)

---

## Arquivos Afetados

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | L6082-6093 | Remover bypass cancelamento hardcoded |
| | L7241-7242 | Injetar `persona.system_prompt` |
| | L7269-7441 | Substituir cérebro financeiro por instrução genérica |
| | L8841-8847 | Eliminar menu A/B hardcoded |
| | L6345, L8097 | Parametrizar SLA text |

**Estimativa:** ~200 linhas removidas, ~30 linhas adicionadas

## Resultado Esperado

- `persona.system_prompt` do dashboard é a identidade da IA (não mais "Lais")
- Zero referências hardcoded a "Kiwify", "Seu Armazém Drop", "Parabellum"
- O fluxo visual + KB controlam 100% do comportamento financeiro
- Qualquer empresa que use a plataforma terá comportamento correto sem precisar editar código

