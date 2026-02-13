
## Problema Identificado

Na função `ai-autopilot-chat`, existem dois locais onde `handoffDepartment` é calculado e usado para atualizar o banco de dados:

1. **Linha 4310**: `const handoffDepartment = confidenceResult.department || DEPT_SUPORTE_ID;`
2. **Linha 6752**: `const handoffDepartment = isLeadWithoutEmail ? DEPT_COMERCIAL_ID : DEPT_SUPORTE_ID;`

O problema é que `confidenceResult.department` é calculado por `pickDepartment()` (linha 886), que analisa apenas o conteúdo da mensagem usando regex/keywords de fins financeiros. Isso ignora completamente o departamento já definido pelo chat flow.

**Exemplo do bug**:
- Chat flow define `department = "Suporte Pedidos"` (via nó de transfer)
- Cliente escreve "como faço uma devolução" (palavra-chave de finanças)
- `pickDepartment()` detecta "devolução" → retorna "Financeiro"
- `handoffDepartment` recebe "Financeiro"
- Conversa é transferida para Financeiro, ignorando o Suporte Pedidos já definido

## Solução Proposta

**Modificar a lógica de atribuição de departamento para respeitar a hierarquia**:

```
1. Se conversation.department existe (não é null) → usar esse departamento
2. Se conversation.department é null → usar pickDepartment() para determinar
3. Nunca sobrescrever departamento já definido
```

### Mudanças Técnicas

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

#### Mudança 1: Linha 4310 (Handoff após identificação de cliente)

**Antes**:
```typescript
const handoffDepartment = confidenceResult.department || DEPT_SUPORTE_ID;
```

**Depois**:
```typescript
// ✅ NOVO: Respeitar departamento definido pelo fluxo
const handoffDepartment = conversation.department || confidenceResult.department || DEPT_SUPORTE_ID;
```

#### Mudança 2: Linha 6752 (Fallback para leads)

**Antes**:
```typescript
const handoffDepartment = isLeadWithoutEmail ? DEPT_COMERCIAL_ID : DEPT_SUPORTE_ID;
```

**Depois**:
```typescript
// ✅ NOVO: Respeitar departamento definido pelo fluxo (não sobrescrever)
const handoffDepartment = conversation.department || 
                         (isLeadWithoutEmail ? DEPT_COMERCIAL_ID : DEPT_SUPORTE_ID);
```

#### Mudança 3: Adicionar logs de auditoria (linhas 4312 + 6754)

Para facilitar diagnóstico, adicionar um log que mostre se o departamento foi respeitado ou recalculado:

```typescript
console.log('[ai-autopilot-chat] 🔄 Departamento de handoff:', {
  flowDepartment: conversation.department,
  aiDetectedDepartment: confidenceResult.department || 'nenhum',
  finalDepartment: handoffDepartment,
  reason: conversation.department ? 'RESPEITANDO FLUXO' : 'USANDO IA'
});
```

## Impacto (Zero Regressão)

- ✅ Conversas SEM departamento definido pelo fluxo continuam funcionando igual (usam `pickDepartment()`)
- ✅ Conversas COM departamento definido pelo fluxo agora são respeitadas
- ✅ Fallback para leads sem email continua funcionando, mas agora respeita fluxo se houver
- ✅ Nenhuma mudança de lógica de IA, apenas ordem de prioridade
- ✅ Logs adicionados para auditoria, sem afetar comportamento

## Arquivos Modificados

1. `supabase/functions/ai-autopilot-chat/index.ts` 
   - Linha ~4310: Adicionar `conversation.department ||` antes de `confidenceResult.department`
   - Linha ~6752: Adicionar `conversation.department ||` antes de `isLeadWithoutEmail`
   - Linhas ~4312 + 6754: Adicionar logs estruturados

