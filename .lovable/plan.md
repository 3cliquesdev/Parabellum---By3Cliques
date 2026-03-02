

# Plano: Implementar Fixes da Auditoria Completa

## Escopo — 5 correções priorizadas

### 1. Trocar modelo do `analyze-ticket` para `google/gemini-2.5-flash-lite`
- **Arquivo**: `supabase/functions/analyze-ticket/index.ts`
- Alterar default de `openai/gpt-5-mini` para `google/gemini-2.5-flash-lite` (linhas 17, 28)
- Tarefas de classificação (sentiment, tags, summary) não precisam de modelo pesado
- Mantém fallback dinâmico via `system_configurations.ai_default_model`

### 2. Adicionar retry no bloco comercial do webhook
- **Arquivo**: `supabase/functions/meta-whatsapp-webhook/index.ts`
- Linhas 1345-1350: quando re-invoke do `process-chat-flow` com `forceCommercialExit` falha, adicionar segunda tentativa (mesmo padrão já implementado no financeiro)
- Se ambas falharem e `hasFlowContext=true`, manter no fluxo em vez de handoff hardcoded

### 3. Substituir `fetch` direto para Graph API por `send-meta-whatsapp`
- **Arquivo**: `supabase/functions/meta-whatsapp-webhook/index.ts`
- 5 ocorrências de `fetch(graph.facebook.com/...)` nos blocos financeiro e comercial (linhas 1083, 1154, 1197, 1304, 1362)
- Substituir por `supabase.functions.invoke("send-meta-whatsapp", ...)` com `skip_db_save: true`
- Garante tracking de `provider_message_id` e logs centralizados

### 4. Refinar regex financeira — tornar termos genéricos contextuais
- **Arquivos**: `process-chat-flow/index.ts` e `ai-autopilot-chat/index.ts`
- Palavras soltas como `saldo`, `pagamento`, `cobran[çc]a`, `valor` geram falsos positivos
- Tornar contextuais: exigir verbo de ação ou contexto financeiro explícito
  - `saldo` → `(sacar|tirar|retirar|ver|consultar|meu)\s*saldo`
  - `pagamento` → `(fazer|realizar|efetuar|cancelar|estornar)\s*pagamento`
  - `valor` manter apenas com pattern existente `valor\s*(que|da|do|em)`
  - `cobran[çc]a` → `(cancelar|contestar|cobran[çc]a\s*indevida)`

### 5. Investigar e corrigir `dispatch-conversations`
- Ler logs da edge function para identificar causa da falha de distribuição
- Corrigir conforme diagnóstico

---

### Sem risco de regressão
- Modelo `gemini-2.5-flash-lite` suporta os mesmos prompts (classificação simples)
- Retry comercial segue padrão já validado no financeiro
- `send-meta-whatsapp` já é usado em todo o resto do pipeline
- Regex refinada continua detectando intenções financeiras reais ("quero sacar saldo", "fazer reembolso")

