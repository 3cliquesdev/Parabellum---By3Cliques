

## Plano: Template com categorias padronizadas + validação na importação

### O que muda

**1. Template CSV com categorias atuais do banco**
- Atualizar `KnowledgeTemplateDownload.tsx` para incluir uma aba/seção com as 15 categorias padronizadas reais (buscadas do banco via `useKnowledgeCategories`)
- O CSV template terá exemplos usando as categorias reais
- Adicionar um botão extra para baixar a lista de categorias válidas como referência

**2. Validação de categoria na importação CSV**
- Em `KnowledgeImport.tsx`, após o mapeamento de colunas e antes de importar:
  - Buscar as categorias válidas do banco (`useKnowledgeCategories`)
  - Verificar cada linha: se a coluna `categoria` está mapeada, checar se o valor existe nas categorias padronizadas
  - Linhas com categorias inválidas: bloquear a importação e mostrar um alerta listando as categorias inválidas encontradas com sugestão das categorias válidas
- O botão "Importar" fica desabilitado enquanto houver categorias inválidas

### Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `src/components/knowledge/KnowledgeTemplateDownload.tsx` | Usar `useKnowledgeCategories()` para gerar template dinâmico com categorias reais; atualizar `TEMPLATE_CSV` e lista de categorias |
| `src/pages/KnowledgeImport.tsx` | Adicionar validação pré-importação: extrair categorias únicas dos dados, comparar com `useKnowledgeCategories`, exibir erro se houver categorias fora da lista |

### Fluxo do usuário
1. Baixa template → já vem com as 15 categorias corretas como exemplo
2. Preenche planilha usando apenas categorias válidas
3. Sobe o arquivo → sistema valida
4. Se tiver categoria fora do padrão → mostra alerta com as inválidas e a lista de válidas → bloqueia importação
5. Se tudo ok → importa normalmente

