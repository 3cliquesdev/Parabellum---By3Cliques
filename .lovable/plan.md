

# Diagnóstico: "Fluxo desconhecido"

## Causa Raiz

A tabela `chat_flows` tem uma política RLS que **só permite leitura para admin/manager**:

```
"Admins and managers can manage chat flows" → FOR ALL → roles: admin, manager, general_manager, etc.
```

Quando um agente com role `user` (ex: Camila) visualiza o Inbox, o hook `useActiveFlowState` faz um join:
```typescript
.select("id, flow_id, ..., chat_flows(name, is_active)")
```

Como o usuário não tem permissão de SELECT em `chat_flows`, o join retorna `null` → fallback para **"Fluxo desconhecido"**.

## Solução

Adicionar uma política RLS de **SELECT** na tabela `chat_flows` para todos os usuários autenticados. Agentes precisam ver o nome do fluxo ativo, mas não precisam editar/deletar fluxos.

### Migração SQL:
```sql
CREATE POLICY "Authenticated users can view chat flows"
ON public.chat_flows
FOR SELECT
TO authenticated
USING (true);
```

Isso permite que qualquer usuário logado veja os fluxos (nome, status), mantendo as restrições de escrita (INSERT/UPDATE/DELETE) apenas para admins/managers.

### Impacto
- **1 migração SQL** — adicionar política SELECT permissiva
- **Nenhuma mudança de código** — o hook já funciona, só precisa da permissão de leitura
- O label "Fluxo desconhecido" será substituído pelo nome real do fluxo

