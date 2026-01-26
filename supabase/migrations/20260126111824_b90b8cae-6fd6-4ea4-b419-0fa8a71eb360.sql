-- Function para mesclar contatos duplicados
-- Migra todas as referencias para o master e deleta duplicados

CREATE OR REPLACE FUNCTION public.merge_duplicate_contacts(
  p_master_id UUID,
  p_duplicate_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_id UUID;
  v_migrated INT := 0;
BEGIN
  -- Para cada ID duplicado
  FOREACH v_dup_id IN ARRAY p_duplicate_ids
  LOOP
    -- 1. Migrar conversas
    UPDATE conversations SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 2. Migrar activities
    UPDATE activities SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 3. Migrar deals
    UPDATE deals SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 4. Migrar form_submissions
    UPDATE form_submissions SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 5. Migrar email_sends
    UPDATE email_sends SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 6. Migrar cadence_enrollments
    UPDATE cadence_enrollments SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 7. Migrar cadence_tasks
    UPDATE cadence_tasks SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 8. Migrar customer_journey_steps
    UPDATE customer_journey_steps SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 9. Migrar playbook_executions
    UPDATE playbook_executions SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 10. Migrar playbook_goals
    UPDATE playbook_goals SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 11. Migrar ai_quality_logs
    UPDATE ai_quality_logs SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 12. Migrar ai_failure_logs
    UPDATE ai_failure_logs SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 13. Migrar instagram_messages
    UPDATE instagram_messages SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 14. Migrar instagram_comments
    UPDATE instagram_comments SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 15. Migrar internal_requests
    UPDATE internal_requests SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 16. Migrar lead_distribution_logs
    UPDATE lead_distribution_logs SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 17. Migrar onboarding_submissions
    UPDATE onboarding_submissions SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 18. Migrar quotes
    UPDATE quotes SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 19. Migrar project_boards
    UPDATE project_boards SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 20. Migrar project_cards
    UPDATE project_cards SET contact_id = p_master_id WHERE contact_id = v_dup_id;
    
    -- 21. Migrar customer_tags
    UPDATE customer_tags SET customer_id = p_master_id WHERE customer_id = v_dup_id;
    
    -- 22. Deletar entradas orfas do inbox_view
    DELETE FROM inbox_view WHERE contact_id = v_dup_id;
    
    -- 23. Deletar contato duplicado
    DELETE FROM contacts WHERE id = v_dup_id;
    
    v_migrated := v_migrated + 1;
  END LOOP;
  
  -- Limpar inbox_view orfao final
  DELETE FROM inbox_view 
  WHERE contact_id NOT IN (SELECT id FROM contacts);
  
  RETURN jsonb_build_object(
    'success', true,
    'merged_count', v_migrated, 
    'master_id', p_master_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'master_id', p_master_id
  );
END;
$$;

-- Dar permissao para service_role executar
GRANT EXECUTE ON FUNCTION public.merge_duplicate_contacts TO service_role;