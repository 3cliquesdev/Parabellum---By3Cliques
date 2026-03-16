

# Adicionar % de Comissão por Afiliado no Widget Top Afiliados

## Dados Disponíveis

Sim! O payload da Kiwify já traz o valor da comissão do afiliado em `Commissions.commissioned_stores[type='affiliate'].value` e o preço base em `Commissions.product_base_price`. A % pode ser calculada: `(comissão / preço_base) * 100`.

## Alterações

### 1. `src/hooks/useKiwifyFinancials.tsx`
- Adicionar `totalGrossRevenue` ao acumulado por afiliado para poder calcular a %
- Atualizar interface `topAffiliates` para incluir `commissionPercent: number`
- Calcular: `(totalCommission / totalGrossRevenue) * 100`

### 2. `src/components/widgets/TopAffiliatesWidget.tsx`
- Adicionar coluna **"% Comissão"** na tabela
- Adicionar coluna **"% Vendas"** (participação no total) — pedido anterior
- Atualizar `colSpan` de 4 para 6

## Resultado

| Afiliado | Email | Vendas | % Vendas | % Comissão | Comissão Total |
|----------|-------|--------|----------|------------|----------------|
| João     | j@... | 15     | 45.5%    | 20%        | R$ 3.000       |
| Maria    | m@... | 10     | 30.3%    | 15%        | R$ 1.500       |

