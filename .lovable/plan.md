
Objetivo: auditar por que os textos quebrados do protocolo `1CB23C22` estão poluindo o contexto da IA e definir a correção completa.

1. Achados da auditoria
- O protocolo `1CB23C22` corresponde à conversa `1cb23c22-d306-405a-95c8-f494d26c9354`.
- Essa conversa acumulou `13` mensagens de IA com texto corrompido do tipo:
  `Estou com alta demanda... ðŸ™`
- Também existem `13` registros consecutivos em `ai_failure_logs` com `QUOTA_ERROR`, entre `18:42` e `18:54`.
- O histórico foi poluído por mensagens repetidas de erro, então a IA perde contexto real do cliente e passa a “lembrar” principalmente o fallback quebrado.

2. Causa raiz real
Há dois problemas separados:

A. Encoding quebrado no código da IA
- O arquivo `supabase/functions/ai-autopilot-chat/index.ts` está amplamente corrompido em UTF-8/Latin-1.
- Não é só a mensagem de quota: existem muitas strings quebradas como `ðŸ˜Š`, `ðŸ“§`, `nÃ£o`, `ConfiguraÃ§Ã£o`, etc.
- Isso significa que qualquer mensagem automática salva no banco pode continuar entrando “suja” no contexto.

B. Anti-loop do cron está logicamente falho
- Em `process-buffered-messages`, o buffer é “claimado” com `processed = true` antes de chamar a IA.
- Quando ocorre quota error, a função tenta medir retries com `incrementBufferRetryCount()`.
- Só que essa função procura mensagens `processed = false`.
- Nesse momento, os itens já estão `processed = true`, então o contador tende a retornar `0`.
- Resultado: o limite de retries nunca é atingido de forma confiável, o claim é revertido, e o cron tenta de novo no ciclo seguinte.
- Isso explica o loop histórico da conversa.

3. Impacto no contexto da IA
- As mensagens repetidas de “alta demanda” entram no histórico recente.
- O compressor de contexto também pode resumir essas mensagens quebradas como se fossem conteúdo importante.
- Mesmo quando o atendimento humano assume depois, a conversa já ficou contaminada.

4. Plano de correção
Passo 1 — Corrigir a origem do texto quebrado
- Revisar `supabase/functions/ai-autopilot-chat/index.ts` e substituir todas as strings com mojibake por texto UTF-8 válido.
- Priorizar todas as mensagens que podem ser salvas em `messages` ou enviadas ao cliente.

Passo 2 — Blindar a saída da IA
- Criar um helper central para normalizar/sanitizar mensagens antes de:
  - salvar em `messages`
  - enviar por WhatsApp
  - retornar fallback ao frontend
- Esse helper deve remover sequências claramente corrompidas e padronizar texto seguro.

Passo 3 — Corrigir o anti-loop de quota
- Parar de calcular retry com base em `message_buffer.processed = false` após o claim.
- Substituir por uma fonte persistente e confiável, por exemplo:
  - contar `ai_failure_logs` recentes da conversa com `QUOTA_ERROR`, ou
  - salvar contador/timestamp em `conversations.customer_metadata`.
- Regra: após N falhas consecutivas, não reprocessar no próximo cron e entrar em cooldown.

Passo 4 — Impedir que fallback polua o contexto
- Excluir mensagens repetidas de quota do contexto enviado à IA.
- Manter no máximo 1 aviso recente desse tipo no histórico usado pelo motor e pelo compressor.

Passo 5 — Limpar o dano já causado
- Fazer uma limpeza pontual na conversa `1CB23C22`:
  - corrigir ou remover as mensagens duplicadas quebradas de quota
  - preservar no máximo um aviso técnico
- Opcionalmente, rodar limpeza global para outras mensagens com padrões como `ðŸ`, `Ã`, `�`.

5. Resultado esperado
- A conversa deixa de entrar em loop.
- Novas mensagens automáticas deixam de ser gravadas com texto corrompido.
- O contexto da IA volta a priorizar o conteúdo real do cliente, não os fallbacks repetidos.
- O protocolo `1CB23C22` fica auditável e recuperável sem continuar contaminando compressão e memória.

6. Implementação sugerida
- Arquivos principais:
  - `supabase/functions/ai-autopilot-chat/index.ts`
  - `supabase/functions/process-buffered-messages/index.ts`
- Banco:
  - usar `ai_failure_logs` para cooldown/retry persistente
  - executar limpeza dos registros já corrompidos na conversa auditada
