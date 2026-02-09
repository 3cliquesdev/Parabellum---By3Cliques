
# Corrigir contagem de execuções dos Playbooks

## Problema

A coluna `execution_count` na tabela `onboarding_playbooks` existe mas nao esta sendo atualizada automaticamente quando novas execucoes sao criadas. Resultado atual no banco:

| Playbook | Contagem exibida | Execucoes reais |
|----------|-----------------|-----------------|
| Onboarding - Assinaturas | 0 | 30 |
| ShopeeCreation | 8 | 1023 |
| Associado Premium | 0 | 2469 |
| Universidade | 0 | 0 |

## Solucao

Duas acoes no banco de dados:

### 1. Corrigir os valores atuais

Uma migracao SQL para sincronizar o `execution_count` com a contagem real da tabela `playbook_executions`.

### 2. Criar trigger automatico

Um trigger na tabela `playbook_executions` que incrementa automaticamente o `execution_count` do playbook toda vez que uma nova execucao e inserida. Isso garante que o valor fique sempre correto sem depender de logica no frontend ou nas edge functions.

## Detalhes tecnicos

```sql
-- 1. Sincronizar valores atuais
UPDATE onboarding_playbooks p
SET execution_count = (
  SELECT COUNT(*) FROM playbook_executions pe 
  WHERE pe.playbook_id = p.id
);

-- 2. Trigger para manter sincronizado
CREATE OR REPLACE FUNCTION increment_playbook_execution_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE onboarding_playbooks
  SET execution_count = execution_count + 1
  WHERE id = NEW.playbook_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_playbook_executions
AFTER INSERT ON playbook_executions
FOR EACH ROW
EXECUTE FUNCTION increment_playbook_execution_count();
```

Nenhuma alteracao de codigo frontend necessaria -- o hook `usePlaybooks` ja busca `*` (incluindo `execution_count`) e a UI ja exibe `playbook.execution_count || 0`.

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero -- apenas corrige dados e adiciona trigger |
| Frontend | Sem alteracao necessaria |
| Performance | Minima -- trigger simples por INSERT |
| Dados existentes | Sincronizados imediatamente |
