

# Auditoria 100% Final — ChatFlow Soberano

## Estado Atual (Conquistas Anteriores)
- ✅ `persona.system_prompt` injetado dinamicamente
- ✅ `buildCollectionMessage` é fonte única de templates
- ✅ "Cérebro financeiro" removido, delegado ao fluxo/KB
- ✅ Menu A/B eliminado, cancelamento genérico
- ✅ Email subject dinâmico via `persona.name`
- ✅ `TRANSFER_LABELS` busca departamento do banco
- ✅ Comentários Kiwify neutralizados

## Problemas AINDA Encontrados

### 🔴 P1 — 48 ocorrências de UUIDs de departamento hardcoded
O código repete `DEPT_COMERCIAL_ID = 'f446e202-...'` e `DEPT_SUPORTE_ID = '36ce66cd-...'` em **12+ locais distintos** (L1868, L2654, L3917, L4928, L5633, L8535, L9268, L9948, L10949...).

Se a organização renomear ou trocar departamentos, nenhum desses roteamentos acompanha. O fluxo visual já define departamento de destino via `flow_context.department`, mas o código **ignora isso** nos fallbacks sem fluxo e força UUIDs fixos.

**Solução:** Resolver os IDs uma única vez no início do handler via query `departments` (por nome), com fallback ao UUID atual. Usar variáveis centralizadas em todo o arquivo.

### 🔴 P2 — Regra de negócio "conta de terceiros" no fallback de saque (L1196)
```
IMPORTANTE: O saque será creditado via PIX na chave informada, vinculada ao seu CPF. 
Não é possível transferir para conta de terceiros.
```
Essa é uma regra de negócio específica embutida no fallback. Deve vir do template do banco (`saque_sucesso`) ou ser removida do fallback genérico.

### 🟡 P3 — Variáveis `isKiwifyValidated` e campos `kiwify_validated` (funcional)
São nomes de variáveis/colunas do schema real. Renomear quebraria o banco. **Não alterar** — apenas documentar como "legacy naming".

### 🟡 P4 — `allowed_sources: 'kiwify'` na interface (funcional)
Tipo literal na interface `FlowContext`. Renomear quebraria contratos. **Não alterar**.

---

## Plano de Correção (2 correções)

### Correção 1 — Centralizar resolução de departamentos (eliminar 48 UUIDs)

No início do handler principal (após carregar a conversa), fazer UMA query para resolver departamentos por nome:

```typescript
// Resolver departamentos dinamicamente (1 query, usado em todo o handler)
const { data: deptRows } = await supabaseClient
  .from('departments')
  .select('id, name')
  .in('name', ['Comercial - Nacional', 'Suporte']);

const deptMap = new Map((deptRows || []).map((d: any) => [d.name, d.id]));
const DEPT_COMERCIAL_ID = deptMap.get('Comercial - Nacional') || 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
const DEPT_SUPORTE_ID = deptMap.get('Suporte') || '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
```

Depois, remover todas as 12+ declarações locais de `DEPT_COMERCIAL_ID` / `DEPT_SUPORTE_ID` / `SUPORTE_DEPT_ID` espalhadas pelo arquivo e usar as variáveis centralizadas.

Adicionalmente, nos pontos de fallback sem fluxo (L8535, L9268, L10949), substituir o UUID inline por `DEPT_SUPORTE_ID`.

### Correção 2 — Remover regra de negócio do fallback de saque (L1196)

Substituir:
```
IMPORTANTE: O saque será creditado via PIX na chave informada, vinculada ao seu CPF. 
Não é possível transferir para conta de terceiros.
```
Por:
```
Acompanhe o status pelo protocolo acima.
```
A regra sobre titularidade PIX deve estar no template `saque_sucesso` do banco ou na KB — não no código.

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `ai-autopilot-chat/index.ts` | +1 query centralizada no início, -12 declarações locais de UUID, ~48 referências atualizadas |
| | L1196: remover regra de negócio do fallback |

**Estimativa:** ~60 linhas alteradas (maioria remoção de duplicatas), 0 funcionalidade removida

## O que NÃO alterar
- `kiwify_events`, `kiwify_validated` — schema real do banco
- `allowed_sources: 'kiwify'` — tipo de interface, renomear quebraria contratos
- `isKiwifyValidated` — variável funcional mapeada à coluna real
- Queries a `kiwify_events` — infraestrutura CRM legítima

