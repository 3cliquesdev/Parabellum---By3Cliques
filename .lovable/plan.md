

# Adicionar "Devoluções" no menu Cadastros

A rota `/returns` já existe e renderiza `ReturnsManagement`, mas não há item de menu para ela. Basta adicionar ao grupo "Cadastros" em `src/config/routes.ts`.

## Mudança

### `src/config/routes.ts`
- Importar `RotateCcw` do lucide-react
- Adicionar no grupo "Cadastros":
```typescript
{ title: "Devoluções", href: "/returns", icon: RotateCcw, permission: "cadastros.view_returns" }
```

Como a rota já usa `requiredPermission: "tickets.view"`, vou usar a mesma permission `"tickets.view"` para o menu (ou criar `cadastros.view_returns` se preferir separar). Usarei `"tickets.view"` para manter consistência com a rota existente.

