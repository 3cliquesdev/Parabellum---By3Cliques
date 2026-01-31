

# Plano: Corrigir Datas dos Deals CS Migrados

## Diagnóstico

Os 5.393 deals criados pela migração retroativa têm todos a mesma data:
- **Data atual**: `2026-01-31 17:15:15` (momento da migração)
- **Data correta**: Deveria ser a data da venda comercial original (ex.: 2026-01-16, 2025-12-18, etc.)

Isso faz com que o filtro de data não encontre nenhum deal quando o usuário busca por períodos anteriores.

## Solução

Executar um **UPDATE** para copiar a data de criação do deal comercial ganho para o deal CS correspondente.

### Script de Correção

```sql
-- Atualizar created_at dos deals CS para refletir a data da venda original
UPDATE deals cs
SET created_at = (
  SELECT MIN(d.closed_at)  -- Usar closed_at (data do fechamento da venda)
  FROM deals d
  WHERE d.contact_id = cs.contact_id
    AND d.pipeline_id != 'a7599c3b-2d55-4879-b5eb-303bc8266ea2'
    AND d.status = 'won'
    AND d.is_returning_customer = false
)
WHERE cs.pipeline_id = 'a7599c3b-2d55-4879-b5eb-303bc8266ea2'
  AND cs.lead_source = 'migracao_retroativa';
```

### Lógica

| Campo | Valor Atualizado | Justificativa |
|-------|------------------|---------------|
| `created_at` | `MIN(closed_at)` do deal comercial ganho | Reflete a data real da conversão do cliente |

### Impacto Esperado

- **Antes**: 0 deals aparecem no filtro 28-30/01/2026
- **Depois**: Deals aparecem nas datas corretas (distribuídos por todo o histórico)

## Validação Prévia

Antes de executar, posso verificar quantos deals serão afetados e suas novas datas:

```sql
SELECT 
  COUNT(*) as total_afetados,
  MIN(d.closed_at) as data_mais_antiga,
  MAX(d.closed_at) as data_mais_recente
FROM deals cs
JOIN deals d ON d.contact_id = cs.contact_id 
  AND d.pipeline_id != 'a7599c3b-2d55-4879-b5eb-303bc8266ea2'
  AND d.status = 'won'
  AND d.is_returning_customer = false
WHERE cs.pipeline_id = 'a7599c3b-2d55-4879-b5eb-303bc8266ea2'
  AND cs.lead_source = 'migracao_retroativa';
```

## Arquivos Afetados

| Tipo | Descrição |
|------|-----------|
| SQL (uma vez) | UPDATE para corrigir datas dos deals existentes |

## Código Atual (já correto)

O webhook Kiwify que criei anteriormente **já cria os deals CS com a data correta** (momento da venda). Este fix é apenas para os dados históricos migrados.

## Conformidade com Base de Conhecimento

| Regra | Status |
|-------|--------|
| Preservação do existente | ✅ Apenas corrige datas, não remove dados |
| Upgrade, não downgrade | ✅ Melhora qualidade dos dados |
| Zero regressão | ✅ Fluxos atuais não afetados |

