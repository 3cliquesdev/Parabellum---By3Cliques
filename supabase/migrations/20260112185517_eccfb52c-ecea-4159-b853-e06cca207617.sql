-- Alterar FK de project_activity_log para SET NULL (não queremos perder logs)
ALTER TABLE project_activity_log 
DROP CONSTRAINT IF EXISTS project_activity_log_card_id_fkey;

ALTER TABLE project_activity_log 
ADD CONSTRAINT project_activity_log_card_id_fkey 
FOREIGN KEY (card_id) 
REFERENCES project_cards(id) 
ON DELETE SET NULL;

-- Alterar FK de form_submissions para SET NULL (manter submissions mas desassociar do card)
ALTER TABLE form_submissions 
DROP CONSTRAINT IF EXISTS form_submissions_card_id_fkey;

ALTER TABLE form_submissions 
ADD CONSTRAINT form_submissions_card_id_fkey 
FOREIGN KEY (card_id) 
REFERENCES project_cards(id) 
ON DELETE SET NULL;