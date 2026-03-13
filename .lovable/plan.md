

## Duas Demandas

### 1. Campos de coleta para Saque/Reembolso

O formulário de saque precisa coletar: Nome, Email de assinatura, Contato, Chave PIX, Banco, Motivo, Valor.

Atualmente, a **Coleta Inteligente** (SmartCollectionSection) no nó de IA só tem 5 campos: Nome, Email, Telefone, CPF, Endereço. Faltam: **Chave PIX, Banco, Motivo, Valor**.

**Onde configurar:** No nó de **Resposta da IA** que fica no ramo de Saque, ativar "Pedir Dados do Cliente" e selecionar os campos necessários. A IA pedirá um por vez durante a conversa.

**Alteração:** Adicionar os campos faltantes ao `COLLECTION_FIELDS` em `SmartCollectionSection.tsx`:

- `pix_key` — Chave PIX (ícone: Key)
- `bank` — Banco (ícone: Building2)
- `reason` — Motivo (ícone: MessageSquare)
- `amount` — Valor (ícone: DollarSign)

Arquivo: `src/components/chat-flows/panels/SmartCollectionSection.tsx`

### 2. Variáveis selecionáveis via dropdown (já existe!)

O componente `VariableAutocomplete` **já oferece um dropdown** com todas as variáveis disponíveis. Basta digitar `{{` no campo de texto e o dropdown aparece automaticamente com as variáveis agrupadas (Fluxo, Contato, Conversa, Pedido).

**Problema de UX:** O usuário não sabe que precisa digitar `{{`. 

**Melhoria:** Adicionar um **botão `{x}` visível** ao lado de cada textarea do `VariableAutocomplete` que, ao clicar, insere `{{` no cursor e abre o dropdown automaticamente. Isso torna a funcionalidade descobrível sem precisar saber a sintaxe.

**Alteração:** Em `VariableAutocomplete.tsx`, adicionar um botão com ícone `{x}` que ao clicar:
1. Insere `{{` na posição do cursor
2. Abre o dropdown de variáveis

### Resumo dos arquivos alterados:
1. **`SmartCollectionSection.tsx`** — Adicionar 4 novos campos de coleta (pix_key, bank, reason, amount)
2. **`VariableAutocomplete.tsx`** — Adicionar botão visual para abrir dropdown de variáveis sem precisar digitar `{{`

