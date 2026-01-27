

## Plano: Centralizar Base de Conhecimento no AI Trainer (Corrigido)

### Arquitetura Real das Fontes

| Fonte | Banco de Dados | Tool da IA | O Que Contém |
|-------|----------------|------------|--------------|
| **Knowledge Articles** | Supabase (knowledge_articles) | Busca semântica | FAQ, políticas, procedimentos |
| **Kiwify (Vendas/Financeiro)** | Supabase (contacts + deals) | `check_order_status` | Dados de compra, valores, status de venda |
| **Tracking (Logística)** | **MySQL externo** (tabela parcel) | `check_tracking` | Rastreio, status de envio, data de embalagem |
| **Treinamento Sandbox** | Supabase (knowledge_articles) | Busca semântica | Regras aprendidas via correção manual |

---

### Diagrama de Fontes de Conhecimento

```text
                    ┌─────────────────────────────────────┐
                    │   Central de Conhecimento da IA     │
                    └─────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│  📚 Knowledge     │    │  🛒 Kiwify        │    │  📦 Tracking      │
│     Articles      │    │  (Vendas)         │    │  (Logística)      │
├───────────────────┤    ├───────────────────┤    ├───────────────────┤
│ Banco: Supabase   │    │ Banco: Supabase   │    │ Banco: MySQL      │
│ Tabela: knowledge │    │ Tabelas: contacts │    │ Tabela: parcel    │
│         _articles │    │          + deals  │    │                   │
├───────────────────┤    ├───────────────────┤    ├───────────────────┤
│ Tool: busca       │    │ Tool:             │    │ Tool:             │
│ semantica         │    │ check_order_status│    │ check_tracking    │
├───────────────────┤    ├───────────────────┤    ├───────────────────┤
│ Uso: FAQ, docs,   │    │ Uso: valor compra │    │ Uso: status envio │
│ políticas         │    │ status do deal    │    │ data embalagem    │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

---

### Visual Final Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🧠 Central de Conhecimento da IA                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 VISÃO GERAL                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 38       │ │ 38       │ │ 5        │ │ 4        │           │
│  │ Artigos  │ │ Embeddings│ │ Categorias│ │ Fontes   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│  📂 FONTES DE CONHECIMENTO                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📚 Base de Conhecimento             [Gerenciar]            │ │
│  │    → Supabase: knowledge_articles                          │ │
│  │    → 38 artigos | Busca semântica (embeddings)             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 🛒 Kiwify (Vendas/Financeiro)       [Ver Configuração]     │ │
│  │    → Supabase: contacts + deals                            │ │
│  │    → Tool: check_order_status                              │ │
│  │    → Dados de compra, valores, status de venda             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 📦 Rastreio de Pedidos (Logística)  [Ver Configuração]     │ │
│  │    → MySQL Externo: tabela parcel                          │ │
│  │    → Tool: check_tracking                                  │ │
│  │    → Status de envio, data de embalagem, rastreio          │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 🎓 Treinamento Sandbox              [Ver Artigos]          │ │
│  │    → Supabase: knowledge_articles (source=sandbox)         │ │
│  │    → X regras aprendidas via correção manual               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  👤 QUEM USA O QUÊ (Personas)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Helper (Suporte)                                           │ │
│  │ ✓ knowledge_base ✓ customer_data ✓ order_history           │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Hunter (Vendas)                                            │ │
│  │ ✓ knowledge_base ✓ customer_data ✓ order_history           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Alterações Técnicas

#### 1. Novo Componente: `KnowledgeSourcesWidget.tsx`

Lista todas as 4 fontes de conhecimento com informações corretas:

```tsx
// src/components/settings/KnowledgeSourcesWidget.tsx
const sources = [
  {
    id: 'knowledge_articles',
    name: 'Base de Conhecimento',
    icon: BookOpen,
    database: 'Supabase: knowledge_articles',
    tool: 'Busca semântica (embeddings)',
    description: 'FAQ, políticas, procedimentos',
    link: '/knowledge',
  },
  {
    id: 'kiwify',
    name: 'Kiwify (Vendas/Financeiro)',
    icon: ShoppingCart,
    database: 'Supabase: contacts + deals',
    tool: 'check_order_status',
    description: 'Dados de compra, valores, status de venda',
    link: '/settings/kiwify',
  },
  {
    id: 'tracking',
    name: 'Rastreio de Pedidos (Logística)',
    icon: Package,
    database: 'MySQL Externo: tabela parcel',
    tool: 'check_tracking',
    description: 'Status de envio, data de embalagem',
    link: '/settings/integrations', // ou onde MySQL está configurado
  },
  {
    id: 'sandbox',
    name: 'Treinamento Sandbox',
    icon: GraduationCap,
    database: 'Supabase: knowledge_articles (source=sandbox)',
    tool: 'Busca semântica',
    description: 'Regras aprendidas via correção manual',
    link: '/knowledge?source=sandbox_training',
  },
];
```

#### 2. Novo Hook: `useKiwifyStats.tsx`

Buscar estatísticas do Kiwify (contatos + deals):

```tsx
export function useKiwifyStats() {
  return useQuery({
    queryKey: ["kiwify-stats"],
    queryFn: async () => {
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("source", "kiwify");
      
      const { count: dealsCount } = await supabase
        .from("deals")
        .select("id", { count: "exact", head: true });
      
      return { contacts: contactsCount || 0, deals: dealsCount || 0 };
    },
  });
}
```

#### 3. Novo Hook: `useSandboxTrainingCount.tsx`

Contar artigos criados via Sandbox:

```tsx
export function useSandboxTrainingCount() {
  return useQuery({
    queryKey: ["sandbox-training-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("source", "sandbox_training");
      
      return count || 0;
    },
  });
}
```

#### 4. Novo Componente: `PersonaDataAccessWidget.tsx`

Mostra quais personas usam quais fontes:

```tsx
// Mostra:
// - Nome da persona
// - Badges: ✓ knowledge_base, ✓ customer_data, ✓ order_history
// baseado em persona.data_access
```

#### 5. Refatorar: `AITrainer.tsx`

Reorganizar a página para incluir os novos widgets.

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/settings/KnowledgeSourcesWidget.tsx` | **Criar** | Lista 4 fontes com detalhes corretos |
| `src/components/settings/PersonaDataAccessWidget.tsx` | **Criar** | Acesso por persona |
| `src/hooks/useKiwifyStats.tsx` | **Criar** | Stats de contacts + deals |
| `src/hooks/useSandboxTrainingCount.tsx` | **Criar** | Count de artigos sandbox |
| `src/pages/AITrainer.tsx` | **Editar** | Integrar novos widgets |

---

### Benefícios

1. **Visão real e correta**: Mostra exatamente de onde a IA busca cada tipo de informação
2. **Clareza técnica**: Distingue entre Supabase (Kiwify = vendas) e MySQL (Tracking = logística)
3. **Ação rápida**: Links diretos para gerenciar cada fonte
4. **Governança**: Mostra qual persona acessa qual dado
5. **Sem breaking changes**: Tudo continua funcionando, apenas adiciona visualização

