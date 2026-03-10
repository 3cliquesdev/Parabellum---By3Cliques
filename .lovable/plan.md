
# Dar autonomia à IA no Master Flow de Produção ✅

## Status: IMPLEMENTADO

## Resumo

O nó `ia_entrada` do Master Flow foi atualizado para dar autonomia à IA.

## Alterações aplicadas

| Parâmetro | Antes | Depois |
|---|---|---|
| `forbid_questions` | `true` | `false` |
| `exit_keywords` | 13 (incluía "menu", "opcoes", "pessoa") | 9 (apenas intenções humanas explícitas) |
| `max_sentences` | `4` | `5` |
| `context_prompt` | "não inventar" | "RESOLVER antes de transferir, fazer perguntas, 2-3 tentativas" |
| `objective` | sem menção a perguntas | inclui "FAÇA PERGUNTAS ESCLARECEDORAS" |

## Travas mantidas

- `forbid_options: true` — IA não cria menus falsos
- `forbid_financial: true` — IA não resolve financeiro
- `forbid_commercial: true` — IA não faz vendas
- `fallback_message` — rede de segurança
- `flow_advance_needed` — funciona para casos extremos
