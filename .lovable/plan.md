

# Correções da IA em 3 Fases (sem risco de quebra)

## Status atual (verificado agora)
- **Anti-loop de quota**: Funcionando. Zero novas mensagens mojibake após fix das 19:20.
- **Anti-loop em process-buffered-messages**: Funcionando. `incrementBufferRetryCount` já usa `ai_failure_logs` (persistente).
- **Guard anti-vazamento de instruções**: Já existe (linhas 9313-9352 do index.ts) com 8 regex patterns + log de auditoria.
- **Encoding no código-fonte**: 3.439 strings corrompidas ainda no index.ts (comments + logs). Não afetam mensagens ao cliente (fix parcial funcionou), mas poluem logs e são bomba-relógio.
- **Mensagens poluentes no banco**: 163 mensagens antigas com mojibake + ~130 "alta demanda" duplicadas em 17 conversas.

## Fase 1 — Limpeza do banco (zero risco, SQL puro)
Limpar mensagens que já poluem o contexto da IA:
- Deletar mensagens duplicadas de "alta demanda" em cada conversa, mantendo apenas a mais recente por conversa
- Corrigir o emoji `ðŸ™` nas mensagens restantes para texto limpo
- **Impacto**: 0 alteração de código. Apenas dados antigos limpos.

## Fase 2 — Guard anti-regurgitação de KB + handler de áudio/imagem
Adicionar ao bloco de pós-filtro existente (linhas ~9313 do index.ts):
- **Anti-regurgitação**: Detectar quando a IA diz "suporte humano", lista categorias internas, ou menciona "Seller Center" fora de contexto TikTok
- **Handler de mídia**: Quando mensagem do cliente é áudio/imagem, incluir instrução no prompt para pedir descrição por texto
- **Impacto**: Aditivo — só adiciona novas regex ao filtro existente e uma condição ao prompt. Nenhuma lógica existente alterada.

## Fase 3 — Correção massiva de encoding no código-fonte
Reescrever todo o `ai-autopilot-chat/index.ts` corrigindo as 3.439 strings mojibake (comments, logs, variáveis):
- `ðŸ†•` → `🆕`, `ðŸ"§` → `🔧`, `ðŸ›¡ï¸` → `🛡️`, `ConfiguraÃ§Ã£o` → `Configuração`, `nÃ£o` → `não`, etc.
- **Impacto**: Apenas strings/comments. Zero mudança de lógica. Mas como o arquivo tem 10.010 linhas, é a fase mais arriscada em volume — por isso fica por último.

## Ordem de execução
1. **Fase 1** → Migração SQL (imediato, sem deploy)
2. **Fase 2** → Edição cirúrgica no index.ts (~30 linhas novas)
3. **Fase 3** → Reescrita de encoding do index.ts inteiro (volume alto, mesma lógica)

Cada fase é independente. Se uma quebrar, as outras continuam funcionando.

