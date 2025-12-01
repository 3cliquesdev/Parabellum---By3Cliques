-- Limpar job de sincronização Kiwify travado
UPDATE sync_jobs 
SET 
  status = 'failed', 
  completed_at = NOW(),
  errors = jsonb_build_array(
    jsonb_build_object(
      'message', 'Job cancelado - função redeploy e correção de bug',
      'timestamp', NOW()
    )
  )
WHERE status = 'running' 
  AND job_type = 'kiwify_sales'
  AND started_at < NOW() - INTERVAL '1 hour';