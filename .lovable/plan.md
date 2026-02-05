
# Plano de Refinamento do CSAT Guard e Idempotência

Analisando as instruções, o objetivo é tornar o sistema de avaliação (CSAT) via WhatsApp extremamente rigoroso, evitando capturas indevidas e garantindo que cada conversa tenha apenas uma avaliação registrada, mesmo em caso de reprocessamento de eventos.

## Diagnóstico e Melhorias

### 1. Validação Estrita de Mensagem
O extrator atual aceita emojis de estrela. Seguindo a nova regra, aceitaremos **apenas texto puro** contendo exatamente um dígito de 1 a 5. Qualquer outra variação ("nota 5", "5 estrelas") será ignorada pelo Guard, permitindo que a mensagem siga para o fluxo normal (reabrindo a conversa ou disparando o menu).

### 2. Idempotência Atômica
Para evitar que múltiplos disparos do webhook registrem a mesma avaliação várias vezes:
- Adicionaremos uma restrição de unicidade (`UNIQUE`) na coluna `conversation_id` da tabela `conversation_ratings`.
- O código tratará a falha de inserção (conflito) silenciosamente, garantindo que o processamento do webhook não falhe, mas que a lógica de "agradecimento" e "desligamento da flag" ocorra apenas uma vez (ou seja ignorada se já processada).

### 3. Refinamento do Guard
A busca pela conversa que aguarda avaliação será protegida por:
- Filtro obrigatório de `instance_id` para evitar conflitos entre diferentes números de WhatsApp.
- Janela de tempo baseada em `rating_sent_at` (quando o pedido foi enviado) em vez de `closed_at`.
- Uso de `Date.now()` para cálculos de tempo, evitando problemas de fuso horário.

---

## Passos da Implementação

### Passo 1: Mudanças no Banco de Dados (SQL Migration)
1.  **Restrição de Unicidade**: Garantir que `conversation_id` seja único em `conversation_ratings`.
2.  **Índice Parcial**: Criar o índice `idx_conversations_csat_guard` otimizado para a query do webhook.
3.  **Limpeza do Backlog**: Rodar o script de limpeza para resetar `awaiting_rating` em conversas expiradas (> 48h).

### Passo 2: Atualização da Edge Function `meta-whatsapp-webhook`
1.  **Refinar `extractRating`**: Remover suporte a estrelas, manter apenas regex `^[1-5]$`.
2.  **Refinar Guard Query**: Implementar a lógica com `rating_sent_at`, `instance.id` e janela de 24h.
3.  **Tratar Inserção do Rating**: Adicionar bloco try/catch ou verificação de erro para tratar o conflito de unicidade (idempotência).

### Passo 3: Atualização da Edge Function `handle-whatsapp-event`
1.  Aplicar as mesmas melhorias de validação e query, adaptando para os campos específicos do provider Evolution (`whatsapp_instance_id`).

---

## Detalhes Técnicos

### Validação Strict
```typescript
function extractRating(message: string): number | null {
  const normalized = message.trim();
  const numMatch = normalized.match(/^[1-5]$/);
  return numMatch ? parseInt(numMatch[0]) : null;
}
```

### Query Otimizada
```typescript
const CSAT_WINDOW_HOURS = 24;
const csatWindowLimitIso = new Date(Date.now() - CSAT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

const { data: csatConversation } = await supabase
  .from("conversations")
  .select("id, awaiting_rating, status, whatsapp_meta_instance_id, rating_sent_at")
  .eq("contact_id", contact.id)
  .eq("awaiting_rating", true)
  .eq("status", "closed")
  .eq("whatsapp_meta_instance_id", instance.id) // Segurança multi-instância
  .not("rating_sent_at", "is", null)
  .gte("rating_sent_at", csatWindowLimitIso)
  .order("rating_sent_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

---

## Verificação de Não Regressão

- [ ] **Teste de Texto Sujo**: Mandar "Nota 5" ou "5 estrelas" -> Deve iniciar novo atendimento (não capturar como CSAT).
- [ ] **Teste de Emoji**: Mandar "⭐⭐⭐⭐⭐" -> Deve iniciar novo atendimento.
- [ ] **Teste de Duplicação**: Simular 2 envios do mesmo webhook -> Apenas 1 registro deve ser salvo no banco.
- [ ] **Teste de Instância**: Cliente manda "5" para uma instância A enquanto tem uma conversa esperando avaliação na instância B -> Não deve capturar (se o contato for compartilhado).
- [ ] **Teste de Janela**: Cliente manda "5" após 25 horas do envio -> Deve iniciar novo atendimento.

