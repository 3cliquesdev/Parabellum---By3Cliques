
# Funil de Vendas vs Emails de Onboarding no Dashboard CS

## O que sera criado

Um novo widget **"Funil Vendas x Onboarding"** mostrando 3 etapas:

1. **Vendas Novas** - Total de deals no pipeline "CS - Novos Clientes" no periodo
2. **1o Email Entregue** - Quantas dessas vendas receberam o email de boas-vindas (com data/hora do envio)
3. **2o Email Aberto** - Quantas dessas vendas abriram o segundo email de acesso (com data/hora da abertura)

Visual: funil com barras progressivas (mesmo padrao do OnboardingFunnelWidget existente), com badge mostrando contagem e percentual de conversao entre etapas.

## Arquitetura

### 1. Novo Hook: `useCSOnboardingEmailFunnel`
**Arquivo**: `src/hooks/useCSOnboardingEmailFunnel.tsx`

Consulta em 3 passos:
- Busca deals do pipeline CS - Novos Clientes filtrados por data
- Cruza com `email_sends` pelo `contact_id` via `playbook_executions` para o 1o email (node `1769519399023`) - filtra por `sent_at IS NOT NULL`
- Cruza para o 2o email (node `1769521501433`) - filtra por `opened_at IS NOT NULL`

Retorna array com dados detalhados incluindo timestamps.

### 2. Novo Widget: `CSEmailFunnelWidget`
**Arquivo**: `src/components/widgets/CSEmailFunnelWidget.tsx`

- Card com 3 barras de funil (Vendas Novas → 1o Email Entregue → 2o Email Aberto)
- Percentual de conversao entre cada etapa
- Drop-off indicators entre etapas
- Resumo final com taxa de engajamento

### 3. Integracao no Dashboard
**Arquivo**: `src/components/analytics/AdvancedTab.tsx`

- Adicionar o widget na sub-tab "Onboarding", abaixo do `OnboardingFunnelWidget` existente

## Detalhes Tecnicos

### Query Strategy (via RPC ou queries encadeadas)
Para evitar fan-out excessivo, a query sera feita em 3 chamadas otimizadas:

```text
1. deals COUNT WHERE pipeline_id = 'CS - Novos Clientes' AND created_at in range
2. email_sends WHERE playbook_node_id = '1769519399023' AND sent_at IS NOT NULL
   JOIN playbook_executions ON contact_id
   JOIN deals ON contact_id AND pipeline_id
3. email_sends WHERE playbook_node_id = '1769521501433' AND opened_at IS NOT NULL
   (mesmo join pattern)
```

### Dados retornados
```typescript
interface CSEmailFunnelData {
  totalSales: number;
  firstEmailDelivered: number;
  firstEmailDeliveredRate: number;
  secondEmailOpened: number;
  secondEmailOpenedRate: number; // relativo ao total de vendas
}
```

### Impacto
- Zero regressao: apenas adiciona componentes novos
- Nao modifica nenhum widget existente
- Usa o mesmo padrao visual do `OnboardingFunnelWidget`
- Respeita os filtros globais de data do dashboard
