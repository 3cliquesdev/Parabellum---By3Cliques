

# Resolver nomes de departamentos na tabela de Transições

## Problema
A tabela de "Transições Recentes" mostra UUIDs brutos (ex: `36ce66cd...`) nas colunas "Dept Origem" e "Dept Destino" em vez dos nomes legíveis dos departamentos.

## Solução
Buscar a lista de departamentos do banco e mapear os UUIDs para nomes na tabela.

### Alterações

**`src/pages/AITelemetry.tsx`**:
1. Adicionar uma query para carregar departamentos: `supabase.from("departments").select("id, name")`
2. Criar um mapa `Record<string, string>` de `id → name`
3. Nas linhas 592-593, resolver os nomes:
   - `fromDept` → `deptMap[json?.from_dept] || json?.from_dept || "—"`
   - `toDept` → `deptMap[json?.to_dept] || json?.to_dept || "—"`
4. Exibir UUID truncado como tooltip para referência, nome legível como texto principal

Isso usa o mesmo padrão já existente em `InboxTimeReport.tsx` e `FormAutomationsPanel.tsx`.

