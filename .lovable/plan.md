

# Reorganizar menu de Devoluções

## O que muda

### 1. Menu lateral (`src/config/routes.ts`)
- Renomear "Motivos de Devolução" → **"Conf. de Devoluções"**
- Mover href para `/settings/returns-config` (nova rota unificada)
- "Devoluções" (`/returns`) permanece como está

### 2. Nova página unificada: `src/pages/ReturnsConfigSettings.tsx`
- Página com **abas (Tabs)**:
  - **Motivos de Devolução** — conteúdo atual do `ReturnReasonsSettings`
  - **SLA de Devoluções** — conteúdo relevante do `SLASettings` (políticas de SLA filtradas para devoluções, ou link para SLA geral)
- Importa os componentes existentes como seções

### 3. Rotas (`src/App.tsx`)
- Adicionar rota `/settings/returns-config` apontando para `ReturnsConfigSettings`
- Manter `/settings/return-reasons` como redirect para `/settings/returns-config` (retrocompatibilidade)

### 4. Breadcrumb (`src/components/Layout.tsx`)
- Adicionar `"/settings/returns-config": "Conf. de Devoluções"`

### 5. Settings page (`src/pages/Settings.tsx`)
- Atualizar card "Motivos de Devolução" → "Conf. de Devoluções" com navegação para `/settings/returns-config`

## Resultado no menu
```text
Cadastros
  ├── Consultores
  ├── Devoluções          → /returns
  ├── Conf. de Devoluções → /settings/returns-config (abas: Motivos + SLA)
  ├── Produtos
  └── Depart. & Operações
```

## Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `src/config/routes.ts` | Renomear item, atualizar href |
| `src/pages/ReturnsConfigSettings.tsx` | **Novo** — página com abas |
| `src/App.tsx` | Nova rota + redirect |
| `src/components/Layout.tsx` | Breadcrumb |
| `src/pages/Settings.tsx` | Atualizar card |

