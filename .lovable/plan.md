

# Plano: Adicionar Filtro de Canal WhatsApp no Broadcast

## Problema Identificado

A query atual do `broadcast-ai-queue` **não filtra pelo canal**. Embora os dados mostrem que todas são WhatsApp, devemos garantir na query para evitar falhas futuras.

## Alteração

### Arquivo: `supabase/functions/broadcast-ai-queue/index.ts`

**Linha 76-93** - Adicionar filtro `channel = 'whatsapp'`:

```typescript
// 2. Buscar conversas elegíveis (fila da IA) - SOMENTE WHATSAPP
const { data: conversations, error: convError } = await supabase
  .from("conversations")
  .select(`
    id,
    contact_id,
    channel,
    contacts!inner (
      id,
      phone,
      whatsapp_id,
      first_name,
      last_name
    )
  `)
  .eq("ai_mode", "autopilot")
  .eq("status", "open")
  .eq("channel", "whatsapp")  // ← NOVO: Garante apenas WhatsApp
  .is("assigned_to", null)
  .not("contacts.phone", "is", null)
  .limit(limit);
```

## Impacto

| Antes | Depois |
|-------|--------|
| Busca todas as conversas da fila IA | Busca **apenas** conversas WhatsApp |
| Pode incluir web_chat por engano | Garante que só WhatsApp é processado |
| 263 elegíveis (misturado) | ~263 elegíveis (só WhatsApp) |

## Atualização no Dialog

Mostrar ao usuário que são conversas **WhatsApp** especificamente:

```typescript
// BroadcastAIQueueDialog.tsx
<p className="text-sm text-muted-foreground">
  {count} conversas WhatsApp na fila da IA serão notificadas
</p>
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/broadcast-ai-queue/index.ts` | Adicionar `.eq("channel", "whatsapp")` na query |
| `src/components/inbox/BroadcastAIQueueDialog.tsx` | Clarificar que são conversas WhatsApp |

## Resultado

O broadcast agora é **100% seguro** para enviar apenas via WhatsApp Meta API, sem risco de tentar enviar para conversas de outros canais.

