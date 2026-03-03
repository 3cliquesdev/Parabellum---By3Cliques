

# Por que o UPDATE de consultant_id não funciona

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Causa raiz: Trigger `sync_assigned_to_consultant_id`

Existe um trigger **BEFORE INSERT OR UPDATE** na tabela `contacts` com esta lógica:

```sql
IF NEW.assigned_to IS NOT NULL AND NEW.consultant_id IS NULL THEN
  NEW.consultant_id := NEW.assigned_to;
END IF;
```

**O que acontece:**
1. Fazemos `UPDATE contacts SET consultant_id = NULL WHERE ...`
2. O trigger BEFORE dispara **antes** do UPDATE ser salvo
3. Como `assigned_to` ainda tem valor (ex: ID da Camila), o trigger imediatamente seta `consultant_id = assigned_to`
4. O valor volta ao que era antes — parece que o UPDATE "não funcionou"

É por isso que todas as tentativas (migração, edge function, RPC) reportaram sucesso mas o valor nunca mudou.

## Plano de correção

### 1. Corrigir o trigger para validar role
Alterar `sync_assigned_to_consultant_id` para só sincronizar se `assigned_to` apontar para um usuário com role `consultant`:

```sql
CREATE OR REPLACE FUNCTION sync_assigned_to_consultant_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.consultant_id IS NULL THEN
    -- Só sincroniza se o assigned_to for um consultant real
    IF EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.assigned_to AND role = 'consultant'
    ) THEN
      NEW.consultant_id := NEW.assigned_to;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Executar a limpeza dos dados
Após corrigir o trigger, rodar o UPDATE para limpar os 4.499 contatos com `consultant_id` inválido. Desta vez o trigger não vai reverter porque a validação de role vai impedir a re-sincronização.

### Sem risco de regressão
- Contatos com consultores reais (role = consultant) continuam sincronizando normalmente
- Apenas impede que não-consultores sejam auto-atribuídos via trigger

