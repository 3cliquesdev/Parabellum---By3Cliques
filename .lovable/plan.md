

# Melhorar Labels do Dropdown "Salvar como variável"

## Problema
Os nomes das variáveis no dropdown são técnicos (ex: `choice`, `response`, `full_name`) — um usuário leigo não entende o que significam.

## Solução
Trocar os labels para descrições em português claro, mantendo o valor técnico visível mas secundário.

### Mudança no `ChatFlowEditor.tsx` — `SAVE_AS_SUGGESTIONS`

De:
```
{ value: "choice", label: "choice (padrão)" }
```

Para:
```
{ value: "choice", label: "Escolha do usuário" }
```

**Mapeamento completo:**

| Nó | Valor | Label atual | Label novo |
|---|---|---|---|
| ask_name | `name` | `name (padrão)` | `Nome do contato` |
| ask_name | `full_name` | `full_name` | `Nome completo` |
| ask_name | `customer_name` | `customer_name` | `Nome do cliente` |
| ask_email | `email` | `email (padrão)` | `E-mail do contato` |
| ask_email | `customer_email` | `customer_email` | `E-mail do cliente` |
| ask_phone | `phone` | `phone (padrão)` | `Telefone do contato` |
| ask_phone | `customer_phone` | `customer_phone` | `Telefone do cliente` |
| ask_cpf | `cpf` | `cpf (padrão)` | `CPF do contato` |
| ask_cpf | `document` | `document` | `Documento (genérico)` |
| ask_text | `response` | `response (padrão)` | `Resposta do usuário` |
| ask_text | `feedback` | `feedback` | `Feedback / Opinião` |
| ask_text | `description` | `description` | `Descrição / Detalhes` |
| ask_options | `choice` | `choice (padrão)` | `Escolha do usuário` |
| ask_options | `option_selected` | `option_selected` | `Opção selecionada` |
| ask_options | `menu_choice` | `menu_choice` | `Escolha do menu` |

Também adicionar no `SelectItem` o valor técnico em fonte menor para contexto:
```
💾 Escolha do usuário (choice)
```

E incluir label explicativo acima do Select:
```
Salvar resposta como — A resposta será guardada nesta variável para uso em nós seguintes.
```

### Arquivo alterado
- `src/components/chat-flows/ChatFlowEditor.tsx` — labels do `SAVE_AS_SUGGESTIONS` + helper text

