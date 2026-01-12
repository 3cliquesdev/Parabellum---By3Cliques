-- Alterar FK para SET NULL ao excluir instância WhatsApp
ALTER TABLE conversations 
DROP CONSTRAINT conversations_whatsapp_instance_id_fkey;

ALTER TABLE conversations 
ADD CONSTRAINT conversations_whatsapp_instance_id_fkey 
FOREIGN KEY (whatsapp_instance_id) 
REFERENCES whatsapp_instances(id) 
ON DELETE SET NULL;