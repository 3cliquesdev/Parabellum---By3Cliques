

## Auditoria #3D645F2C — 4 Bugs Identificados

### Linha do Tempo

| Hora | Evento | Status |
|------|--------|--------|
| 01:59:57 | "Boa tarde" → Menu produtos | OK |
| 02:00:24 | "1" → Menu assuntos | OK |
| 02:00:51 | "2" (Financeiro) → **Sem apresentação da IA** → Template PIX hardcoded direto | BUG A+B |
| 02:01:41 | Dados PIX enviados → Ticket criado | BUG C+D |
| 02:10:07 | Auto-close | Consequência |

---

### Bug A — IA não se apresentou (CRÍTICO)

O contato tinha OTP verificado de uma conversa ANTERIOR (01:03:16). Ao entrar no nó Financeiro, o guard pós-OTP (L6333-6377) detectou `hasRecentOTPVerification=true` + `hasSaqueIntent=true` (do "2" = financeiro no histórico) e **saltou direto para o template PIX hardcoded**, sem nunca dar chance à IA de se apresentar.

**Fix**: O guard pós-OTP deve verificar se é a **primeira interação no nó** (interaction_count === 0 ou 1). Se for, deve deixar a IA se apresentar primeiro. O template PIX só deve ser enviado se a IA já interagiu pelo menos uma vez.

### Bug B — Template de coleta é hardcoded, não respeita o do fluxo (MÉDIO)

O template PIX no guard (L6355) é uma string fixa:
```
📋 Nome completo: [seu nome]
🔑 Tipo da chave PIX: [CPF/Email/etc]
🔐 Chave PIX: [sua chave]
💰 Valor: [R$ X,XX]
```

Mas o `node_ia_financeiro` tem um `ticket_config.description_template` diferente:
```
Nome: {{customer_name}}
Chave Pix: {{pix_key}}
Banco: {{bank}}
Motivo: {{reason}}
Valor: {{amount}}
```

**Fix**: O guard deve usar o `description_template` do `flow_context.ticketConfig` quando disponível, em vez do template hardcoded.

### Bug C — Ticket não respeita department_id e assigned_to do fluxo (CRÍTICO)

O ticket determinístico (L6288-6290) chama `generate-ticket-from-conversation` com apenas `{ conversation_id, subject, priority, category: 'financeiro' }`. O edge function mapeia `financeiro` → departamento "Financeiro" (af3c75a9).

Porém, o `node_ia_financeiro.ticket_config` define:
- `department_id: b7149bf4` (Customer Success)
- `assigned_to: ce6150bb` (Marco Cruz)

O caminho determinístico **ignora completamente** o `ticketConfig` do fluxo.

**Fix**: Passar `department_id` e `assigned_to` do `flow_context.ticketConfig` ao `generate-ticket-from-conversation`.

### Bug D — Mensagens de auto-close com channel web_chat (MENOR)

As 2 últimas mensagens (encerramento + avaliação) ainda estão com `channel: web_chat` em vez de `whatsapp`. O Fix 18 anterior corrigiu o path de envio de menus, mas o `auto-close-conversations` edge function provavelmente tem o mesmo problema.

---

### Plano de Correção — 3 edições

**Edição 1: `ai-autopilot-chat/index.ts` L6333-6377 — Guard pós-OTP respeita primeira interação**

Antes de enviar o template PIX, verificar `interaction_count`. Se for a primeira chamada no nó (saudação proativa ou primeira mensagem), NÃO enviar template — deixar a IA se apresentar naturalmente.

```typescript
if (hasRecentOTPVerification) {
  // ... (detecção de hasSaqueIntent mantida)
  
  // 🆕 NÃO enviar template na primeira interação — IA deve se apresentar
  const aiInteractions = (conversation.customer_metadata as any)?.__ai?.interaction_count || 0;
  const isFirstInteraction = aiInteractions <= 1;
  
  if (hasSaqueIntent && !recentCollectionMsg && !isFirstInteraction) {
    // Usar template do ticketConfig se disponível
    const tcTemplate = flow_context?.ticketConfig?.description_template;
    const pixCollectResponse = tcTemplate 
      ? `✅ **Identidade confirmada!**\n\nOlá ${contactName}! ${tcTemplate}`
      : `✅ **Identidade confirmada!**\n\n... (template padrão)`;
    // ... enviar
  }
}
```

**Edição 2: `ai-autopilot-chat/index.ts` L6288-6290 — Ticket determinístico usa ticketConfig**

Passar `assigned_to` e fazer override do `department_id` via ticketConfig do fluxo:

```typescript
const tc = flow_context?.ticketConfig;
const { data: ticketData } = await supabaseClient.functions.invoke(
  'generate-ticket-from-conversation',
  { body: { 
    conversation_id: conversationId, 
    subject: tc?.subject_template 
      ? resolveBasicTemplate(tc.subject_template, customerMessage, contactName) 
      : `Solicitação de saque - ${contactName}`,
    priority: tc?.default_priority || 'high', 
    category: tc?.category || 'financeiro',
    assigned_to: tc?.assigned_to || undefined,
    department_id_override: tc?.department_id || undefined,
  }}
);
```

E no `generate-ticket-from-conversation/index.ts`, aceitar `department_id_override` para sobrescrever o mapeamento automático por categoria.

**Edição 3: `generate-ticket-from-conversation/index.ts` — Aceitar department_id_override**

Adicionar campo opcional `department_id_override` na interface e usá-lo com prioridade sobre o mapeamento por categoria:

```typescript
const departmentId = department_id_override || dept?.id || null;
```

### Deploy
- `ai-autopilot-chat`
- `generate-ticket-from-conversation`

### Resultado Esperado
1. IA se apresenta na primeira interação do nó (mesmo com OTP prévio)
2. Template de coleta usa o formato configurado no fluxo
3. Ticket é atribuído a Marco Cruz no departamento Customer Success (conforme ticketConfig)
4. Fluxo completo: Apresentação → Coleta → Ticket → Confirmação

