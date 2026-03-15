-- Remover trigger "new_conversation" que nunca funciona
UPDATE chat_flows SET triggers = '{}' WHERE id = '9926200d-5f15-429a-ae98-9adedb2e4f65';

-- Promover V4 como master
UPDATE chat_flows SET is_master_flow = true WHERE id = '9926200d-5f15-429a-ae98-9adedb2e4f65';

-- Rebaixar fluxo antigo
UPDATE chat_flows SET is_master_flow = false WHERE id = 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';