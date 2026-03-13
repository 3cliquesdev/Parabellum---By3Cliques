

# Fix: Excluir Recorrências do Time Comercial no Relatório Diário

## Problema Identificado
O relatório `ai-governor` está somando **recorrências (renovações)** nos números individuais dos vendedores. Isso acontece em 3 pontos:

1. **`repsMap` (linha 390-410)** — O loop que popula os deals por vendedor roda sobre `wonToday` (TODOS os deals won), incluindo recorrências. Deveria rodar apenas sobre `newSalesDeals`.

2. **`cats` classificação de canais (linha 390-422)** — A mesma iteração classifica ALL wonToday nas categorias (comercial, kiwify, parceiros), inflando "Time Comercial Interno" com recorrências que têm `assigned_to`.

3. **`wonMonthByRep` (linha 479-484)** — A query do mês busca TODOS os deals won com `assigned_to`, sem filtrar `is_returning_customer`. Resultado: acumulado do mês também soma recorrências.

## Correções

### 1. Separar iteração diária: canais e reps só de vendas novas
- Mudar o loop principal (linha 390) de `wonToday?.forEach` para `newSalesDeals.forEach` para popular `cats` e `repsMap`
- Manter `totalRevToday` calculado sobre **vendas novas** (já que recorrências têm seção separada)

### 2. Filtrar recorrências no acumulado mensal do time comercial
- Na query `wonMonthByRep` (linha 479-484), adicionar `.eq('is_returning_customer', false)` para excluir renovações

### 3. Ajustar `totalRevToday` 
- `totalRevToday` continuará sendo a soma de TODOS os deals (novas + recorrências) para o resumo geral
- Mas `cats` e `repsMap` refletirão apenas vendas novas
- O relatório já tem seções separadas para "Vendas Novas" e "Recorrências", então a separação fica coerente

## Resultado Esperado
- **Bloco "Time Comercial HOJE"**: apenas vendas novas por vendedor
- **Bloco "Time Comercial MÊS"**: apenas vendas novas por vendedor  
- **Bloco "Canais de Venda"**: apenas vendas novas
- **Bloco "Recorrências"**: separado, como já está

