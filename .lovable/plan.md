


## Auditoria #8181F702 — Correções Aplicadas

### 3 Fixes deployados no `ai-autopilot-chat`

**Fix 1 (Bug B): Bypass Strict RAG para dados estruturados** ✅
- Linha ~4935: Adicionada detecção `looksLikeStructuredData` (≥3 linhas com "campo:valor")
- Quando detectado, bypassa `callStrictRAG` (que não tem tools) e vai direto ao LLM principal com `create_ticket`

**Fix 2 (Bug C): "valor" removido da regex `commercialTerms`** ✅
- Linha ~7949: `commercialTerms` agora é `/\b(comprar|contratar|assinar|upgrade|plano|preço)\b/i`
- "Valor:" nos dados financeiros não dispara mais `FLOW_EXIT:comercial`

**Fix 3 (Bug B fallback): Ticket determinístico quando LLM vazia + OTP** ✅
- Linha ~7945: Se `hasRecentOTPVerification` + dados estruturados + LLM retornou vazio → cria ticket via `generate-ticket-from-conversation` diretamente
- Fallback de último recurso para quando LLM principal também falha

### Correções adicionais (rodada 2)

**Fix 4: `category: 'financial'` → `'financeiro'`** ✅
- Corrigido para valor válido do enum, garantindo mapeamento correto ao departamento Financeiro

**Fix 5: Envio WhatsApp no fallback usa canal correto** ✅
- Substituído query genérica `whatsapp_instances` por `getWhatsAppInstanceForConversation` + `sendWhatsAppMessage`
- Agora respeita Meta vs Evolution conforme a conversa

**Fix 6: DIRECT mode do `process-buffered-messages` verifica `skipInitialMessage`** ✅
- Adicionado check antes de `callPipeline` no modo DIRECT
- Quando `skipInitialMessage=true`, envia mensagem vazia para disparar saudação proativa
- Paridade com o CRON mode que já tinha essa verificação

### Bug A (skipInitialMessage) — Pendente de verificação
- Os fixes no `meta-whatsapp-webhook` e `process-buffered-messages` já estavam no código
- Fix 6 garante cobertura DIRECT mode
- Aguardando próximo cenário de menu+batching para validar nos logs
