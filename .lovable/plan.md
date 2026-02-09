

# Simplificar Disparo de Playbooks: Eliminar Confusao entre Grupo de Entrega e playbook_products

## Problema

Existem **3 caminhos** para vincular playbook a produto, e nenhum deles se comunica:

| Caminho | Tabela | Estado Atual | Webhook usa? |
|---------|--------|--------------|--------------|
| 1. Grupo de Entrega | `delivery_groups` + `group_playbooks` | Ambos grupos apontam para playbooks **inativos** | Sim (prioridade) |
| 2. product_id direto | `onboarding_playbooks.product_id` | "Onboarding - Assinaturas" nao tem product_id | Sim (fallback) |
| 3. playbook_products | `playbook_products` | "Onboarding - Assinaturas" vinculado a 4 produtos | **NAO** |

O usuario configura os vinculos pelo caminho 3 (playbook_products), mas o webhook so consulta os caminhos 1 e 2. Resultado: nenhum playbook dispara.

Alem disso, o dropdown "Grupo de Entrega (Playbook)" no dialog de produto so mostra os 2 grupos antigos e nao lista novos playbooks -- e confuso e redundante.

## Solucao

### 1. Webhook: Adicionar consulta a `playbook_products` como fallback final

**Arquivo**: `supabase/functions/kiwify-webhook/index.ts`

**Fluxo de venda (linhas ~1341-1362):**
- Apos o `else` que busca `onboarding_playbooks.product_id`, adicionar um bloco final:
- Se `playbook_ids` ainda estiver vazio e `product` existe, consultar `playbook_products` para encontrar playbooks ativos vinculados ao produto

**Fluxo de upsell (linhas ~1766-1808):**
- Mesma logica: apos os dois caminhos existentes, adicionar fallback para `playbook_products`

Logica do fallback:
```
if (playbook_ids.length === 0 && product) {
  // Fallback 3: buscar via playbook_products
  const { data: linkedPlaybooks } = await supabase
    .from('playbook_products')
    .select('playbook_id, playbook:onboarding_playbooks(id, is_active)')
    .eq('product_id', product.id);
  
  playbook_ids = linkedPlaybooks
    ?.filter(lp => lp.playbook?.is_active)
    ?.map(lp => lp.playbook_id) || [];
}
```

### 2. UI do Produto: Substituir dropdown de "Grupo de Entrega" por visualizacao dos playbooks vinculados

**Arquivo**: `src/components/ProductDialog.tsx`

Mudancas:
- Remover o dropdown de "Grupo de Entrega (Playbook)" que so mostra os 2 grupos antigos
- Substituir por uma **secao informativa** que mostra os playbooks ativos vinculados ao produto (via `playbook_products`)
- Adicionar link "Gerenciar no Playbook" que leva a edicao do playbook
- Manter o campo `delivery_group_id` no banco (nao quebrar nada), mas nao expor mais na UI

Isso elimina a confusao: o usuario vincula produtos **dentro do playbook** (que ja funciona) e ve o resultado na tela do produto.

### 3. (Sem mudanca) Manter tabelas existentes no banco

Nao vamos deletar `delivery_groups` nem `group_playbooks` -- eles ainda podem ser uteis para cenarios futuros. Apenas:
- O webhook ganha o fallback para `playbook_products`
- A UI do produto para de mostrar o dropdown confuso

## Sequencia

```text
1. kiwify-webhook/index.ts
   - Adicionar fallback playbook_products no fluxo de venda
   - Adicionar fallback playbook_products no fluxo de upsell
   - Deploy automatico

2. ProductDialog.tsx  
   - Remover dropdown "Grupo de Entrega"
   - Adicionar secao informativa de playbooks vinculados
```

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero -- caminhos 1 e 2 continuam funcionando igual |
| Novo comportamento | Playbooks vinculados via playbook_products serao disparados |
| UI | Menos confusao -- usuario ve playbooks vinculados no produto |
| Banco | Nenhuma mudanca de schema |
| Performance | +1 query apenas quando caminhos anteriores falham |

