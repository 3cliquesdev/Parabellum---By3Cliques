

# Plano: Limpar estados residuais no banco de dados

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

Encontrei **20+ estados residuais** com status `active` ou `waiting_input` em `chat_flow_states`. Não são apenas do Oliver Contato — existem estados presos de múltiplas conversas, a maioria no "Fluxo Principal" no nó `ask_options` (Sim/Não).

## Solução

Criar uma **migração SQL** que cancela todos os estados residuais antigos:

```sql
UPDATE chat_flow_states
SET status = 'cancelled'
WHERE status IN ('active', 'waiting_input')
  AND started_at < NOW() - INTERVAL '1 hour'
  AND (collected_data IS NULL 
       OR collected_data = '{}'::jsonb 
       OR NOT (collected_data ? '__manual_test'));
```

Isso cancela todos os estados que:
- Estão ativos ou aguardando input
- Foram criados há mais de 1 hora (não são fluxos em andamento legítimos)
- NÃO têm o flag `__manual_test` (preserva testes manuais recentes)

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas cancela estados abandonados |
| Upgrade | Sim — limpa lixo que causa conflitos |
| Kill Switch | Não afetado |

