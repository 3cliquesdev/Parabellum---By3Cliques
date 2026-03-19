
-- Migração: Extrair Pergunta/Resposta do campo content para problem/solution
-- Apenas para artigos que têm o padrão e que ainda não têm problem/solution preenchidos

UPDATE knowledge_articles
SET 
  problem = trim(substring(content FROM '(?:Pergunta|PERGUNTA)\s*:\s*(.*?)(?:\n|$)')),
  solution = trim(substring(content FROM '(?:Resposta|RESPOSTA)\s*:\s*([\s\S]*)$'))
WHERE 
  (problem IS NULL OR problem = '')
  AND (solution IS NULL OR solution = '')
  AND content ~* '(Pergunta|PERGUNTA)\s*:.*\n.*(Resposta|RESPOSTA)\s*:';
