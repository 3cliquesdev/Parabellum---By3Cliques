

# Plano: Canais de Venda Dinâmicos + FForder

## Contexto
Hoje o dialog "Confirmar Venda" tem apenas 2 opções fixas (Kiwify / Venda Externa). O usuário quer:
1. Adicionar FForder como canal
2. Permitir que gerentes criem/gerenciem canais sem depender de dev
3. Melhorar o formulário "Venda Externa" com: seleção de canal, ID opcional, cadastro de empresa

## Arquitetura

### 1. Nova tabela `sales_channels` (migration)
```sql
CREATE TABLE public.sales_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE, -- ex: 'fforder', 'pix_direto'
  icon text DEFAULT '💳',
  requires_order_id boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Seed com canais iniciais
INSERT INTO sales_channels (name, slug, icon, requires_order_id) VALUES
  ('FForder', 'fforder', '📦', true),
  ('PIX Direto', 'pix_direto', '💰', false),
  ('Boleto', 'boleto', '🏦', false),
  ('Cartão Direto', 'cartao_direto', '💳', false),
  ('Transferência', 'transferencia', '🔄', false);

-- RLS: managers podem CRUD, todos authenticated podem ler
ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sales_channels"
  ON public.sales_channels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage sales_channels"
  ON public.sales_channels FOR ALL TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));
```

### 2. Refatorar `ValidateWonDealDialog.tsx`
- Manter tab **Kiwify** como está (validação automática)
- Renomear tab "Venda Externa" → "Outros Canais"
- No tab "Outros Canais", adicionar:
  - **Select "Canal de Venda"** — busca da tabela `sales_channels` (hook `useSalesChannels`)
  - **Campo "ID da Venda"** — opcional por padrão, obrigatório se o canal tem `requires_order_id=true`
  - **Campo "Empresa"** — input com autocomplete dos contatos tipo empresa, ou botão "Cadastrar nova empresa" inline
  - Manter campos existentes: Valor da Venda, Observação

### 3. Hook `useSalesChannels`
- Query simples: `select * from sales_channels where is_active=true order by name`
- Usado no dialog e na página de configuração

### 4. Atualizar `onManualSuccess` (Deals.tsx)
- Expandir o payload para incluir `sales_channel_id`, `sales_channel_name`, `external_order_id`, `company_name`
- Salvar esses dados no deal (metadata ou campos dedicados) e no log de interação

### 5. Página de gestão de canais (Settings)
- Nova rota `/settings/sales-channels`
- CRUD simples: nome, ícone (emoji picker ou input), toggle "Exige ID de venda", ativar/desativar
- Acessível apenas para managers (já protegido por RLS + ProtectedRoute)
- Link na página de Settings existente

## Arquivos a criar/alterar

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `sales_channels` + seed + RLS |
| `src/hooks/useSalesChannels.tsx` | Criar hook |
| `src/components/deals/ValidateWonDealDialog.tsx` | Refatorar tab "manual" com canal, ID, empresa |
| `src/pages/Deals.tsx` | Expandir `handleManualWonSuccess` com novos campos |
| `src/pages/SalesChannelsSettingsPage.tsx` | Criar CRUD de canais |
| `src/App.tsx` | Adicionar rota `/settings/sales-channels` |
| `src/pages/Settings.tsx` (ou equivalente) | Adicionar link para nova página |

## Resultado
- Gerente cria "FForder" (ou qualquer canal) via Settings sem depender de dev
- Vendedor ao fechar deal escolhe canal → preenche ID se necessário → registra empresa → fecha
- Auditoria completa no log de interação com canal + ID + empresa

