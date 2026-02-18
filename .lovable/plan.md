
## Encerramento Automatico de Conversas WhatsApp com Janela Expirada (+24h)

### Problema

Existem 20 conversas WhatsApp abertas ha mais de 24h (algumas ha mais de 100h). Apos esse prazo, a janela do WhatsApp fecha e nao e mais possivel enviar mensagens. Essas conversas ficam "travadas" no sistema ocupando fila e confundindo agentes.

O auto-close atual so funciona para conversas em `autopilot` com departamento que tem `auto_close_enabled`. Conversas em `waiting_human`, `copilot` ou sem departamento configurado nao sao afetadas.

### Solucao

Adicionar uma etapa no `auto-close-conversations` que encerra **todas** as conversas WhatsApp abertas com `last_message_at` superior a 24h, independente de `ai_mode` ou departamento. Nao tenta enviar mensagem (janela ja expirou), apenas fecha silenciosamente no sistema.

---

### Mudancas tecnicas

**Arquivo:** `supabase/functions/auto-close-conversations/index.ts`

#### Nova etapa: "WhatsApp Window Expired"

Antes do processamento por departamento, adicionar um bloco que:

1. Busca conversas: `status = 'open'`, `channel = 'whatsapp'`, `last_message_at < now() - 24h`
2. Para cada conversa encontrada:
   - Atualiza para `status = 'closed'`, `closed_reason = 'whatsapp_window_expired'`, `ai_mode = 'disabled'`, `auto_closed = true`
   - Insere mensagem interna (nao enviada ao WhatsApp): "Conversa encerrada automaticamente - janela de 24h do WhatsApp expirada."
   - Adiciona tag "Desistencia" (mesma tag ja usada)
3. Nao tenta enviar mensagem via WhatsApp (impossivel apos 24h)
4. Nao envia CSAT (impossivel apos 24h)
5. Registra log no console

#### Fluxo atualizado

```
1. [NOVO] Encerrar conversas WhatsApp com janela expirada (>24h)
2. [EXISTENTE] Processar auto-close por departamento (inatividade configurada)
```

### O que NAO muda

- Logica de auto-close por departamento continua identica
- Kill Switch, Shadow Mode, distribuicao humana nao sao afetados
- Conversas de outros canais (webchat, etc.) nao sao afetadas
- Nenhuma mensagem e enviada ao cliente (janela ja fechou)
- CSAT nao e enviado (impossivel)

### Resultado esperado

As 20 conversas WhatsApp abertas com +24h serao encerradas na proxima execucao do CRON. Novas conversas que ultrapassarem 24h sem resposta tambem serao encerradas automaticamente.
