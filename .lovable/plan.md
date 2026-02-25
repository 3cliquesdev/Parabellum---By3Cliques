

# Plano: Garantir que aba "Detalhado" sempre seja exportada no Excel

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

O Excel só inclui a aba "Detalhado" quando há dados (`detailedData.length > 0`). Se o período não retorna dados detalhados, o Excel baixa apenas com a aba "Resumo Diário" — o usuário não vê a aba "Detalhado".

Além disso, o botão "Exportar Excel" fica desabilitado quando `dailyData.length === 0`, mesmo que haja dados detalhados.

## Mudanças

### 1. `src/hooks/useExportFormLeadsExcel.tsx`

- Sempre criar a aba "Detalhado" no Excel, mesmo quando vazia (com header mas sem linhas), para o usuário saber que a aba existe
- Se houver dados, preenche normalmente

### 2. `src/pages/FormLeadsConversionReport.tsx`

- Ajustar a condição `disabled` do botão para também considerar `detailedData.length > 0`:
  - `disabled={isLoading || (dailyData.length === 0 && detailedData.length === 0)}`

## Impacto

- Zero regressão: aba "Resumo Diário" continua idêntica
- Apenas melhoria: aba "Detalhado" sempre presente no Excel exportado

