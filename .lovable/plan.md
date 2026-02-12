

# Upgrade: Filtro de Periodo + Controle de Reenvio no Dashboard de Playbooks

## O que muda

### 1. Filtro de Periodo no Dashboard

Adicionar um `DatePickerWithRange` no topo do dashboard para filtrar todas as metricas (KPIs, evolucao, funil, performance table) por periodo.

**Componentes afetados:**
- `PlaybookMetricsDashboard.tsx`: Adicionar state de dateRange e passar para todos os hooks/charts
- `usePlaybookMetrics.tsx`: Aceitar dateRange e passar para as RPCs
- `useEmailTrackingEvents.tsx`: `useEmailFunnelData` e `useEmailEvolutionData` ja aceitam dateRange parcialmente, mas precisam funcionar de verdade
- `EmailEvolutionChart.tsx`: Receber dateRange como prop
- `EmailFunnelChart.tsx`: Receber dateRange como prop

**Migracao SQL:** Atualizar as 3 RPCs para aceitar parametros de data:
- `get_playbook_kpis(p_start timestamptz DEFAULT NULL, p_end timestamptz DEFAULT NULL)`
- `get_email_evolution(p_days int DEFAULT 7, p_start timestamptz DEFAULT NULL, p_end timestamptz DEFAULT NULL)`
- `get_playbook_performance(p_start timestamptz DEFAULT NULL, p_end timestamptz DEFAULT NULL)`

Quando os parametros sao NULL, retorna tudo (comportamento atual). Quando preenchidos, filtra por periodo.

### 2. Substituir "Processar Fila" por "Reenviar / Gerenciar"

O botao "Processar Fila Agora" e tecnico e nao ajuda o usuario. Substituir por opcoes mais uteis:

**Opcao A - Botao de Reenvio na tabela de Performance:**
Na tabela "Performance por Playbook", adicionar coluna "Acoes" com botao "Reenviar falhos" que re-enfileira execucoes com status `failed` daquele playbook.

**Opcao B - Melhorar a aba "Disparador em Massa":**
A aba ja existe e permite selecionar contatos + playbook. Tornar o botao principal mais claro e mover "Processar Fila" para um botao discreto (icone apenas) no header.

**Decisao:** Manter o botao "Processar Fila" como botao secundario (outline, menor) e adicionar um botao "Reenviar Falhos" na tabela de performance + na aba de execucoes (filtrar por falhos e reenviar).

### 3. Botao "Reenviar Falhos" 

Na aba "Execucoes", adicionar filtro rapido por status e botao para reenviar execucoes que falharam:
- Selecionar execucoes falhas
- Clicar "Reenviar Selecionados"
- Sistema cria novas execucoes para os mesmos contatos/playbooks

## Arquivos Modificados

### SQL Migration
```sql
-- Atualizar RPCs com filtro de periodo
CREATE OR REPLACE FUNCTION get_playbook_kpis(
  p_start timestamptz DEFAULT NULL, 
  p_end timestamptz DEFAULT NULL
) ...

CREATE OR REPLACE FUNCTION get_email_evolution(
  p_days int DEFAULT 7,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
) ...

CREATE OR REPLACE FUNCTION get_playbook_performance(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
) ...
```

### Frontend
1. **`PlaybookMetricsDashboard.tsx`**: Adicionar DatePickerWithRange no topo, estado local de dateRange, passar para hooks e charts
2. **`EmailEvolutionChart.tsx`**: Receber `dateRange` como prop e passar para `useEmailEvolutionData`
3. **`EmailFunnelChart.tsx`**: Receber `dateRange` como prop e passar para `useEmailFunnelData`
4. **`usePlaybookMetrics.tsx`**: Passar dateRange para RPCs `get_playbook_kpis` e `get_playbook_performance`
5. **`useEmailTrackingEvents.tsx`**: Passar dateRange para `useEmailFunnelData` e `useEmailEvolutionData` (ja recebem, ajustar para usar RPCs com parametros)
6. **`PlaybookPerformanceTable.tsx`**: Adicionar coluna "Acoes" com botao "Reenviar falhos"
7. **`PlaybookExecutions.tsx`**: Reduzir destaque do botao "Processar Fila" (outline), adicionar botao "Reenviar Falhos" na aba de execucoes

### Novo Hook
- **`useRetryFailedExecutions.tsx`**: Hook para re-enfileirar execucoes falhas (chama `execute-playbook` para cada contato selecionado)

## Resultado Visual

```text
+--------------------------------------------------+
| Monitoramento de Playbooks    [Processar Fila] (outline, discreto)
|                                                  
| [Dashboard] [Execucoes] [Disparador em Massa]   
|                                                  
| Periodo: [01/01/2026 - 12/02/2026]  [Limpar]    
|                                                  
| KPIs filtrados pelo periodo selecionado          
| Graficos filtrados pelo periodo selecionado      
|                                                  
| Performance por Playbook                         
| Playbook | Exec | Conclusao | ... | Acoes       
| Onboard  | 3848 | 1709/200  | ... | [Reenviar]  
+--------------------------------------------------+
```

## Impacto

- Zero regressao: sem dateRange, RPCs retornam tudo (mesmo comportamento atual)
- Upgrade puro: filtro de periodo + reenvio seletivo de falhos
- "Processar Fila" continua disponivel, apenas menos destacado
