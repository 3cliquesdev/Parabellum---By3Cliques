-- ============================================================
-- MIGRAÇÃO: Mais autonomia à IA no fluxo de CÓPIA TESTE
-- Flow ID: abc6cfc0-6d34-4a46-803b-dde828e476c3
--
-- Campos do nó ai_response no flow_definition (snake_case):
--   forbid_questions  → forbidQuestions  no FlowContext
--   forbid_options    → forbidOptions    no FlowContext
--   forbid_financial  → forbidFinancial  no FlowContext
--   exit_keywords     → array de strings
--   max_sentences     → maxSentences     no FlowContext
--   objective         → objective        no FlowContext
--   context_prompt    → contextPrompt    no FlowContext
--
-- ATENÇÃO: Afeta APENAS o fluxo de teste (is_active: false, is_master_flow: false)
-- Data: 2026-03-10
-- ============================================================

-- 1. VERIFICAR que estamos alterando o fluxo correto (segurança)
DO $$
DECLARE
  flow_record RECORD;
BEGIN
  SELECT id, name, is_active, is_master_flow
  INTO flow_record
  FROM chat_flows
  WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fluxo abc6cfc0-6d34-4a46-803b-dde828e476c3 não encontrado!';
  END IF;

  IF flow_record.is_master_flow = true THEN
    RAISE EXCEPTION 'ABORTADO: Este fluxo é Master Flow! Não alterar em produção.';
  END IF;

  IF flow_record.is_active = true THEN
    RAISE EXCEPTION 'ABORTADO: Este fluxo está ATIVO! Execute apenas no fluxo de teste inativo.';
  END IF;

  RAISE NOTICE 'Fluxo validado: % (is_active=%, is_master_flow=%)', 
    flow_record.name, flow_record.is_active, flow_record.is_master_flow;
END $$;

-- 2. PRÉ-VERIFICAÇÃO: Mostrar configuração ATUAL do nó ia_entrada
SELECT 
  elem->>'id' AS node_id,
  elem->'data'->>'forbid_questions' AS forbid_questions_atual,
  elem->'data'->>'forbid_options' AS forbid_options_atual,
  elem->'data'->>'exit_keywords' AS exit_keywords_atuais,
  elem->'data'->>'max_sentences' AS max_sentences_atual,
  LEFT(elem->'data'->>'objective', 80) AS objective_preview,
  LEFT(elem->'data'->>'context_prompt', 80) AS context_prompt_preview
FROM chat_flows,
     jsonb_array_elements(flow_definition->'nodes') AS elem
WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3'
  AND elem->>'id' = 'ia_entrada';

-- 3. ATUALIZAR o nó ia_entrada com novos parâmetros de autonomia
-- Usando uma CTE para calcular o índice do nó e então atualizar
WITH node_index_cte AS (
  SELECT idx - 1 AS node_index
  FROM chat_flows,
       jsonb_array_elements(flow_definition->'nodes') WITH ORDINALITY AS t(elem, idx)
  WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3'
    AND elem->>'id' = 'ia_entrada'
  LIMIT 1
)
UPDATE chat_flows
SET flow_definition = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            flow_definition,
            ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'forbid_questions'],
            'false'::jsonb  -- RELAXADO: permite perguntas esclarecedoras da IA
          ),
          ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'exit_keywords'],
          '["atendente", "humano", "transferir", "consultor", "falar com alguém", "falar com alguem"]'::jsonb
          -- REMOVIDOS termos genéricos que causavam saída prematura: menu, opcoes, pessoa
        ),
        ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'max_sentences'],
        '5'::jsonb  -- AUMENTADO: mais espaço para a IA explicar (antes era 3)
      ),
      ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'objective'],
      '"Entender o problema do cliente fazendo perguntas esclarecedoras quando necessário, buscar na base de conhecimento e tentar resolver antes de qualquer transferência. Só sinalizar saída após 2-3 tentativas sem sucesso ou se o cliente pedir explicitamente um atendente humano."'::jsonb
    ),
    ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'context_prompt'],
    '"Você é um assistente especializado. Sua missão é RESOLVER o problema do cliente, não apenas encaminhar.\n\nREGRAS DE AUTONOMIA:\n1. SEMPRE faça perguntas esclarecedoras quando a solicitação for vaga ou ambígua\n2. Busque na base de conhecimento mesmo com baixa similaridade — use o que encontrar\n3. Tente pelo menos 2-3 interações antes de considerar transferência\n4. Nunca invente informações — se não tiver certeza, diga que vai verificar\n5. Só sinalize transferência se o cliente PEDIR EXPLICITAMENTE um atendente\n\nUse linguagem natural, empática e profissional. Não use listas ou menus."'::jsonb
  ),
  -- MANTIDO: forbid_options = true (sem menus numerados)
  ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'forbid_options'],
  'true'::jsonb
),
updated_at = now()
WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3'
  AND is_master_flow = false
  AND is_active = false;

-- 4. PÓS-VERIFICAÇÃO: Confirmar que as mudanças foram aplicadas
SELECT 
  elem->>'id' AS node_id,
  elem->'data'->>'forbid_questions' AS forbid_questions_NOVO,
  elem->'data'->>'forbid_options' AS forbid_options_MANTIDO,
  elem->'data'->>'exit_keywords' AS exit_keywords_NOVOS,
  elem->'data'->>'max_sentences' AS max_sentences_NOVO,
  LEFT(elem->'data'->>'objective', 100) AS objective_NOVO,
  LEFT(elem->'data'->>'context_prompt', 100) AS context_prompt_NOVO
FROM chat_flows,
     jsonb_array_elements(flow_definition->'nodes') AS elem
WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3'
  AND elem->>'id' = 'ia_entrada';

-- ============================================================
-- ROLLBACK (caso necessário — reverter para configuração restritiva original):
-- ============================================================
/*
WITH node_index_cte AS (
  SELECT idx - 1 AS node_index
  FROM chat_flows,
       jsonb_array_elements(flow_definition->'nodes') WITH ORDINALITY AS t(elem, idx)
  WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3'
    AND elem->>'id' = 'ia_entrada'
  LIMIT 1
)
UPDATE chat_flows
SET flow_definition = jsonb_set(
  jsonb_set(
    jsonb_set(
      flow_definition,
      ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'forbid_questions'],
      'true'::jsonb
    ),
    ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'max_sentences'],
    '3'::jsonb
  ),
  ARRAY['nodes', (SELECT node_index::text FROM node_index_cte), 'data', 'exit_keywords'],
  '["atendente", "humano", "transferir", "menu", "opcoes", "pessoa", "consultor"]'::jsonb
)
WHERE id = 'abc6cfc0-6d34-4a46-803b-dde828e476c3';
*/
