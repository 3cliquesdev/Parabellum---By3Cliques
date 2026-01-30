

# Plano: Adicionar Guard CSAT ao meta-whatsapp-webhook

## Diagnóstico Confirmado

### Problema Identificado
O webhook da **Meta WhatsApp Cloud API** (`meta-whatsapp-webhook`) **NÃO tem** a verificação de CSAT que existe no webhook da Evolution API (`handle-whatsapp-event`).

Quando cliente responde "5" à pesquisa de satisfação:

| Webhook | Comportamento Atual |
|---------|-------------------|
| `handle-whatsapp-event` (Evolution) | Detecta conversa fechada + `awaiting_rating=true` → processa nota → **NÃO reabre** |
| `meta-whatsapp-webhook` (Meta) | Ignora conversas fechadas (`.neq("status", "closed")`) → **CRIA nova conversa** |

### Código Problemático (meta-whatsapp-webhook)

**Linha 278-286:**
```typescript
// Buscar conversa existente - priorizar aberta
let { data: conversation } = await supabase
  .from("conversations")
  .select(...)
  .eq("contact_id", contact.id)
  .neq("status", "closed")  // ❌ IGNORA conversas fechadas com awaiting_rating!
  .order(...)
```

**Linha 317:**
```typescript
status: "open" // Reabrir se estava fechada  // ❌ Não deveria reabrir!
```

### Código Correto (handle-whatsapp-event) - Já implementado

**Linhas 522-602:** Guard de CSAT que:
1. Busca última conversa fechada com `awaiting_rating=true`
2. Extrai rating da mensagem
3. Salva rating na tabela `conversation_ratings`
4. Envia agradecimento
5. **NÃO reabre** a conversa
6. Retorna early (`return`) para não processar mais nada

---

## Solução Proposta

Replicar a lógica de CSAT do `handle-whatsapp-event` para o `meta-whatsapp-webhook`, inserindo o guard **ANTES** da busca/criação de conversa.

---

## Alterações Detalhadas

### 1. Adicionar função `extractRating` no meta-whatsapp-webhook

**Arquivo**: `supabase/functions/meta-whatsapp-webhook/index.ts`

**Local**: Após linha 60 (após interfaces)

```typescript
// Função auxiliar: Extrair rating (1-5) da mensagem
function extractRating(message: string): number | null {
  const normalized = message.trim();
  
  // Detectar número direto: "1", "2", "3", "4", "5"
  const numMatch = normalized.match(/^[1-5]$/);
  if (numMatch) return parseInt(numMatch[0]);
  
  // Detectar estrelas emoji: "⭐⭐⭐⭐⭐"
  const starCount = (message.match(/⭐/g) || []).length;
  if (starCount >= 1 && starCount <= 5) return starCount;
  
  return null;
}
```

### 2. Adicionar Guard CSAT antes da busca de conversa

**Local**: Após linha 276 (após verificar contato existe), ANTES de buscar conversa

