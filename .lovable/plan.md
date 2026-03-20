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

### Auditoria #AFDAE1C6 — Correções Aplicadas (rodada 3)

**Fix 7: `stateId` no stayOnNode do `process-chat-flow`** ✅
- Adicionado `stateId: activeState.id` ao JSON de resposta do stayOnNode
- Permite que o webhook propague `flow_context.stateId` para o autopilot
- Resolve BUG E: sync OTP para `collected_data` agora funciona

**Fix 8: `category: 'financial'` → `'financeiro'` no guard de saque** ✅
- Segunda instância (linha 6280) corrigida — era duplicata do Fix 4
- Ticket de saque agora mapeado corretamente ao departamento Financeiro

**Fix 9: WhatsApp Evolution → helper unificado no guard de saque** ✅
- Substituído query `whatsapp_instances` por `getWhatsAppInstanceForConversation` + `sendWhatsAppMessage`
- Segunda instância corrigida — duplicata do Fix 5

**Fix 10: Guard pós-OTP para intent de saque** ✅
- Adicionado guard FORA do bloco `shouldValidateOTP`
- Quando `hasRecentOTPVerification=true` e histórico contém intent de saque → envia template de coleta PIX
- Evita resposta genérica "Como posso ajudar?" após OTP verificado
- Anti-duplicata: verifica se template já foi enviado nos últimos 3 msgs

### Auditoria #EEFFF1DD — Correções Aplicadas (rodada 4)

**Fix 11: Bypass Strict RAG para ações financeiras** ✅
- `isFinancialBypass = isFinancialAction || isWithdrawalRequest` adicionado à condição do Strict RAG
- Mensagens como "Quero sacar" não passam mais pelo Strict RAG (que não tem tools)

**Fix 12: Guard pós-OTP verifica mensagem atual** ✅
- `hasSaqueIntent` agora testa `customerMessage` além do `messageHistory`
- Conversas onde "Quero sacar" é a primeira mensagem real agora são detectadas

**Fix 13: Fallback de saudação no webhook** ✅
- Se `ai-autopilot-chat` falhar (timeout/erro), webhook envia saudação padrão direto via WhatsApp
- Fallback em AMBOS os caminhos: `!greetResponse.ok` e `catch` geral

**Fix 14: Proteção pós-LLM (emergency fallback)** ✅
- Se LLM retorna vazio sem tool_calls após retry, aplica `flowFallbackMessage || flowObjective || greeting`
- Cliente NUNCA fica sem resposta

**Fix 15: Prompt de saudação proativa melhorado** ✅
- Instruções explícitas: apresentar-se, mencionar habilidades, desambiguar dúvida vs ação financeira
- Removido prompt genérico "Como posso ajudar?"

### Bug A (skipInitialMessage) — Monitoramento
- Funciona para outras conversas (log 98ab6b41 confirmado)
- Fix 7 (stateId) melhora diagnóstico
- Aguardando próximo cenário de menu+batching para validar
