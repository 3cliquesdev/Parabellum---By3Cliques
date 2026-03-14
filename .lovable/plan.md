

## Plano: Renomear "Dúvidas Gerais" → "FAQ e Dúvidas Frequentes"

Faz sentido sim — "FAQ e Dúvidas Frequentes" é mais descritivo e alinhado com o que os clientes esperam encontrar.

### Locais afetados

| Local | Itens | Ação |
|---|---|---|
| `knowledge_articles` (banco) | 3 artigos | UPDATE category |
| `chat_flows` flow_definition (banco) | Fluxo V4 — nós 4, 14 | Substituir no JSON de kb_categories |

### O que será feito

1. **Artigos**: `UPDATE knowledge_articles SET category = 'FAQ e Dúvidas Frequentes' WHERE category = 'Dúvidas Gerais'`
2. **Fluxo V4**: Substituir `"Dúvidas Gerais"` por `"FAQ e Dúvidas Frequentes"` no JSON do `flow_definition`

Nenhuma alteração de código — tudo dinâmico via banco.

