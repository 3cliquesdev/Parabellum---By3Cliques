# Plano: Hierarquia de Departamentos no Roteamento

## ✅ IMPLEMENTADO

A edge function `route-conversation` agora suporta **hierarquia de departamentos**.

### Mudanças Aplicadas

1. **Busca do parent_id**: Quando uma conversa é direcionada a um subdepartamento (ex: "Suporte Sistema"), o sistema busca o `parent_id` desse departamento.

2. **Query com fallback**: A busca de agentes agora usa `.in('department', [subdeptId, parentId])` em vez de `.eq('department', subdeptId)`.

3. **Priorização**: Agentes do subdepartamento exato são ordenados primeiro; agentes do departamento pai são fallback.

### Fluxo Corrigido

```
Conversa → Suporte Sistema
    │
    ▼
1. Buscar agentes em "Suporte Sistema" → Nenhum
    │
    ▼
2. Buscar agentes no pai "Suporte" → Encontrou 3 agentes
    │
    ▼
3. Atribuir ao agente com menor carga
```

### Arquivos Modificados

- `supabase/functions/route-conversation/index.ts`

### Status

✅ Implementado e deployado
