

# Fix: Tag obrigatória não funciona — seed ausente no banco

## Problema Raiz

A configuração `ticket_field_tags_required` **não existe na tabela `system_configurations`**. Query retornou resultado vazio.

Consequência: `fieldSettings.tags` sempre retorna `false` (default do hook), e a validação no `handleStatusChange` nunca é ativada — o ticket é encerrado sem bloqueio.

## Solução

### 1. Migration SQL — Inserir seed da configuração

```sql
INSERT INTO system_configurations (key, value, category, description)
VALUES ('ticket_field_tags_required', 'false', 'tickets', 
        'Tags obrigatórias na criação e encerramento de ticket')
ON CONFLICT (key) DO NOTHING;
```

Isso cria a row no banco. Quando o admin ativar o toggle em Departamentos > Campos > Tags, o upsert fará UPDATE nessa row (muito mais confiável que INSERT).

### 2. Melhoria no hook — Verificação pós-upsert

**Arquivo: `src/hooks/useTicketFieldSettings.tsx`**

Adicionar um SELECT de verificação após o upsert no `updateField` para garantir que o valor foi realmente persistido. Se não persistiu, lança erro explícito ao invés de falhar silenciosamente.

## Resultado Esperado

1. Admin vai em Departamentos > Campos > Ativa toggle "Tags"
2. O valor `true` é salvo no banco (row já existe, UPDATE funciona)
3. Ao tentar encerrar ticket sem tags, `fieldSettings.tags === true` e o AlertDialog aparece
4. Ticket só encerra após adicionar tag

## Arquivos Modificados

1. **Migration SQL** — 1 INSERT para seed
2. **`src/hooks/useTicketFieldSettings.tsx`** — Verificação pós-upsert (~6 linhas)

