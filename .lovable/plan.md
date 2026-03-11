

# Correção: Auto-atribuição de deals com status `won`

## Diagnóstico Final

| Fato | Detalhe |
|---|---|
| **Deals sem dono** | 649 (após 27/fev), **100% com status `won`** |
| **Fonte** | 537 Kiwify direto + 110 sem source + 2 formulário |
| **Causa raiz** | O trigger `auto_assign_deal_on_insert` só atribui deals com `status = 'open'`, e o Kiwify cria deals já como `won` |
| **Pipeline Nacional** | Tem 2 sales_reps configurados (Loriani e Fernanda) — a função funciona corretamente quando chamada |
| **Dani/Pamela** | Nenhum deal atribuído a elas no Nacional (provavelmente dado do relatório de outro pipeline ou manual) |

Sobre Camila e Thaynara: elas estão no pipeline **Internacional & Global**, não no Nacional.

## Correção Proposta

### 1. Atualizar o trigger para incluir `status = 'won'`

Modificar a condição do `auto_assign_deal_on_insert` de:
```sql
IF NEW.assigned_to IS NULL AND NEW.status = 'open' THEN
```
Para:
```sql
IF NEW.assigned_to IS NULL AND NEW.status IN ('open', 'won') THEN
```

Isso mantém a restrição de só atribuir a `sales_rep` (a função `get_least_loaded_sales_rep_for_pipeline` já garante isso).

### 2. Redistribuir os 649 deals órfãos existentes

Uma migration que faz round-robin entre os 2 sales_reps do pipeline Nacional (Loriani e Fernanda) para os deals sem `assigned_to`.

### 3. Limpar duplicatas no `pipeline_sales_reps`

Loriani, Fernanda e Ramon têm entradas duplicadas na tabela `pipeline_sales_reps` para o Nacional. Remover as duplicatas para evitar problemas futuros.

### Arquivos alterados
- 1 migration SQL com as 3 correções acima

