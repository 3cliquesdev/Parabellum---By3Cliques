

# Fix: Ativar V4 Master para teste isolado no WhatsApp

## Problema confirmado nos logs

Os logs de agora (`16:09:31`) mostram exatamente o problema:

```
🔍 Checking flow: V4 Master - triggers: 1
📝 Comparing: triggerNorm: "new_conversation", messageContainsTrigger: false
⏭️ Skipping Master Flow without triggers: Master Flow + IA Entrada
🎯 MASTER FLOW found: Master Flow + IA Entrada    ← FLUXO ERRADO RODANDO
```

O V4 Master tem `is_master_flow = false` e um trigger `new_conversation` que nunca bate. O fluxo antigo (menus estáticos) roda como master.

## Solução para teste isolado no WhatsApp real

Você **já tem** o Modo Teste no Inbox. Não precisa trocar o master flow para testar:

1. Abra uma conversa WhatsApp no Inbox
2. Clique no ícone 🧪 (frasco) no header
3. Selecione **"V4 Master"** da lista
4. O V4 roda APENAS naquela conversa — clientes reais não são afetados

**Problema**: O trigger `new_conversation` no V4 impede que ele seja encontrado como Master Flow mesmo se marcarmos `is_master_flow = true`, porque o motor filtra fluxos com triggers da lista de candidatos a master.

## Correções necessárias (2 alterações)

### 1. SQL: Limpar trigger inválido do V4 + promover como Master
```sql
-- Remover trigger "new_conversation" que nunca funciona
UPDATE chat_flows SET triggers = '{}' WHERE id = '9926200d-5f15-429a-ae98-9adedb2e4f65';

-- Promover V4 como master
UPDATE chat_flows SET is_master_flow = true WHERE id = '9926200d-5f15-429a-ae98-9adedb2e4f65';

-- Rebaixar fluxo antigo
UPDATE chat_flows SET is_master_flow = false WHERE id = 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';
```

### 2. Validação do fluxo via Teste isolado
Antes de aplicar o SQL acima (que afeta produção), testar o V4 usando o Modo Teste existente no Inbox para garantir que a triagem ajuda, roteia e os helpers funcionam.

## Fluxo de trabalho
1. **Primeiro**: Testar V4 via Modo Teste em 1 conversa WhatsApp (sem risco)
2. **Se funcionar**: Executar o SQL para trocar o master flow (produção)
3. **Rollback**: Se der problema, basta rodar o SQL inverso

