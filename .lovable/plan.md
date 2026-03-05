

# Plano: Remover item "Tags" do menu lateral

## O que muda

Remover a entrada `{ title: "Tags", href: "/settings/tags", icon: Tags, permission: "cadastros.view_tags" }` do menu lateral (sidebar), já que Tags agora é acessível dentro da página de Departamentos & Operações.

## Alteração

| Arquivo | O que |
|---|---|
| `src/config/routes.ts` | Remover linha 133 (item "Tags" do grupo "Cadastros") |

Se a importação `Tags` do lucide-react não for usada em nenhum outro lugar do mesmo arquivo, também será removida do import.

## Impacto

- Zero regressão: a rota `/settings/tags` continua existindo, apenas o link direto no sidebar é removido
- O acesso a Tags permanece via aba dentro de "Depart. & Operações"

