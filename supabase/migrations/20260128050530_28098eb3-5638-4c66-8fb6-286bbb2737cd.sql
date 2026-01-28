-- Adicionar configuração de aprendizado passivo (com category obrigatória)
INSERT INTO system_configurations (key, value, description, category)
VALUES (
  'ai_passive_learning_enabled',
  'true',
  'Habilita extração automática de conhecimento de conversas fechadas',
  'AI'
)
ON CONFLICT (key) DO UPDATE SET value = 'true', description = EXCLUDED.description;