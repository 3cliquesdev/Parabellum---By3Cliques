

# Template de importação em formato XLSX (Excel BR)

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Situação atual

O template já usa separador ponto-e-vírgula e BOM UTF-8, mas ainda é um `.csv`. Dependendo da versão do Excel, pode não separar as colunas corretamente ao abrir. A solução é gerar como **`.xlsx`** (Excel nativo), que o projeto já suporta via biblioteca `xlsx` instalada.

## Alteração

### `src/pages/ImportClients.tsx` — função `downloadTemplate`
- Substituir a geração de CSV por geração de `.xlsx` usando a biblioteca `xlsx`
- Criar uma planilha com os headers em português e uma linha de exemplo com formatação BR (datas dd/mm/aaaa, decimais com vírgula)
- Arquivo baixado: `template_importacao_clientes.xlsx`

Isso garante que o Excel BR abra o arquivo corretamente com todas as colunas separadas e caracteres especiais preservados.

Upgrade puro — sem impacto no upload (que já aceita `.xlsx`).

