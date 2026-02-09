

# Melhorar UX do no de Condicao: campo selecionavel + opcoes claras

## Problema atual

O campo "Campo a verificar" no no de Condicao e um input de texto livre. O usuario precisa digitar manualmente o nome da variavel (ex: `email`, `name`), sem saber quais opcoes existem. Isso causa confusao e erros.

## Solucao

Transformar o campo "Campo a verificar" em um **Select dropdown** que lista automaticamente:

1. **Variaveis coletadas no fluxo** - detectadas dos nos anteriores (`save_as` de cada no ask_*)
2. **Campos padrao do contato** - `email`, `name`, `phone`, `cpf`
3. **Mensagem do usuario** - opcao para avaliar o texto da ultima mensagem (campo vazio = mensagem)
4. **Campo personalizado** - opcao "Outro" que permite digitar manualmente

## Alteracoes

### 1. `src/components/chat-flows/ChatFlowEditor.tsx`

**Substituir o Input por Select no campo "Campo a verificar"** (~linhas 544-551):

- Varrer todos os nos do fluxo para coletar os valores `save_as` existentes
- Montar lista de opcoes agrupadas:
  - **Variaveis do fluxo**: valores `save_as` encontrados nos nos (ex: email, name, phone, choice)
  - **Campos do contato**: email, name, phone, cpf (sempre disponiveis)
  - **Mensagem**: opcao especial para verificar o texto da mensagem do usuario
  - **Personalizado**: permite digitar um nome customizado
- Se o usuario escolher "custom", mostrar um Input abaixo para digitar o nome

Exemplo visual do dropdown:

```text
Variaveis do Fluxo
  - email (do no "Perguntar Email")
  - name (do no "Perguntar Nome")
Campos do Contato
  - email
  - phone  
  - name
  - cpf
Especial
  - Mensagem do usuario
  - Personalizado...
```

### 2. `src/components/chat-flows/nodes/ConditionNode.tsx`

Melhorar o subtitulo exibido no no para mostrar labels amigaveis:
- `email` → "Email"
- `name` → "Nome"
- `phone` → "Telefone"
- Campo vazio → "Mensagem do usuario"

### 3. Adicionar mais tipos de condicao

Adicionar opcoes uteis ao Select de "Tipo de condicao":
- **Nao tem dado** (`not_has_data`) - inverso do "Tem dado", facilita criar caminhos "se nao informou email"
- **Maior que** (`greater_than`) - util para valores numericos
- **Menor que** (`less_than`) - util para valores numericos

Atualizar o `conditionLabels` no ConditionNode para incluir os novos tipos.

### 4. Atualizar `process-chat-flow` (edge function)

Adicionar suporte ao novo tipo `not_has_data` na funcao de avaliacao de condicoes, que retorna `true` quando o campo esta vazio/nulo.

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero - valores existentes continuam funcionando |
| Fluxos existentes | Sem alteracao, `condition_field` aceita os mesmos valores |
| Motor de fluxos | Apenas adiciona `not_has_data` como tipo |
| UX | Melhoria significativa - usuarios veem opcoes claras |

