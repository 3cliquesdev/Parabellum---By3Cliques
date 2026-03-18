

# Plano: Variáveis Clicáveis nos Templates de Ticket

## Problema
Os campos "Template de assunto" e "Template de descrição" são inputs de texto livre. Usuários leigos não sabem quais variáveis estão disponíveis nem a sintaxe `{{variavel}}`. Precisam de badges clicáveis (como já existe nos painéis de OTP e Fetch Order) para inserir variáveis com um clique.

## Solução

### 1. Criar componente `ClickableVariableBadge`
Reutilizar o padrão do `ReadOnlyVariableBadge` mas com comportamento de **inserção** em vez de apenas cópia:
- Ao clicar, insere `{{variavel}}` no campo ativo (assunto ou descrição)
- Fallback: copia para clipboard se nenhum campo estiver focado

### 2. Adicionar seção de variáveis disponíveis no painel de Ticket

Abaixo dos campos de template, mostrar badges clicáveis organizados em 2 grupos:

**Variáveis do Cliente (sistema)**:
- `{{customer_name}}` — Nome do cliente
- `{{customer_email}}` — Email do cliente
- `{{customer_phone}}` — Telefone do cliente

**Variáveis coletadas pela IA**:
- `{{issue_type}}` — Tipo do problema
- `{{subject}}` — Assunto identificado
- `{{order_id}}` — Número do pedido
- `{{pix_key}}` — Chave PIX
- `{{amount}}` — Valor solicitado
- `{{reason}}` — Motivo da devolução

### 3. Alterar `AIResponsePropertiesPanel.tsx`

No bloco de ticket (linhas 258-285):
- Substituir os `Input`/`Textarea` simples por versões que aceitam inserção de variável via ref
- Adicionar grid de badges clicáveis abaixo de cada campo
- Ao clicar um badge, o texto `{{variavel}}` é inserido na posição do cursor do campo correspondente
- Usar `useRef` para rastrear qual campo (assunto/descrição) está ativo

### 4. UX

- Badges com cores por categoria (azul = cliente, verde = coleta, roxo = pedido)
- Tooltip com descrição ao passar o mouse
- Feedback visual ao clicar (check icon temporário, igual ao `ReadOnlyVariableBadge`)
- Label "Clique para inserir" acima dos badges

