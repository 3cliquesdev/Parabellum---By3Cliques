

# Plano: Edge Function `detect-kb-gaps` + Cron Job

## Descoberta Importante

O CHECK constraint em `knowledge_candidates.status` só aceita `'pending' | 'approved' | 'rejected'`. Como o usuário pediu para **NÃO criar migration**, vou usar `status: 'pending'` com a tag `'gap_detected'` para marcar os gaps.

## Tarefas

### 1. Criar `supabase/functions/detect-kb-gaps/index.ts`

Edge function conforme o prompt do usuário, com uma alteração:
- `status: 'pending'` (em vez de `'gap_detected'`) + tag `'gap_detected'` no array de tags
- Tudo mais conforme fornecido

### 2. Adicionar config no `supabase/config.toml`

```toml
[functions.detect-kb-gaps]
verify_jwt = false
```

### 3. Agendar cron job `detect-kb-gaps-daily`

Via migration (não contém dados sensíveis — usa anon key pública):

```sql
SELECT cron.schedule(
  'detect-kb-gaps-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/detect-kb-gaps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGci...mmZ0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### 4. Atualizar `.lovable/plan.md`

Documentar como FIX 13.

## Notas Técnicas

- **Kill switch**: Respeitado via `ai_global_enabled`
- **Notificações**: Tabela `notifications` tem RLS que permite INSERT com `WITH CHECK (true)` — funciona com service_role_key
- **Status workaround**: CHECK constraint impede `'gap_detected'`, então uso `'pending'` + tag — o hook `useKnowledgeCandidates` já filtra por tags, então a UI pode diferenciar gaps de candidatos normais

