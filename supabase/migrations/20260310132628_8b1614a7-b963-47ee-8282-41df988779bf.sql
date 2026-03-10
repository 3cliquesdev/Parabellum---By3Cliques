
UPDATE chat_flows
SET flow_definition = jsonb_set(
  flow_definition::jsonb,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN node->>'id' = 'ia_entrada' THEN
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    node,
                    '{data,forbid_questions}', 'false'::jsonb
                  ),
                  '{data,max_sentences}', '5'::jsonb
                ),
                '{data,exit_keywords}', '["atendente","humano","transferir","consultor","falar com alguém","falar com alguem","atendentes","meu consultor","falar com consultor"]'::jsonb
              ),
              '{data,objective}', '"Resolver a dúvida do cliente usando a base de conhecimento, dados do CRM e pedidos rastreados. PRIORIDADE: Tente resolver ANTES de transferir. Faça perguntas esclarecedoras se necessário. Tente 2-3 interações antes de considerar saída. Só transfira se o cliente pedir explicitamente ou após esgotar tentativas."'::jsonb
            ),
            '{data,context_prompt}', '"Você é a assistente virtual da Nexxo AI. Seu papel é RESOLVER problemas, não apenas direcionar. REGRAS: 1) Se não encontrar resposta direta na KB, PERGUNTE ao cliente para entender melhor. 2) Tente pelo menos 2-3 interações antes de considerar transferência. 3) Nunca invente informações - se não sabe, pergunte ou busque. 4) Só use [[FLOW_EXIT]] quando o cliente EXPLICITAMENTE pedir um humano ou após 3 tentativas sem sucesso."'::jsonb
          )
        ELSE node
      END
    )
    FROM jsonb_array_elements(flow_definition::jsonb->'nodes') AS node
  )
)::json,
updated_at = now()
WHERE id = 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';
