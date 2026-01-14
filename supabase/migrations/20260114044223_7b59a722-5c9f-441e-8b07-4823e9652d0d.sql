-- Adicionar configuração global para ligar/desligar IA
INSERT INTO system_configurations (key, value, category, description)
VALUES ('ai_global_enabled', 'true', 'ai', 'Toggle global para ligar/desligar a IA em todo o sistema. Quando false, nenhuma conversa será atendida pela IA.')
ON CONFLICT (key) DO NOTHING;