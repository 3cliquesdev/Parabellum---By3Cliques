# Lovable Plan

## Status: Implementado ✅

### Última Implementação: Corrigir Histórico de Conversas (27/01/2026)

**Problema:** Agentes operacionais (sales_rep, support_agent, user) perdiam acesso ao histórico de conversas quando estas eram fechadas.

**Causa:** As políticas RLS filtravam por `status = 'open'`, impedindo acesso a conversas fechadas.

**Solução Aplicada:**
- Atualizadas 6 políticas RLS (3 em `conversations` + 3 em `inbox_view`)
- Lógica nova: agentes veem TODAS as conversas atribuídas a eles (abertas ou fechadas)
- Conversas não atribuídas do departamento: apenas se abertas

**Arquivos Modificados:**
- Migration SQL: 6 políticas RLS corrigidas
- Frontend já tinha o botão "Encerradas" implementado

**Resultado:**
| Cenário | Antes | Depois |
|---------|-------|--------|
| Agente vê conversa atribuída fechada | ❌ | ✅ |
| Agente vê histórico de mensagens | ❌ | ✅ |
| Managers/Admin veem tudo | ✅ | ✅ |
