

# Corrigir Visibilidade da Configuracao de Tags para Todos os Usuarios

## Problema

A tabela `system_configurations` possui apenas uma politica RLS do tipo `ALL` restrita ao role `admin`. Qualquer usuario que nao seja admin nao consegue fazer `SELECT` nessa tabela. Resultado:

- O hook `useConversationCloseSettings` retorna `false` (fallback) para nao-admins
- O `CloseConversationDialog` nao mostra o aviso "Tags obrigatorias" para esses usuarios
- O botao "Encerrar Conversa" fica habilitado mesmo sem tags
- O backend (Edge Function) bloqueia corretamente, mas o usuario ve um erro generico em vez do aviso visual preventivo

## Solucao

### Adicionar politica RLS de leitura para todos os usuarios autenticados

Criar uma nova politica `SELECT` na tabela `system_configurations` que permita leitura para qualquer usuario autenticado:

```sql
CREATE POLICY "authenticated_can_read_configurations"
  ON public.system_configurations
  FOR SELECT
  TO authenticated
  USING (true);
```

Isso permite que todos os usuarios logados leiam configuracoes do sistema (como `conversation_tags_required`), sem conceder permissao de escrita. A politica existente `admins_can_manage_configurations` (tipo `ALL`) continua controlando INSERT, UPDATE e DELETE exclusivamente para admins.

## Impacto

- Zero regressao: admins continuam com controle total
- Nenhuma alteracao de codigo frontend ou backend
- Todos os usuarios passam a ver o aviso visual de tags obrigatorias no modal de encerramento
- O backend continua como segunda camada de seguranca

