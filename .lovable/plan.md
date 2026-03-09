

# Melhorias no Relatório Diário (ai-governor)

## Problemas Identificados

### 1. "IA resolveu 0" — Bug na contagem
O relatório conta `closedAutopilot` filtrando `status === 'closed' && ai_mode === 'autopilot'`. O problema: quando o autopilot fecha a conversa, o `ai_mode` pode ser alterado depois (para `copilot`, `disabled`, etc.), então conversas efetivamente resolvidas pela IA não são contadas. Precisamos rastrear quem realmente fechou a conversa, não o modo atual.

**Solução**: Além do filtro atual, contar também conversas que foram fechadas e tiveram o último evento como ação da IA (ex: `close_conversation` nos `ai_events` ou `messages.is_ai_generated = true` na última mensagem antes do fechamento). Alternativa mais simples: verificar se existe um `ai_event` de tipo `close_conversation` para aquela conversa no período.

### 2. Separar melhor Vendas Novas vs Recorrências
O WhatsApp message atual mistura tudo junto. Vamos reorganizar:
```
💰 HOJE — Vendas Novas
Novas: 50 (R$ 2.8k)
  Orgânico: 31 (R$ 2.5k)
  Afiliados: 19 (R$ 287)
  Comercial: 0

🔄 HOJE — Recorrências  
Renovações: 93 (R$ 14.6k)

📊 Resumo: 143 fechamentos | R$ 17.3k
Perdidos: 0 | Novos deals: 166
```

### 3. Tags — "só tivemos essa TAG?"
O código já busca até 10 tags. Se só apareceu 1, é provável que só 1 tag foi aplicada no dia. Mas vamos verificar se o filtro `gte('created_at', since)` na tabela `conversation_tags` está correto — a tag pode ter sido criada antes da conversa do dia. **Solução**: Buscar tags via join com conversas do período (por `conversation_id` de conversas criadas no dia), não pela data de criação da tag.

### 4. Período — "É de 00h até 18h?"
Quando `force_today = true`, o período vai de 00:00 até a hora da execução. O relatório não mostra essa informação. **Solução**: Incluir o horário do período no header do relatório (ex: "📅 09/03/2026 (00:00 - 18:00)").

## Arquivos Alterados

### `supabase/functions/ai-governor/index.ts`

1. **collectDayMetrics**: 
   - Adicionar query nos `ai_events` para contar `event_type = 'ai_close_conversation'` ou similar no período, e usar como `closedByAutopilotReal`
   - Corrigir query de tags: buscar por `conversation_id` de conversas do período, não por `created_at` da tag

2. **Formatação WhatsApp** (linhas ~1227-1239):
   - Separar seção de vendas novas e recorrências com headers distintos
   - Adicionar emoji 🔄 para recorrências

3. **Header do relatório** (linhas ~1214-1216):
   - Incluir horário do período: "📞 HOJE — Atendimento (00:00 - 18:00)"

4. **Formatação HTML do email** (seção correspondente):
   - Mesmas melhorias de separação vendas/recorrências

