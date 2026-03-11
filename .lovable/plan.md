

# Plano: 4 Melhorias nos Arquivos de IA

## Estado atual

- **FIX 1 e 2 (auto-handoff)**: Já implementados na versão atual — UUID dinâmico e notas sem markdown já estão no código.
- **FIX 3 (cross-session memory)**: Existe (linha 4098-4127) mas **quebrado** — usa `customer_metadata?.ai_summary` que não existe na tabela `conversations`. Nunca retorna dados úteis.
- **FIX 4 (persona contextual)**: Existe parcialmente (linha 4129-4137) mas **fora do `generateRestrictedPrompt`** e não cobre os casos solicitados (`customer`, `lead`, `forbidFinancial`).

## Mudanças necessárias

### FIX 3 — Reescrever cross-session memory (ai-autopilot-chat, linhas 4098-4127)

Substituir a busca de `customer_metadata?.ai_summary` por busca real de última mensagem de cada conversa fechada:

```typescript
const { data: pastConvs } = await supabaseClient
  .from('conversations')
  .select('id, created_at, closed_at')
  .eq('contact_id', contact.id)
  .eq('status', 'closed')
  .neq('id', conversationId)
  .order('closed_at', { ascending: false })
  .limit(3);

let crossSessionContext = '';
if (pastConvs && pastConvs.length > 0) {
  for (const conv of pastConvs) {
    const { data: lastMsg } = await supabaseClient
      .from('messages')
      .select('content, sender_type')
      .eq('conversation_id', conv.id)
      .in('sender_type', ['agent', 'system'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastMsg?.content) {
      const dateStr = conv.closed_at
        ? new Date(conv.closed_at).toLocaleDateString('pt-BR')
        : 'data desconhecida';
      crossSessionContext += `- ${dateStr}: "${lastMsg.content.substring(0, 150)}"\n`;
    }
  }
}
if (crossSessionContext) {
  crossSessionContext = `\n\nHistórico de atendimentos anteriores deste cliente:\n${crossSessionContext}(Use apenas como contexto, não mencione explicitamente ao cliente)`;
}
```

### FIX 4 — Adicionar persona no `generateRestrictedPrompt` (linha ~1202)

Antes do `return restrictions`, adicionar:

```typescript
if (contactStatus === 'customer' || contactStatus === 'vip') {
  restrictions += '\nTom: cordial e proativo. Este é um cliente ativo — priorize resolução ágil.';
} else if (contactStatus === 'lead') {
  restrictions += '\nTom: amigável e consultivo. Foque em entender a necessidade sem pressão.';
}
if (forbidFinancial) {
  restrictions += '\nSe o cliente demonstrar preocupação financeira, responda com empatia e tranquilidade antes de qualquer informação.';
}
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `ai-autopilot-chat/index.ts` | FIX 3: reescrever linhas 4098-4127 (cross-session) |
| `ai-autopilot-chat/index.ts` | FIX 4: adicionar persona no `generateRestrictedPrompt` (linha ~1202) |
| `auto-handoff/index.ts` | Nenhuma — FIX 1 e 2 já estão implementados |

## Resultado

- Cross-session memory passa a funcionar de verdade (busca mensagens reais, não campo inexistente)
- Persona contextual aplicada tanto no prompt geral quanto no prompt restritivo de flows

