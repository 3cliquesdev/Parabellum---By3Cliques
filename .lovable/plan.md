

# Atribuir conversa ao consultor do cliente durante transferencia pelo fluxo

## Problema

Quando o fluxo de chat executa um no de Transferir, ele move a conversa para o departamento correto, mas nao atribui ao consultor vinculado ao contato (`contacts.consultant_id`). A conversa vai para o pool do departamento.

## Escopo da mudanca

A atribuicao ao consultor so acontece quando:
- A conversa passa por um **no de Transferencia** dentro de um fluxo
- O contato possui um `consultant_id` definido

Conversas normais de suporte continuam no fluxo padrao (pool/round-robin). Consultores NAO passam a receber conversas genericas.

## Alteracoes

### 1. `supabase/functions/meta-whatsapp-webhook/index.ts`

No bloco de execucao de transferencia do fluxo (~linha 740), antes do update da conversa:
- Buscar `consultant_id` do contato
- Se existir, definir `assigned_to = consultant_id` e `ai_mode = 'copilot'`
- Se nao existir, manter comportamento atual (`waiting_human` + pool)

### 2. `supabase/functions/ai-autopilot-chat/index.ts`

No bloco de transferencia do fluxo (~linha 2451), mesma logica:
- Buscar `consultant_id` do contato
- Se existir, atribuir diretamente e pular chamada ao `route-conversation`
- Se nao existir, manter fluxo atual de distribuicao

### 3. Nenhuma alteracao no `route-conversation`

A logica de distribuicao geral permanece intacta. A atribuicao ao consultor e feita diretamente nos pipelines de transferencia, antes de chamar o distribuidor.

## Detalhes tecnicos

Trecho adicionado em ambos os pipelines (antes do update de transferencia):

```typescript
// Buscar consultant_id do contato
const { data: contactData } = await supabase
  .from('contacts')
  .select('consultant_id')
  .eq('id', contactId)
  .maybeSingle();

if (contactData?.consultant_id) {
  updateData.assigned_to = contactData.consultant_id;
  updateData.ai_mode = 'copilot';
  console.log("[pipeline] Atribuindo ao consultor:", contactData.consultant_id);
}
```

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero - logica adicional apenas no caminho de transferencia de fluxo |
| Suporte geral | Sem alteracao - consultores NAO recebem conversas do pool |
| Contatos sem consultor | Comportamento atual mantido (pool do departamento) |
| Consultor offline | Conversa atribuida mesmo assim (requisito confirmado) |
| Frontend | Sem alteracao necessaria |

