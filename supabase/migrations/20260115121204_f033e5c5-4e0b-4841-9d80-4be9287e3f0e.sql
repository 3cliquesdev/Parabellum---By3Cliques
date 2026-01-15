-- Padronizar motivos de perda em inglês para português
UPDATE deals SET lost_reason = 'nunca_respondeu' WHERE lost_reason = 'no_response';
UPDATE deals SET lost_reason = 'sem_interesse_produto' WHERE lost_reason = 'not_interested';
UPDATE deals SET lost_reason = 'outro' WHERE lost_reason = 'other';
UPDATE deals SET lost_reason = 'preco' WHERE lost_reason IN ('price', 'budget');
UPDATE deals SET lost_reason = 'reembolsado' WHERE lost_reason = 'refunded';
UPDATE deals SET lost_reason = 'estorno' WHERE lost_reason = 'chargedback';
UPDATE deals SET lost_reason = 'ja_comprou_duplicidade' WHERE lost_reason ILIKE '%duplicado%';
UPDATE deals SET lost_reason = 'migracao_pagamento_anterior' 
  WHERE lost_reason ILIKE '%migração%' OR lost_reason ILIKE '%migracao%';