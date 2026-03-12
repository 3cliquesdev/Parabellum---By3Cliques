

# Problema Identificado no Relatório Diário

## O que esta errado

O relatório WhatsApp mostra **apenas** a seção "MES — Time Comercial" (dados acumulados do mes), mas **nao tem** uma seção "HOJE — Time Comercial" (dados do dia). O email HTML tem as duas seções (L855 `teamHtml` e L883 `teamMonthHtml`), mas o WhatsApp so tem `teamMonthSummary`.

Resultado: quando o usuario le "Fernanda: 374 deals | R$ 24.6k", pensa que e do dia, mas na verdade e do mes inteiro.

Os dados diarios ja existem em `salesMetrics.topReps` (L441-454) — so nao estao sendo formatados na mensagem WhatsApp.

## Plano de Correcao

**Arquivo**: `supabase/functions/ai-governor/index.ts`

### 1. Adicionar seção "HOJE — Time Comercial" na mensagem WhatsApp (L1323)

Antes do `teamMonthSummary`, criar um `teamTodaySummary` usando `salesMetrics.topReps` (dados do dia):

```
👥 *11/03/2026 — Time Comercial*
1. Fernanda: 12 deals | R$ 1.2k
2. Loriani: 8 deals | R$ 800
```

### 2. Reorganizar a mensagem final (L1335)

Mover o `fullMessage` para incluir `teamTodaySummary` ANTES dos dados mensais, mantendo a hierarquia:

```
HOJE — Atendimento
HOJE — Vendas Novas
HOJE — Recorrencias
HOJE — Resumo
HOJE — Pipeline
HOJE — Canais de Venda
HOJE — Time Comercial      ← NOVO (diario, dados absolutos)
HOJE — Tags
HOJE — Tickets
─────────────────
MES — Acumulado             ← complementar
MES — Time Comercial        ← complementar
```

### Resumo das Mudancas

- 1 seção nova no WhatsApp (`teamTodaySummary` com dados do dia)
- Reordenar `fullMessage` para daily-first, monthly-complementary
- Zero mudancas na logica de dados (os dados ja existem)

