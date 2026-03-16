

# Correção da Race Condition — meta-whatsapp-webhook

## Problema
Quando o cliente envia uma imagem no WhatsApp, a Meta dispara 2 webhooks simultâneos. Ambas as threads não encontram conversa existente, tentam inserir — a segunda falha por violação de unicidade, retornando `undefined`, gerando o log `❌ Failed to find/create conversation`.

## Correção
Substituir as linhas **560-575** em `supabase/functions/meta-whatsapp-webhook/index.ts`:

**De:**
```typescript
const { data: newConv } = await supabase
  .from("conversations")
  .insert({...})
  .select("...")
  .single();

conversation = newConv;
console.log("... New conversation created:", conversation?.id);
```

**Para:**
```typescript
const { data: newConv, error: newConvError } = await supabase
  .from("conversations")
  .insert({...})
  .select("...")
  .single();

if (newConvError) {
  console.error("[meta-whatsapp-webhook] ❌ ERRO AO CRIAR CONVERSA (possível race condition):", newConvError);
  const { data: existingRaceConv } = await supabase
    .from("conversations")
    .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider, customer_metadata, department_id")
    .eq("contact_id", contact.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  conversation = existingRaceConv;
  console.log("[meta-whatsapp-webhook] 💬 Conversa recuperada via fallback após colisão:", conversation?.id);
} else {
  conversation = newConv;
  console.log("[meta-whatsapp-webhook] 💬 New conversation created:", conversation?.id);
}
```

## Deploy
Deploy individual apenas de `meta-whatsapp-webhook`.

