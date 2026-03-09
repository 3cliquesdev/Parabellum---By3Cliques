

# Fix: Dados Reais no Relatório — Vendas Separadas + Atendimento Detalhado

## Problema 1: Vendas (177 vs 80 da Kiwify)

Dados reais de hoje confirmam:
- 120 deals são `kiwify_recorrencia` (renovações automáticas) = R$ 19.1k
- 59 deals são vendas novas = R$ 2.7k
- Total: 179 deals, mas a Kiwify mostra 80 transações reais

O relatório junta tudo como "Fechamentos: 177" — isso é enganoso. Recorrências não são vendas novas.

**Solução**: Separar no `collectSalesMetrics`:
- **Vendas novas** (`is_returning_customer = false`): count + receita
- **Recorrências** (`is_returning_customer = true`): count + receita
- WhatsApp mostra: `Vendas novas: 59 (R$ 2.7k) | Recorrencias: 120 (R$ 19.1k)`

## Problema 2: Atendimento vago

Hoje: 172 closed/disabled, 77 closed/copilot, 32 open/copilot, 16 open/autopilot, 7 waiting_human, 2 closed/autopilot. O relatório só mostra "Conversas: 298 | IA resolveu: 2".

**Solução**: Expandir `collectDayMetrics` e o template WhatsApp:

```
HOJE — Atendimento
Conversas: 298 (WhatsApp 298)
Abertas agora: 55 | Fechadas: 251 | Fila humana: 7
IA autopilot: resolveu 2, ativas 16
Copilot: 109 | Desabilitado: 172
Tempo medio: 44 min
Eventos IA: 538 | Msgs: 4696 (442 da IA)
CSAT hoje: 4.2/5 (12 avaliacoes)
```

Dados adicionais a coletar:
- `satisfaction_ratings` do dia → avg rating + count
- Conversas por status (open/closed) e por ai_mode
- Conversas por channel

## Mudanças — `supabase/functions/ai-governor/index.ts`

### 1. `collectDayMetrics` — adicionar breakdown
- Conversas abertas vs fechadas (já temos `closedTotal`, adicionar `openTotal`)
- Por channel (já temos `activeChannels`, adicionar contagem por canal)
- CSAT: query `satisfaction_ratings` do dia → avg + count
- Agentes ativos: contar distinct `assigned_to` do dia

### 2. `collectSalesMetrics` — separar novas vs recorrências
- `wonToday` → split por `is_returning_customer`:
  - `newSalesToday` (count + revenue) 
  - `recurrenceToday` (count + revenue)
- Manter `wonToday` total para compatibilidade

### 3. WhatsApp template — reescrever seções
- **HOJE — Vendas**: `Vendas novas: X (R$ Yk) | Recorrencias: Z (R$ Wk)`
- **HOJE — Atendimento**: breakdown completo com abertas/fechadas/fila/CSAT/modos IA

### 4. Prompt da IA — atualizar dados
- Passar vendas novas vs recorrências separadamente
- Passar breakdown de atendimento para análise mais precisa

### 5. Email HTML — mesma separação

## Impacto
- Zero regressão — dados existentes mantidos, apenas enriquecidos
- Relatório passa a refletir realidade operacional
- IA consegue diagnosticar com dados granulares

