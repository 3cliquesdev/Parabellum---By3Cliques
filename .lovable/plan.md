

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico definitivo

A causa raiz NÃO é o scoring de headers. O problema é que **a planilha tem múltiplas abas** (sheets). A primeira aba é uma **tabela dinâmica (pivot table)** com headers como "Rótulos de Linha", "Contagem de Email", "Soma de ****". A aba com os dados reais (ID, Nome, Email, Telefone, Documento, etc.) está em outra posição.

O `readXlsxFile(file)` lê sempre a **primeira aba por padrão**. Por isso o scoring funciona corretamente (detecta a melhor linha daquela aba), mas os dados são da aba errada.

## Plano de correção

### 1. Adicionar detecção de abas no `CSVUploader.tsx`

- Usar `readSheetNames(file)` do `read-excel-file` para listar todas as abas do XLSX.
- Auto-selecionar a melhor aba usando scoring: a aba cujo melhor header row tem o maior score de `scoreHeaderRow` é a aba de dados.
- Usar `readXlsxFile(file, { sheet: sheetNumber })` para ler a aba correta.

### 2. Adicionar seletor manual de aba na UI (`CSVUploader.tsx`)

- Quando o arquivo tem mais de 1 aba, exibir um `Select` com os nomes das abas.
- Pré-selecionar a aba detectada automaticamente.
- Ao trocar de aba, re-parsear os dados da aba escolhida e atualizar headers + data.

### 3. Propagar informação de aba para `ImportClients.tsx`

- Mostrar na info de headers detectados qual aba está sendo usada (ex: "📋 Headers detectados (22) — aba 'Clientes' — linha 1 da planilha").

### Arquivos a editar
- `src/components/CSVUploader.tsx` — principal (readSheetNames + seletor + auto-detect)
- `src/pages/ImportClients.tsx` — exibir nome da aba detectada

### Impacto e segurança
- Sem regressão: arquivos com uma única aba continuam funcionando igual (sem seletor visível).
- Sem mudança em backend/edge functions.
- Rollback: reverter apenas `CSVUploader.tsx`.

