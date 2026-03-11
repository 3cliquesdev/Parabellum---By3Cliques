

# Criar novo fluxo unificado para teste

## Situação

| Fluxo | Nós | Status |
|---|---|---|
| **Master Flow + IA Entrada** (produção) | 33 | ✅ Ativo, Master |
| **[CÓPIA TESTE] Master Flow + IA Entrada** | 53 | ❌ Inativo |

A CÓPIA TESTE já contém a versão unificada (IA resolve primeiro → Intent Router → sub-fluxos Financeiro/Cancelamento). Ela tem os 33 nós do Master + 20 nós adicionais dos sub-fluxos.

## Plano

Criar um **novo fluxo** copiando a `flow_definition` da CÓPIA TESTE, com nome limpo para teste. O Master Flow atual permanece inalterado em produção.

### Migration SQL

```sql
INSERT INTO chat_flows (name, description, triggers, trigger_keywords, department_id, 
  support_channel_id, flow_definition, is_active, is_master_flow, priority, created_by)
SELECT 
  'Master Flow Unificado (Teste)' as name,
  'Fluxo unificado: IA resolve primeiro → Intent Router → sub-fluxos Financeiro/Cancelamento. Para teste antes de produção.' as description,
  triggers, trigger_keywords, department_id, support_channel_id, 
  flow_definition, 
  false as is_active,       -- inativo para teste manual
  false as is_master_flow,  -- NÃO é master
  priority, created_by
FROM chat_flows 
WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3';
```

**Resultado:** Um novo fluxo inativo chamado "Master Flow Unificado (Teste)" aparecerá na lista de fluxos, pronto para edição e teste sem afetar a produção.

