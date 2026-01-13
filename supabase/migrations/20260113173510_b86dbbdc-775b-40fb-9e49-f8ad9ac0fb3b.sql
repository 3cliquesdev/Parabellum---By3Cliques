-- ===================================================================
-- FIX: Sincronização da inbox_view com conversations
-- ===================================================================

-- Parte 1: Limpeza imediata - Remover registros órfãos
DELETE FROM inbox_view 
WHERE conversation_id NOT IN (SELECT id FROM conversations);

-- Parte 2: Prevenção futura - Trigger para sincronização automática

-- Função para deletar da inbox_view quando conversa é deletada
CREATE OR REPLACE FUNCTION sync_inbox_view_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM inbox_view WHERE conversation_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa antes de deletar conversa
DROP TRIGGER IF EXISTS trigger_sync_inbox_view_delete ON conversations;
CREATE TRIGGER trigger_sync_inbox_view_delete
BEFORE DELETE ON conversations
FOR EACH ROW
EXECUTE FUNCTION sync_inbox_view_on_delete();