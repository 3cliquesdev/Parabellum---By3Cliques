

# Diagnóstico: Delay de 8 minutos nas conversas #062BCD76 e #6F32B0C4

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Causa raiz

As respostas de ambas conversas têm o **mesmo timestamp exato** (`18:33:44.534369`) — foram enviadas pela minha intervenção manual da sessão anterior. O webhook **não entregou** as mensagens do fluxo.

O motivo: **mesmo bug de parâmetro** que corrigimos no `auto-close-conversations`. No webhook, os blocos de financial exit e commercial exit usam `phone: senderPhone` — mas o `send-meta-whatsapp` espera `phone_number`. A chamada falha silenciosamente (400), a mensagem é salva no banco (aparece na UI) mas nunca chega ao WhatsApp.

**20 ocorrências** de `phone: senderPhone` (errado) no webhook, contra 15 ocorrências corretas de `phone_number: fromNumber`.

Adicionalmente, o bloco comercial principal (linhas 1290-1305) e o fallback comercial (linhas 1401-1416) ainda usam `fetch` direto para a Graph API em vez de `send-meta-whatsapp` — escaparam da correção anterior.

## Correções

### 1. Corrigir `phone` → `phone_number` em todas as chamadas `send-meta-whatsapp`
- **Arquivo**: `supabase/functions/meta-whatsapp-webhook/index.ts`
- 20 ocorrências nas linhas: 1086, 1147, 1194, 1360
- Trocar `phone: senderPhone` por `phone_number: senderPhone`

### 2. Substituir `fetch` direto por `send-meta-whatsapp` nos blocos comerciais restantes
- Linhas 1290-1305 (commercial exit principal)
- Linhas 1401-1416 (commercial fallback)
- Usar `supabase.functions.invoke("send-meta-whatsapp", ...)` com `skip_db_save: true`

### Sem risco de regressão
- Apenas corrige nomes de parâmetros para alinhar com o contrato do `send-meta-whatsapp`
- Substitui `fetch` direto pelo serviço centralizado (padrão já validado no resto do pipeline)

