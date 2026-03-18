

# Plano: Mostrar ícone de envio em todas as mensagens de IA/humano/copilot

## Problema
Mensagens de IA e atendentes mostram o ícone de relógio (⏳ `sending`) que engana — parece que a mensagem ainda não foi enviada. Algumas mensagens ficam com `status: null` e não mostram nenhum indicador.

## Solução

### 1. `MessageBubble.tsx` — Defaultar status para `'sent'` em mensagens de saída
Na linha 266, quando `!isCustomer` e `status` é `undefined/null`, usar `'sent'` como fallback:

```tsx
{!isCustomer && (
  <MessageStatusIndicator
    status={status || 'sent'}
    errorDetail={errorDetail}
    className={...}
  />
)}
```

### 2. `MessageStatusIndicator.tsx` — Trocar ícone de `sending` de Clock para Send
Substituir o ícone `Clock` (relógio) do estado `'sending'` pelo ícone `Send` (seta) do lucide-react, mantendo o `animate-pulse` para indicar que está em progresso:

```tsx
case 'sending':
  return <Send className={cn(iconClass, "text-muted-foreground animate-pulse")} />;
```

Isso garante que:
- **Todas** as mensagens de saída (IA, humano, copilot) mostram um indicador visual
- Mensagens sem status no DB mostram ✓ (sent)  
- Mensagens em envio mostram ↗ (seta) pulsando
- Mensagens entregues/lidas mantêm ✓✓ como hoje

