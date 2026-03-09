

# Fix: Relatório Diário — Clareza HOJE vs MÊS + Contagem Real de Eventos IA

## Problemas Identificados

1. **`totalAIEvents` mostra "500" porque tem `.limit(500)`** na query (linha 47) — não é o total real, é o cap do fetch. Precisa usar `count: 'exact'` separado.
2. **Mensagens (4460) e Eventos IA (500) não ficam claros se são do DIA** — falta rótulo explícito "HOJE".
3. **Vendas fechadas hoje (175) não está destacada** no WhatsApp — aparece só nos canais.
4. **Seções misturam HOJE e MÊS sem separação clara**.

## Mudanças — `supabase/functions/ai-governor/index.ts`

### 1. Fix contagem real de ai_events (linha 41-49)
Adicionar query `count: 'exact', head: true` para obter o número real de eventos IA no dia, sem o `.limit(500)`.

```typescript
// Contagem REAL de eventos IA no dia
const { count: totalAIEventsCount } = await supabase
  .from('ai_events')
  .select('id', { count: 'exact', head: true })
  .gte('created_at', since)
  .lt('created_at', until);
```

Manter o fetch com limit(500) apenas para análise de intents/tipos, mas usar `totalAIEventsCount` para exibição.

### 2. Reestruturar WhatsApp com seções HOJE e MÊS claras (linha ~1006)
Reformatar `fullMessage` com separadores explícitos:

```
📞 *HOJE — Atendimento*
Conversas: 280 | IA resolveu: 2 | Escaladas: 107
Tempo médio: 42 min
Eventos IA: 1523 | Msgs: 4460 (416 da IA)

💰 *HOJE — Vendas*
Fechamentos: 175 | Receita: R$ 42.3k
Perdidos: 12 | Novos deals: 46

📥 *HOJE — Pipeline*
Kiwify: 23 | Outro: 17 | Formulário: 6
Total: 46 leads entraram

📊 *MÊS — Acumulado*
Receita: R$ 109k | Meta: 18%
Deals won: 421 | MoM: +34%

👥 *MÊS — Time Comercial*
1. Thaynara: 1 deal | R$ 0
2. Fernanda: 20 deals | R$ 0
```

### 3. Atualizar prompt da IA para distinguir HOJE vs MÊS
Reorganizar dados no prompt com headers `=== HOJE ===` e `=== MÊS ===` para que a análise também separe corretamente.

### 4. Email HTML — mesma separação
Adicionar subtítulos "(Hoje)" e "(Mês)" nas seções do email.

## Impacto
- Zero regressão — dados existentes mantidos, apenas reorganizados
- Contagem real de eventos IA em vez de cap artificial de 500
- Relatório fica imediatamente claro: o que é do DIA vs acumulado

