

## Diagnose: Atendimentos encerrando sozinhos

### Causa Raiz Identificada

A Edge Function `auto-close-conversations` esta fechando conversas que estao em modo **copilot** (atendimento humano ativo). Isso significa que quando um consultor esta atendendo um cliente e o cliente demora mais de **30 minutos** para responder, o sistema fecha automaticamente a conversa e envia a pesquisa de satisfacao (CSAT).

### Dados das ultimas 24h

| Tipo | Quantidade |
|------|-----------|
| Fechadas automaticamente (inatividade) | **145** |
| Fechadas manualmente (copilot) | 303 |
| Departamentos com auto-close ativo | 3 (Suporte, Suporte Pedidos, Suporte Sistema) |
| Tempo configurado | 30 minutos |

### Problemas encontrados

1. **Auto-close inclui modo `copilot`**: A linha 115 do codigo filtra por `ai_mode IN ('autopilot', 'copilot')`. Conversas em `copilot` sao atendidas por humanos e NAO devem ser fechadas automaticamente por inatividade de 30 min.

2. **Flag `is_bot_message` ausente**: As mensagens de encerramento e CSAT enviadas pelo auto-close via WhatsApp nao incluem `is_bot_message: true`, podendo causar mudanca indevida de `ai_mode` no pipeline.

### Correcoes Propostas

**Correcao 1 - Remover `copilot` do filtro de auto-close:**
- Alterar o filtro de `.in('ai_mode', ['autopilot', 'copilot'])` para `.eq('ai_mode', 'autopilot')`
- Apenas conversas onde a IA estava respondendo e o cliente parou de interagir serao fechadas
- Conversas sob controle humano (copilot/disabled/waiting_human) ficam protegidas

**Correcao 2 - Adicionar `is_bot_message: true` nos envios WhatsApp:**
- Incluir a flag em todas as chamadas `send-meta-whatsapp` e `send-whatsapp` dentro da funcao auto-close
- Impede que mensagens automaticas de encerramento/CSAT causem mudanca de `ai_mode` no pipeline

### Secao Tecnica

Arquivo alterado: `supabase/functions/auto-close-conversations/index.ts`

Mudanca 1 (linha 115):
```typescript
// DE:
.in('ai_mode', ['autopilot', 'copilot'])
// PARA:
.eq('ai_mode', 'autopilot')
```

Mudanca 2 (linhas 270-305 - todas as chamadas send-meta-whatsapp e send-whatsapp):
Adicionar `is_bot_message: true` em todos os payloads de envio de mensagem WhatsApp.

### Impacto

- Zero regressao: conversas em autopilot continuam sendo fechadas normalmente
- Consultores nao serao mais surpreendidos com encerramentos durante atendimento ativo
- Alinhado com o Super Prompt v2.3 (secao 10: auto-close so em condicoes controladas)

