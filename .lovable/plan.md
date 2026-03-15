

# Adicionar "Motivos de Devolução" ao menu lateral

## Problema
A página `/settings/return-reasons` existe e funciona, mas só é acessível via card dentro de `/settings`. Não há entrada no menu lateral (sidebar), tornando difícil de encontrar.

## Solução
Adicionar um item de menu no grupo **Cadastros** do `src/config/routes.ts`, logo abaixo de "Devoluções":

```
{ title: "Motivos de Devolução", href: "/settings/return-reasons", icon: ClipboardList, permission: "settings.view" }
```

Também atualizar o `routeLabels` no `Layout.tsx` para o breadcrumb funcionar corretamente:

```
"/settings/return-reasons": "Motivos de Devolução"
```

## Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `src/config/routes.ts` | Novo item no grupo "Cadastros" |
| `src/components/Layout.tsx` | Adicionar label no breadcrumb |

