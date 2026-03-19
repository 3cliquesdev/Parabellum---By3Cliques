
Objetivo: corrigir de vez o loop do protocolo `#1E0A32FC`, onde a conversa entra em contexto financeiro, a IA pede a chave PIX, mas o próximo passo volta para fallback/genérico em vez de continuar a coleta.

Diagnóstico confirmado:
1. O ajuste anterior ficou parcial.
2. Neste protocolo, o estado do fluxo **não recebeu** `chat_flow_states.collected_data.__ai_otp_verified = true`.
3. Evidência real:
   - a conversa ativa é `1e0a32fc-d646-4f39-b80e-a81ab8fb27af`
   - o fluxo ativo é `node_ia_financeiro`
   - `chat_flow_states.collected_data` continua sem `__ai_otp_verified`
   - `process-chat-flow` processou a mensagem `02461462270` com o fluxo ainda sem esse flag
4. Há uma inconsistência adicional no estado da conversa:
   - `customer_metadata.awaiting_otp = true`
   - `customer_metadata.last_otp_verified_at = null`
   - mesmo assim a IA já respondeu: “Sua identidade já foi verificada com sucesso... Qual é a sua chave PIX?”
5. Causa-raiz:
   - o sync do OTP foi implementado apenas no caminho de **validação fresca do código**
   - este caso caiu no caminho de **OTP recente já válido / cliente já verificado**
   - nesse caminho, o sistema libera a coleta, mas **não sincroniza o estado do fluxo** que o `process-chat-flow` usa como fonte de verdade

Plano de correção:
1. Unificar o “sync de verificação” no `ai-autopilot-chat`
   - criar uma rotina única para marcar o cliente como verificado no fluxo
   - essa rotina deve atualizar:
     - `chat_flow_states.collected_data.__ai_otp_verified = true`
     - limpeza de `__ai_otp_step`
     - atualização coerente de metadata de conversa

2. Aplicar esse sync em dois cenários
   - após OTP validado com sucesso
   - e também quando `hasRecentOTPVerification` já permitir a coleta financeira sem novo código

3. Limpar estado OTP obsoleto
   - quando a IA entrar em coleta financeira por verificação já válida, limpar flags antigas como:
     - `awaiting_otp`
     - `otp_expires_at`
   - isso evita que mensagens numéricas futuras sejam tratadas por caminhos errados

4. Adicionar defesa no `process-chat-flow`
   - antes de decidir saída financeira/fallback, reforçar a leitura de estado verificado
   - se o fluxo estiver em nó financeiro e a conversa já tiver verificação válida, não depender só do `collected_data` stale

5. Garantir propagação consistente nos webhooks e batch
   - revisar `handle-whatsapp-event`, `meta-whatsapp-webhook` e `process-buffered-messages`
   - garantir que `stateId` e `otpVerified` cheguem sempre coerentes ao `ai-autopilot-chat`

6. Endurecer a continuidade da coleta
   - no contexto financeiro já verificado, entradas como CPF/telefone/chave PIX numérica devem seguir o roteiro:
     - PIX → banco → valor → motivo
   - nunca cair em resposta genérica ou reset de contexto

Validação após implementação:
1. Reproduzir exatamente `#1E0A32FC`
   - menu → financeiro → “quero sacar” → IA pede PIX → enviar chave numérica
   - esperado: pedir banco

2. Validar estado persistido
   - `chat_flow_states.collected_data.__ai_otp_verified = true`

3. Validar metadata coerente
   - `awaiting_otp = false`
   - `last_otp_verified_at` preenchido quando aplicável

4. Validar continuidade completa
   - PIX numérica
   - banco
   - valor
   - motivo
   - criação do ticket sem fallback

Detalhes técnicos:
- Arquivos principais:
  - `supabase/functions/ai-autopilot-chat/index.ts`
  - `supabase/functions/process-chat-flow/index.ts`
  - `supabase/functions/handle-whatsapp-event/index.ts`
  - `supabase/functions/meta-whatsapp-webhook/index.ts`
  - `supabase/functions/process-buffered-messages/index.ts`
- Não parece exigir mudança de schema; é correção de lógica e sincronização de estado.
- O ponto central não é mais “menu noise”; neste protocolo o defeito principal é **estado de verificação inconsistente entre conversa, fluxo e autopilot**.
