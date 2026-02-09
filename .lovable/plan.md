
# Correcao: Consultores nao conseguem clicar nos dropdowns do dialog de ticket

## Problema

O `CreateTicketDialog` usa `modal={false}` combinado com `onInteractOutside={(e) => e.preventDefault()}`. Isso causa um conflito:

1. `modal={false}` faz o Dialog nao criar overlay nem trap de foco
2. Os `SelectContent` usam `position="popper"` que renderiza via portal fora do Dialog
3. O `onInteractOutside` bloqueia cliques em qualquer elemento fora do DialogContent -- incluindo os dropdowns que foram portalizados para o body

Resultado: o usuario ve os dropdowns mas nao consegue clicar nas opcoes.

## Solucao

**Arquivo**: `src/components/support/CreateTicketDialog.tsx`

Duas opcoes (vou implementar a mais segura):

**Mudar para `modal={true}`** (remover `modal={false}`) e remover o `onInteractOutside`. O comportamento padrao do Radix Dialog (modal) ja cria overlay e foco correto, e os SelectContent portalizados funcionam normalmente dentro do contexto modal.

Mudancas especificas:
- Linha 199: Remover `modal={false}` do Dialog
- Linha 202: Remover `onInteractOutside={(e) => e.preventDefault()}`

Isso corrige todos os dropdowns de uma vez (Prioridade, Categoria, Tags, Departamento, Atribuir a) sem precisar alterar cada um individualmente.

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero -- o dialog continua funcionando igual para todos os roles |
| Consultores | Podem clicar em todos os dropdowns |
| Outros roles | Sem mudanca de comportamento |
| UX | Dialog volta a ter overlay (comportamento padrao esperado) |
