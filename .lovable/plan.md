

# Resolver mensagens "picotadas" — IA deve esperar antes de responder

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

Clientes no WhatsApp frequentemente enviam mensagens fragmentadas:
```
"Oi"
"queria saber"  
"sobre o saque"
```

Hoje, cada mensagem dispara o pipeline de IA independentemente. A IA responde ao "Oi" antes do cliente terminar, gerando respostas fora de contexto.

## Solução: Message Batching com Timer

Implementar um sistema de **acumulação com debounce** — quando uma mensagem chega, o sistema aguarda X segundos por mais mensagens antes de processar. Se outra mensagem chega dentro da janela, o timer reinicia.

### Arquitetura

```text
Mensagem 1 chega → salva no DB → agenda timer (ex: 8s)
Mensagem 2 chega (3s depois) → salva no DB → cancela timer anterior → agenda novo timer (8s)
Mensagem 3 chega (2s depois) → salva no DB → cancela timer anterior → agenda novo timer (8s)
Timer expira → busca todas mensagens pendentes → concatena → processa como uma única mensagem
```

### Implementação

**1. Nova tabela `message_buffer`**
- `conversation_id` (FK)
- `message_content` (text)
- `created_at` (timestamp)
- `processed` (boolean, default false)

**2. Nova edge function `process-buffered-messages`**
- Recebe `conversationId`
- Busca todas mensagens não processadas dessa conversa (ordenadas por created_at)
- Concatena com `\n`
- Marca como processadas
- Chama o pipeline normal (process-chat-flow → ai-autopilot-chat) com a mensagem concatenada

**3. Modificar `meta-whatsapp-webhook/index.ts`**
- Quando ai_mode é `autopilot` (IA vai responder):
  - Salvar mensagem no buffer
  - Chamar uma **scheduled function** ou usar `setTimeout` via edge function que verifica após X segundos se há mensagens mais recentes
  - Se não há mensagens mais novas → processar o buffer
  - Se há → não fazer nada (o timer mais recente processará)

**4. Configuração**
- Adicionar `ai_message_batch_delay_seconds` em `system_configurations` (padrão: 8 segundos)
- Configurável pelo admin na página de configurações de IA

### Edge cases tratados
- **Kill Switch ativo**: mensagens vão direto para fila humana, sem buffering
- **Fluxo ativo com `ask_options`**: não bufferiza (resposta precisa ser imediata para validação de opção)
- **Modo copilot/waiting_human**: não bufferiza (humano responde)
- **Apenas autopilot e ai_response em fluxo**: bufferiza

### Sem risco de regressão
- Buffering só ativa quando IA vai responder (autopilot/ai_response)
- Todos os outros modos mantêm comportamento instantâneo
- Timer configurável permite ajustar ou desativar (0 = desativado)

