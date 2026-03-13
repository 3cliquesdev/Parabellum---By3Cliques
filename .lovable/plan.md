

## Plano: Corrigir visibilidade das instâncias Meta para todo o time

### Problema
A tabela `whatsapp_meta_instances` tem RLS que permite acesso apenas a `admin` e `general_manager`. Vendedores e outros membros do time não conseguem ler as instâncias, então o dialog de template não encontra nenhuma instância e não carrega os templates.

### Correção
Adicionar uma policy de **SELECT** para todos os usuários autenticados na tabela `whatsapp_meta_instances`. A policy existente de `FOR ALL` (que cobre INSERT/UPDATE/DELETE) permanece restrita a admins. Apenas a leitura será liberada.

**Migration SQL:**
```sql
CREATE POLICY "Authenticated users can view meta instances"
ON public.whatsapp_meta_instances
FOR SELECT
USING (auth.uid() IS NOT NULL);
```

### Impacto
- Vendedores e gerentes poderão ver as instâncias Meta (somente leitura)
- Templates aparecerão no dialog para todo o time
- Apenas admins continuam podendo criar/editar/deletar instâncias
- Nenhuma mudança de código necessária

