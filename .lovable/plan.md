
# Correção dos 5 registros de email_sends

## Dados confirmados

Os 5 registros sem `template_id` foram confirmados via query:

| ID | Subject | template_id atual |
|---|---|---|
| c811c272-... | (Teste) Feedback sobre o cancelamento... | NULL |
| 8c26d805-... | (Teste) Feedback sobre o cancelamento... | NULL |
| fb1d226f-... | (Teste) Feedback sobre o cancelamento... | NULL |
| 3f7736a1-... | (Teste) Feedback sobre o cancelamento... | NULL |
| 9a405753-... | (Teste) Feedback sobre o cancelamento... | NULL |

## Correção

Criar uma Edge Function temporária (`fix-email-sends-template`) que executa um UPDATE nos 5 registros, setando `template_id = 'a3bd24d3-1ee0-47de-baf2-ff323d397eb0'`.

Após execução e confirmação, a function será removida.

## Impacto

- Zero regressão: apenas atualiza 5 registros específicos por ID
- Métricas do template "Cancelamento de assinatura" passarão a mostrar 5 envios corretamente
- Nenhuma tabela ou schema alterado
