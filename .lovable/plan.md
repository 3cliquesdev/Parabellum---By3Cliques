

# Plano de Melhorias Visuais — 6 Prompts

## PROMPT 1 — Login: Typo + Ícone

**Arquivo**: `src/pages/Auth.tsx`
- Corrigir L132: `"Bem-vindo de ao Q.G"` → `"Bem-vindo ao Q.G"`
- Adicionar ícone `Target` do Lucide ao lado do texto "PARABELLUM" na coluna esquerda (brand area), ambos em azul primário. Substituir/complementar a logo com um header `Target + PARABELLUM` estilizado.

## PROMPT 2 — Dashboard: Cards com borda e ícone

**Arquivo**: `src/components/dashboard/OverviewDashboardTab.tsx`
- Envolver cada seção (Vendas, Suporte, Financeiro, Operacional) em `Card` com classes `border border-gray-100 rounded-xl shadow-sm p-4`
- Mover o ícone colorido da seção para o canto superior direito do card wrapper
- No `KPICard` (`src/components/widgets/KPICard.tsx`), o valor já é `text-2xl font-semibold` — mudar para `text-2xl font-bold`

## PROMPT 3 — Sidebar: Separadores e item ativo

**Arquivo**: `src/components/AppSidebar.tsx`
- No `SidebarGroupLabel` (L360): adicionar classes `uppercase tracking-widest text-xs text-gray-400 pt-4`
- Adicionar `Separator` (ou `border-t`) acima de cada grupo (exceto o primeiro)
- No `renderMenuItem` (L276): mudar `activeClassName` para usar `bg-primary/15 text-primary font-medium border-l-[3px] border-primary`

## PROMPT 4 — Header: Breadcrumb + Busca global

**Arquivo**: `src/components/Layout.tsx`
- Após o `SidebarTrigger`, adicionar breadcrumb simples baseado em `location.pathname` (mapeamento de rotas para labels em português)
- Adicionar campo de busca centralizado com ícone `Search` e placeholder "Buscar..."
- Manter `NotificationBell` à direita

## PROMPT 5 — Organizações: Avatares com iniciais

**Arquivo**: `src/pages/Organizations.tsx`
- Substituir o bloco `Building2` icon (L92-94) por um `Avatar` com `AvatarFallback` contendo as iniciais da empresa (ex: "ST" para "Saint Tropez")
- Cor de fundo gerada por hash simples do nome da organização (função `stringToColor`)
- Adicionar `hover:shadow-md cursor-pointer` nos cards

## PROMPT 6 — Analytics Hub: Cards menores + Atividade Recente

**Arquivo**: `src/pages/Analytics.tsx`
- Reduzir padding dos 4 cards (CardHeader `pb-2`, CardContent compact)
- Adicionar seção "Atividade Recente" abaixo dos cards com timeline dos últimos 5 eventos (query à tabela `audit_logs` ou `tickets` + `contacts` para montar timeline)

---

## Arquivos impactados

| Arquivo | Mudanças |
|---|---|
| `src/pages/Auth.tsx` | Typo fix + ícone Target |
| `src/components/dashboard/OverviewDashboardTab.tsx` | Cards wrapper com borda |
| `src/components/widgets/KPICard.tsx` | `font-semibold` → `font-bold` |
| `src/components/AppSidebar.tsx` | Separadores + activeClassName |
| `src/components/Layout.tsx` | Breadcrumb + busca global |
| `src/pages/Organizations.tsx` | Avatar iniciais + hover |
| `src/pages/Analytics.tsx` | Cards compactos + timeline |

