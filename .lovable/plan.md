

# Fix: RLS da Base de Conhecimento para todos os gerentes

## Problema encontrado

As políticas de segurança (RLS) da tabela `knowledge_articles` estão **desatualizadas**. A política SELECT só permite acesso para `admin` e `manager`:

```text
admin_manager_can_view_all_articles → has_role('admin') OR has_role('manager')
support_agent_can_view_published_articles → admin OR manager OR support_agent (apenas publicados)
```

Roles como `general_manager`, `support_manager`, `cs_manager`, `financial_manager` **não conseguem ler nenhum artigo**. Por isso a página aparece vazia para eles.

A função `is_manager_or_admin()` já existe e inclui todos os roles corretos, mas **não é usada na política SELECT**.

## Solução

### 1. Migration SQL — Corrigir RLS de `knowledge_articles`
- Remover as políticas SELECT antigas (`admin_manager_can_view_all_articles` e `support_agent_can_view_published_articles`)
- Criar nova política SELECT unificada usando `is_manager_or_admin(auth.uid())` que dá acesso total a todos os artigos
- Manter acesso de `support_agent` apenas a artigos publicados

### 2. Verificar `knowledge_candidates`
- A tabela `knowledge_candidates` já inclui `support_manager`, `cs_manager`, `general_manager` na SELECT — mas falta `financial_manager`
- Atualizar para usar `is_manager_or_admin()` também

### Nenhuma alteração de código frontend necessária
O frontend já usa `hasFullAccess()` corretamente. O problema é 100% no banco de dados (RLS).

