

# Fix: CHECK constraint `returns_reason_check` bloqueia inserção

## Causa Raiz
A tabela `returns` tem um CHECK constraint estático que só aceita 5 motivos antigos:
- `defeito`, `arrependimento`, `troca`, `nao_recebido`, `outro`

Porém, a tabela `return_reasons` (dinâmica) agora tem chaves diferentes:
- `defeito_no_produto`, `arrependimento_cliente_final`, `defeito_transporte`, `insucesso_de_entrega`, `envio_errado`

O dropdown do formulário usa as chaves dinâmicas da tabela `return_reasons`, mas o banco rejeita porque o CHECK constraint não reconhece esses valores.

Também há o mesmo problema potencial no `returns_status_check` (falta `archived`).

## Solução
Uma migração SQL para:
1. **Remover** `returns_reason_check` — a validação de motivos já é feita dinamicamente via `return_reasons` (tanto na edge function quanto no frontend)
2. **Remover** `returns_status_check` e recriá-lo incluindo `archived`

Zero alterações no frontend — o código já está correto.

