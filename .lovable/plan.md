

## Plano: Ticket pelo Nó (não pela IA) + Variáveis de Coleta no Dropdown

### Situação Atual

1. **Quem cria o ticket?** O **nó "Criar Ticket"** (bloco rosa no editor) cria o ticket — NÃO a IA. O nó já existe na paleta lateral (seção Ações → "Ticket"). Basta arrastá-lo para o canvas e conectar após o nó de IA. Quando o fluxo passa por ele, o motor backend cria o ticket automaticamente.

2. **Campos de coleta estão OK** — PIX, Banco, Motivo, Valor já foram adicionados ao nó de IA (Coleta Inteligente). Funcionam.

3. **Variáveis de coleta NÃO aparecem no dropdown** — Quando o usuário clica no botão `{x}` no nó de Ticket, as variáveis `pix_key`, `bank`, `reason`, `amount` etc. não estão no catálogo. O usuário não sabe que pode usar `{{pix_key}}`.

4. **Botão `{x}` existe** mas precisa ser testado para garantir que funciona.

### O que será feito

#### 1. Adicionar grupo "Coleta Inteligente" ao catálogo de variáveis
**Arquivo:** `src/components/chat-flows/variableCatalog.ts`
- Adicionar novo array `COLLECTION_VARS` com as 9 variáveis de coleta: `name`, `email`, `phone`, `cpf`, `address`, `pix_key`, `bank`, `reason`, `amount`
- Grupo: `"flow"` (são dados coletados durante o fluxo)
- Incluir no retorno de `getAvailableVariables()` sempre (são variáveis potenciais)

#### 2. Adicionar grupo visual "Coleta" no dropdown
**Arquivo:** `src/components/chat-flows/VariableAutocomplete.tsx`
- Adicionar entrada `collection` no `GROUP_LABELS`: `{ label: "Dados Coletados", icon: "📋" }`
- Renderizar o grupo no dropdown junto com os outros

### Resultado final
Quando o usuário clicar `{x}` no campo "Assunto" ou "Descrição" do nó de Ticket, verá:
- 📋 **Dados Coletados**: `{{name}}`, `{{email}}`, `{{pix_key}}`, `{{bank}}`, `{{reason}}`, `{{amount}}` etc.
- 👤 **Contato**: `{{contact_name}}`, `{{contact_email}}` etc.
- 📡 **Conversa**: `{{conversation_channel}}` etc.

### Arquivos alterados
1. `src/components/chat-flows/variableCatalog.ts` — novo array + integração
2. `src/components/chat-flows/VariableAutocomplete.tsx` — novo grupo visual

