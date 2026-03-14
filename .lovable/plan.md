

## Plano: Renomear "Sobre a Empresa" → "Sobre a Empresa e Serviços"

### Locais afetados

| Local | Ação |
|---|---|
| `knowledge_articles` (banco) | UPDATE category em todos os artigos |
| `chat_flows` flow_definition (banco) | Substituir no JSON de kb_categories do Fluxo V4 |

### O que será feito

1. **Artigos**: `UPDATE knowledge_articles SET category = 'Sobre a Empresa e Serviços' WHERE category = 'Sobre a Empresa'`
2. **Fluxo V4**: Substituir `"Sobre a Empresa"` por `"Sobre a Empresa e Serviços"` no JSON do `flow_definition`

Nenhuma alteração de código — tudo dinâmico via banco.