```typescript
// ============================================
// PRÉ-VERIFICAÇÃO CSAT - ANTES de criar conversa nova
// Se cliente respondeu avaliação, processar e MANTER fechada
// ============================================
const { data: csatConversation } = await supabase
  .from("conversations")
  .select("id, awaiting_rating, status, whatsapp_meta_instance_id")
  .eq("contact_id", contact.id)
  .eq("awaiting_rating", true)
  .eq("status", "closed")
  .order("closed_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (csatConversation && csatConversation.awaiting_rating) {
  const csatRating = extractRating(messageContent);
  
  if (csatRating !== null) {
    console.log(`[meta-whatsapp-webhook] ⭐ CSAT PRE-CHECK: Rating ${csatRating} detected BEFORE reopen`);
    
    // Buscar department_id para relatórios
    const { data: convForDept } = await supabase
      .from("conversations")
      .select("department")
      .eq("id", csatConversation.id)
      .single();

    // Salvar rating
    const { error: ratingError } = await supabase
      .from("conversation_ratings")
      .insert({
        conversation_id: csatConversation.id,
        rating: csatRating,
        channel: "whatsapp",
        feedback_text: messageContent,
        department_id: convForDept?.department || null,
      });
    
    if (ratingError) {
      console.error("[meta-whatsapp-webhook] Error saving CSAT rating:", ratingError);
    } else {
      console.log("[meta-whatsapp-webhook] ✅ CSAT rating saved successfully");
      
      // Limpar flag - MANTER status = 'closed'
      await supabase
        .from("conversations")
        .update({ awaiting_rating: false })
        .eq("id", csatConversation.id);
      
      // Enviar agradecimento
      let thankYouMessage = "";
      if (csatRating >= 4) {
        thankYouMessage = `🎉 Obrigado pela avaliação de ${csatRating} estrela${csatRating > 1 ? "s" : ""}!\n\nFicamos muito felizes em ter ajudado. Conte sempre conosco! 💚`;
      } else if (csatRating === 3) {
        thankYouMessage = `👍 Obrigado pela sua avaliação!\n\nEstamos sempre buscando melhorar. Se tiver sugestões, fique à vontade para compartilhar!`;
      } else {
        thankYouMessage = `🙏 Agradecemos seu feedback.\n\nLamentamos que sua experiência não tenha sido ideal. Vamos trabalhar para melhorar!`;
      }
      
      // Enviar via send-meta-whatsapp
      await supabase.functions.invoke("send-meta-whatsapp", {
        body: {
          instance_id: instance.id,
          phone_number: fromNumber,
          message: thankYouMessage,
          conversation_id: csatConversation.id,
          skip_db_save: true,
        },
      });
      
      // Inserir mensagem da avaliação na conversa fechada
      await supabase.from("messages").insert({
        conversation_id: csatConversation.id,
        content: `⭐ Avaliação: ${csatRating}/5`,
        sender_type: "contact",
        channel: "whatsapp",
      });
    }
    
    console.log("[meta-whatsapp-webhook] ✅ CSAT processed - conversation stays CLOSED");
    continue; // ⚠️ CRÍTICO: Pular para próxima mensagem, NÃO criar conversa
  }
}
// ============================================
// FIM PRÉ-VERIFICAÇÃO CSAT
// ============================================
```

### 3. Adicionar verificação de awaiting_rating na busca de conversa existente

**Local**: Linha 377 - já existe verificação parcial

```typescript
// Trigger AI Autopilot se ativo (já existe - OK)
if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating) {
```

Isso já está correto e impede que IA responda se `awaiting_rating=true`. Mas o problema é que o código **não chega aqui** porque cria conversa nova antes.

---

## Seção Técnica

### Fluxo Corrigido

```text
Cliente responde "5" à pesquisa CSAT
         │
         ▼
meta-whatsapp-webhook recebe POST
         │
         ▼
Buscar/criar contato
         │
         ▼
🆕 GUARD CSAT: Existe conversa fechada + awaiting_rating=true?
    SIM ─────────────────┐
         │               │
         ▼               │
    Mensagem é rating (1-5)?
    SIM ─────────────────┤
         │               │
         ▼               │
    Salvar rating        │
    Enviar agradecimento │
    continue (pular msg) │◀─────── NÃO cria conversa!
         │               │
    NÃO ─┘               │
         │               │
         ▼               ▼
    Continuar fluxo normal (cria conversa se não houver aberta)
```

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `meta-whatsapp-webhook/index.ts` | Modificar | Adicionar `extractRating` + guard CSAT antes de buscar conversa |

---

## Impacto

| Antes | Depois |
|-------|--------|
| Resposta CSAT cria nova conversa | Resposta CSAT anexada na conversa fechada |
| Cliente recebe boas-vindas do fluxo | Cliente recebe apenas agradecimento |
| Rating perdido | Rating salvo na `conversation_ratings` |
| `awaiting_rating` fica true | `awaiting_rating` setado para false |

---

## Ordem de Implementação

1. Adicionar função `extractRating` no arquivo
2. Adicionar guard CSAT ANTES da busca de conversa (linhas 278-286)
3. Usar `continue` em vez de `return` (estamos dentro de loop `for (const msg of value.messages)`)
4. Deploy da edge function
5. Testar: encerrar conversa com CSAT → cliente responde "5" → verificar que NÃO cria conversa nova

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Cliente responde "5" após CSAT | Rating salvo, conversa permanece fechada |
| Cliente responde "preciso de ajuda" após CSAT | Nova conversa criada (não é rating) |
| Logs mostram guard funcionando | `"⭐ CSAT PRE-CHECK: Rating X detected"` |
| Agradecimento enviado | Mensagem correta baseada no rating |

