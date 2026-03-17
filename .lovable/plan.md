

# Adicionar Variáveis Clicáveis nos Campos de Assunto e Descrição do Ticket

## Problema
Campos de "Assunto" e "Descrição" na seção "Ação ao Sair" aceitam variáveis `{{campo}}`, mas o usuário comum não sabe quais variáveis usar nem como digitá-las.

## Solução
Adicionar badges clicáveis abaixo dos campos Assunto e Descrição — ao clicar, a variável é inserida automaticamente no campo. As variáveis disponíveis vêm dos **campos de coleta inteligente** ativados no mesmo nó + variáveis fixas do sistema (ex: `customer_name`, `customer_email`).

## Alterações

### `src/components/chat-flows/AIResponsePropertiesPanel.tsx`

1. **Definir lista de variáveis disponíveis** — combinar campos da coleta inteligente (`smart_collection_fields`) com variáveis fixas do sistema (`customer_name`, `customer_email`, `customer_phone`)

2. **Abaixo do campo Assunto** — renderizar badges clicáveis com as variáveis. Ao clicar, insere `{{variavel}}` no final do valor atual do campo assunto

3. **Abaixo do campo Descrição** — mesma lógica, inserindo no campo descrição

4. **Texto auxiliar** — "Clique para inserir a variável no campo acima"

5. **Visual** — usar o mesmo estilo de badge compacto, com `code` em mono e cor por categoria, similar ao `ReadOnlyVariableBadge` mas com ação de inserção em vez de copiar

### Comportamento
- Clicar no badge → appenda `{{variavel}}` ao campo correspondente (assunto ou descrição)
- Se não houver campos de coleta ativados, exibe apenas as variáveis fixas do sistema
- Badges ficam em `flex-wrap` compactos para não ocupar muito espaço

