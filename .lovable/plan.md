

# Plano: Remover lógica de consultor do webhook

Analisei o projeto atual e sigo as regras da base de conhecimento.

## O que muda

Remover toda a lógica de consultor (`consultant_id`, `hasConsultant`, pré-atribuição) do `meta-whatsapp-webhook`. Toda conversa nova vai iniciar em `autopilot` com `assigned_to: null`. O roteamento para consultor será feito exclusivamente via nós de transferência no Chat Flow Editor.

## Arquivo: `supabase/functions/meta-whatsapp-webhook/index.ts`

### Remoção (linhas 560-596)

1. **Remover** a query de `contacts` que busca `consultant_id` e `consultant_manually_removed` (linhas 568-574)
2. **Remover** a variável `hasConsultant` (linha 574)
3. **Simplificar** o insert da conversa: `assigned_to` sempre `null` (linha 585)
4. **Remover** o log condicional de consultor (linhas 594-596)

**Resultado:**
```typescript
const { data: newConv } = await supabase
  .from("conversations")
  .insert({
    contact_id: contact.id,
    channel: "whatsapp",
    status: "open",
    ai_mode: "autopilot",
    assigned_to: null,
    whatsapp_provider: "meta",
    whatsapp_meta_instance_id: instance.id,
  })
  .select("id, ai_mode, status, assigned_to, awaiting_rating, whatsapp_provider")
  .single();

conversation = newConv;
console.log("[meta-whatsapp-webhook] 💬 New conversation created:", conversation?.id);
```

## Impacto

- Zero regressão: conversas existentes e reabertura (`closed → open`) não são afetadas
- O `ai_mode` de reabertura continua resetando para `autopilot` (fix anterior preservado)
- Consultor routing passa a ser 100% responsabilidade do Chat Flow
- Rollback: restaurar o bloco de query + `hasConsultant`

