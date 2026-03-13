

## Plano: Acionar Deals pelo Inbox (Parabellum completo)

### Problema Atual
Os deals no sidebar do Inbox (`ContactDetailsSidebar.tsx`) são exibidos como cards estáticos — sem ações de editar, mudar etapa, marcar ganho/perdido. O usuário precisa sair do inbox e ir para `/deals` para gerenciar.

### Solução
Transformar os cards de deal no sidebar do Inbox em cards interativos com ações completas:

**1. Cards de Deal clicáveis com ações rápidas** (`ContactDetailsSidebar.tsx`)
- Cada card de deal exibirá: título, valor, etapa atual, vendedor atribuído
- Botões de ação rápida em cada card:
  - **Editar** → abre o `DealDialog` existente em modo edição (passando `deal` prop)
  - **✅ Ganho** → atualiza status para `won` via `useUpdateDeal`
  - **❌ Perdido** → abre mini-dialog para selecionar motivo da perda (usando `LOST_REASONS` do `DealDialog`)
  - **Mudar Etapa** → dropdown com as etapas do pipeline do deal via `useStages`
- Clicar no título do deal abre o `DealDialog` em modo edição

**2. Exibir info da etapa no card** 
- Query de deals já faz `select` com `stages(name)` — basta exibir o nome da etapa no card
- Alterar a query `contact-deals` para incluir `stages(id, name)` (já está no select)

**3. Invalidação de cache**
- Após qualquer ação, invalidar `["contact-deals", contactId]` e `["deals"]`

### Arquivos afetados
- **`src/components/ContactDetailsSidebar.tsx`** — Reescrever a seção de deals (linhas 349-388) para incluir ações interativas, dropdowns de etapa, botões ganho/perdido e edição via DealDialog

### Não necessário
- Nenhuma migração SQL — usa hooks existentes (`useUpdateDeal`, `useUpdateDealStage`, `useStages`)
- Nenhum novo componente — reutiliza `DealDialog` e componentes UI existentes

