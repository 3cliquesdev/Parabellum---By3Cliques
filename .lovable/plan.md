

# Funil de Onboarding como Grafico de Barras Horizontais

## O que muda

1. **Substituir os 5 cards** (CompactMetricsGrid "Funil de Onboarding") por um grafico de barras horizontais no mesmo estilo do "Funil de Conversao" existente
2. **Corrigir o "Funil de Conversao"** que mostra 2132 emails (todos os emails de todos os nodes) — deve mostrar apenas os dados do 1o email do onboarding, incluindo "Vendas Novas" como primeira barra

## Resultado Visual

O grafico tera 5 barras horizontais:

```text
Vendas Novas  ██████████████████████████████  431
Enviados      ██████████████████████████████  431
Entregues     ██████████████████████████████  431
Abertos       ████████████████████           285
Clicados      ████████████                   137
```

## Mudancas Tecnicas

### 1. `PlaybookMetricsDashboard.tsx`

- Remover a secao CompactMetricsGrid do funil (linhas 52-112)
- Alterar o card "Funil de Conversao" para usar os dados de `metrics.firstEmailFunnel` diretamente em vez do componente `EmailFunnelChart` que busca todos os emails
- Renderizar um BarChart horizontal inline com os 5 estágios (Vendas Novas, Enviados, Entregues, Abertos, Clicados)
- Titulo do card: "Funil de Onboarding — 1o Email"
- Subtitulo: "Vendas novas -> enviado -> entregue -> aberto -> clicado"

### 2. Nenhuma mudanca no hook

Os dados de `firstEmailFunnel` ja existem em `usePlaybookMetrics` e estao corretos. So precisamos usa-los no lugar certo.

## Arquivos Modificados

1. `src/components/playbooks/PlaybookMetricsDashboard.tsx` — Trocar cards por grafico de barras horizontais com dados do 1o email

## Zero Regressao

- KPIs gerais (Taxa de Entrega, Abertura, Cliques, Conclusao) permanecem inalterados
- Tabela de performance e grafico de evolucao nao mudam
- Dados vem do mesmo hook, apenas a visualizacao muda
