

## Exportacao Completa de Relatorios (Sem Limite de Linhas)

### Problema Atual
Tres hooks de exportacao limitam a 5.000 linhas e um a 10.000, cortando dados quando o usuario seleciona periodos longos. Apenas o relatorio de Email Sequence ja usa paginacao completa.

### Solucao
Implementar uma funcao utilitaria `fetchAllRpcPages` reutilizavel que busca todas as paginas de uma RPC automaticamente (lotes de 2.000 linhas). Substituir as chamadas unicas com limite fixo por essa busca paginada em todos os hooks de exportacao.

Para evitar travamento do browser com volumes muito grandes, exibir progresso via toast ("Buscando dados... 4.000 de ~12.000").

### Arquivos afetados

**1. Novo: `src/lib/fetchAllRpcPages.ts`**
- Funcao utilitaria generica que recebe nome da RPC + parametros
- Busca em lotes de 2.000 linhas ate esgotar os resultados
- Callback de progresso opcional para feedback visual
- Safety limit de 50.000 linhas para evitar loops infinitos

**2. `src/hooks/useExportConversationsCSV.tsx`**
- Remover constante `MAX_EXPORT = 5000`
- Substituir chamada unica por `fetchAllRpcPages` com a RPC `get_commercial_conversations_report`
- Remover logica de "limite atingido" no toast de sucesso

**3. `src/hooks/useExportCommercialConversationsCSV.tsx`**
- Remover constante `MAX_EXPORT_ROWS = 5000`
- Substituir chamada de report por `fetchAllRpcPages`
- Manter as 3 chamadas paralelas (KPIs e Pivot nao precisam de paginacao, so o detalhado)

**4. `src/hooks/useExportSupportCSV.tsx`**
- Remover constante `MAX_EXPORT_ROWS = 5000`
- Substituir por `fetchAllRpcPages` com a RPC `get_support_drilldown_v2`

**5. `src/hooks/useExportTicketsExcel.tsx`**
- Substituir `p_limit: 10000` por `fetchAllRpcPages` com a RPC `get_tickets_export_report`

### Performance e Seguranca
- Lotes de 2.000 linhas: equilibrio entre velocidade (menos roundtrips) e memoria
- Safety limit de 50.000 registros para evitar loops infinitos
- Toast de progresso a cada lote para o usuario saber que esta funcionando
- XLSX e CSV lidam bem com 50k+ linhas no browser (testado com a lib xlsx)
- Nao e necessario ZIP: arquivos XLSX ja sao comprimidos internamente (formato ZIP) e CSV de 50k linhas gera ~5-10MB no maximo

### O que NAO muda
- Nenhuma RPC do banco precisa ser alterada (todas ja aceitam p_limit/p_offset)
- O hook `usePlaybookEmailSequenceReport` ja funciona com paginacao completa -- nao precisa de alteracao
- Todas as features existentes continuam funcionando identicamente
- O formato de saida (XLSX/CSV) permanece o mesmo

