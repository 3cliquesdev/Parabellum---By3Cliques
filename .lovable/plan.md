

# Integrar Auditoria dentro da Base de Conhecimento

## O que muda

Em vez de uma página separada `/knowledge/audit`, a auditoria será uma **aba** dentro da página `/knowledge`, usando `Tabs` do shadcn. O usuário alterna entre "Artigos" (visão atual) e "Auditoria" (tabela com diagnóstico e edição inline).

## Implementação

### 1. `src/pages/Knowledge.tsx` — Adicionar sistema de abas
- Importar `Tabs, TabsList, TabsTrigger, TabsContent` do shadcn
- Importar o conteúdo de auditoria (hooks + componentes inline do `KnowledgeAudit`)
- Aba "Artigos": conteúdo atual (cards de artigos, filtros, busca)
- Aba "Auditoria": stat cards + tabela de auditoria com edição inline + ações em lote (mover o conteúdo de `KnowledgeAudit.tsx` para cá como componente interno ou importado)
- O header e botões de ação (Curadoria, Gerar Embeddings, Importar, Novo Artigo) ficam **acima das abas** — compartilhados

### 2. `src/components/KnowledgeAuditTab.tsx` — Novo componente
- Extrair o conteúdo do `KnowledgeAudit.tsx` (stats, filtros, tabela, edição inline, bulk actions) para um componente reutilizável `KnowledgeAuditTab`
- Remover o `PageContainer`/`PageHeader` — já estará dentro do layout da Knowledge

### 3. `src/App.tsx` — Remover rota separada
- Remover a rota `/knowledge/audit` (não mais necessária)

### 4. `src/pages/KnowledgeAudit.tsx` — Pode ser deletado ou mantido como redirect

### Resultado visual
- Na página `/knowledge`, o header fica como está (screenshot do usuário)
- Logo abaixo do BrainStatus, aparecem as abas: **📄 Artigos | 🔍 Auditoria**
- Tudo unificado, sem navegação extra

