

# Deep-link para TAB de Vendas no Dashboard

## Resumo
Permitir que `/?tab=sales` ou `/?tab=vendas` abra o Dashboard na aba correta, com fallback seguro.

## Alteracoes

### 1. `src/pages/Dashboard.tsx` (~5 linhas novas)

- Ler `searchParams.get("tab")` (o hook `useSearchParams` ja esta importado na linha 2).
- Criar mapa de alias (`vendas` -> `sales`) e lista de tabs validas.
- Resolver `initialTab` respeitando role: so aplica o deep-link se o usuario NAO for `sales_rep` (que ve o dashboard pessoal e nao tem tabs).
- Trocar `<Tabs defaultValue="overview">` por `<Tabs defaultValue={initialTab}>`.

```typescript
// Apos linha 38 (const view = ...)
const tabParam = searchParams.get("tab");
const TAB_ALIAS: Record<string, string> = { vendas: "sales" };
const VALID_TABS = ["overview", "sales", "support", "financial", "operations"];
const resolvedTab = TAB_ALIAS[tabParam || ""] || tabParam || "";
const initialTab = VALID_TABS.includes(resolvedTab) ? resolvedTab : "overview";

// Linha ~130: trocar defaultValue
// DE:  <Tabs defaultValue="overview" className="w-full">
// PARA: <Tabs defaultValue={initialTab} className="w-full">
```

Nota: nao precisa checar role aqui porque o bloco `if (role === "sales_rep")` retorna antes de chegar ao `<Tabs>`. Quem chega nas tabs ja e admin/manager.

### 2. `src/pages/Analytics.tsx` (~4 linhas novas)

- Importar `Link` de `react-router-dom`.
- Adicionar link discreto no header, ao lado do subtitulo, apontando para `/?tab=vendas`.

```typescript
import { Link } from "react-router-dom";

// No bloco do header, apos o <p> de subtitulo:
<Link
  to="/?tab=vendas"
  className="text-xs text-primary hover:underline mt-1 inline-block"
>
  Ver Dashboard de Vendas (Sistema)
</Link>
```

## O que NAO muda

- Nenhuma tabela, RLS, migration ou rota nova.
- Layout, componentes e permissoes intactos.
- `sales_rep` continua vendo dashboard pessoal (retorna antes das tabs).
- Parametro invalido (`?tab=xyz`) cai em `"overview"` silenciosamente.

## Matriz de testes

| URL | Resultado esperado |
|-----|--------------------|
| `/` | Tab "overview" (padrao) |
| `/?tab=sales` | Tab "Vendas" ativa |
| `/?tab=vendas` | Tab "Vendas" ativa (alias) |
| `/?tab=support` | Tab "Suporte" ativa |
| `/?tab=xyz` | Fallback para "overview" |
| `/?tab=sales` como sales_rep | Dashboard pessoal (ignora param) |

