

# Deploy `ai-autopilot-chat` BUILD-V3 + Purge Cache

## Plano

1. **Purge do cache envenenado** — Executar migration SQL para deletar entradas com "Pode repetir" e "não consegui processar corretamente" da tabela `ai_response_cache`.

2. **Redeploy `ai-autopilot-chat`** — Deploy da função com o `console.log('[ai-autopilot-chat] BUILD-V3 2026-03-18')` que força recompilação real do runtime Deno.

3. **Verificação** — Confirmar nos logs que `BUILD-V3` aparece nas invocações subsequentes.

## Critério de Sucesso
- Migration executada sem erros (cache limpo)
- Deploy concluído sem erros
- Logs mostram `BUILD-V3 2026-03-18` em novas invocações

