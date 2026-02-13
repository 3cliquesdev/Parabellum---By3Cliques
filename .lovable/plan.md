

# KPIs do Funil de Onboarding: Vendas Novas ate Cliques no 1o Email

## Resumo

Adicionar uma nova secao de KPIs no Dashboard de Playbooks mostrando o funil completo de onboarding:

**Vendas Novas** (execucoes do playbook no periodo) → **1o Email Enviado** → **Entregues** → **Abertos** → **Clicados**

Dados extraidos da tabela `email_sends` filtrando pelo `playbook_node_id = '1769519399023'` (primeiro email do Onboarding - Assinaturas) e `playbook_executions` para contagem de vendas novas.

## Mudancas

### 1. Hook `usePlaybookMetrics.tsx`

Adicionar queries para o primeiro email do onboarding dentro do `queryFn` existente:

- **Vendas Novas**: `COUNT(*)` de `playbook_executions` do playbook "Onboarding - Assinaturas" (`7fd27c52-40f1-455f-8c29-890ed444defa`) no periodo
- **1o Email Enviado**: `COUNT(*)` de `email_sends` com `playbook_node_id = '1769519399023'` e `sent_at IS NOT NULL`
- **Entregues**: Mesma query + `bounced_at IS NULL`
- **Abertos**: Mesma query + `opened_at IS NOT NULL`
- **Clicados**: Mesma query + `clicked_at IS NOT NULL`

Todas as queries respeitam o filtro de `dateRange` quando informado.

Novo campo no retorno:
```
firstEmailFunnel: {
  newSales: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}
```

### 2. Dashboard `PlaybookMetricsDashboard.tsx`

Adicionar uma nova linha de 5 cards ACIMA dos KPIs gerais existentes, com titulo "Funil de Onboarding (1o Email)":

```
+-------------+-------------+-------------+-------------+-------------+
| Vendas      | 1o Email    | Entregues   | Abertos     | Clicados    |
| Novas       | Enviado     |             |             |             |
| 431         | 525         | 525 (100%)  | 264 (50.3%) | 142 (27%)   |
+-------------+-------------+-------------+-------------+-------------+
```

Cada card mostra:
- Valor absoluto em destaque
- Subtitulo com taxa relativa (ex: "100% dos enviados")
- Icone diferenciado

## Arquivos Modificados

1. `src/hooks/usePlaybookMetrics.tsx` — Adicionar queries do funil do primeiro email
2. `src/components/playbooks/PlaybookMetricsDashboard.tsx` — Nova linha de 5 KPI cards

## Zero Regressao

- KPIs existentes (taxa de entrega geral, abertura, cliques, conclusao) continuam inalterados
- Graficos e tabela de performance nao mudam
- Novas queries sao paralelas e independentes das existentes
