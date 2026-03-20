

# Auditoria Completa da IA — 19/Mar 15h até agora

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Total conversas encerradas** | 180 |
| **Encerradas por `ai_inactivity`** | 64 (35.5%) |
| **Encerradas manualmente (agentes)** | 110 (61%) |
| **Mensagens "Alta demanda" enviadas** | 44 |
| **Conversas órfãs (waiting_human sem dispatch)** | 0 |
| **IA encerrou sozinha sem confirmação** | 0 |
| **Conversas onde IA nunca respondeu** | 20 |

---

## BUG CRÍTICO 1: "Estou com alta demanda" — 44 ocorrências

A IA enviou **44 vezes** a mensagem de erro genérica _"Estou com alta demanda no momento. Por favor, tente novamente em alguns instantes."_ — concentradas entre **11h e 13h de hoje (20/Mar)**:

- 11:00-12:00 → **17 mensagens**
- 12:00-13:00 → **27 mensagens**

**Impacto direto:** 5 dessas conversas foram posteriormente encerradas por `ai_inactivity` porque o cliente não respondeu à mensagem de erro (e a IA ficou parada):
- Eliane Heronice — 1 estrela implícita
- Anab Monteiro — avaliou **1/5 estrelas**
- Joadisson — cliente respondeu "Ok" e foi ignorado
- MARCIO DE MELO — estava pedindo pausa na mensalidade
- Day — avaliou **1/5 estrelas**

**Causa raiz:** Esta mensagem é do **error catch block** do `ai-autopilot-chat` — indica que a chamada à LLM falhou (timeout, rate limit, ou erro de API). Não é "alta demanda real", é uma falha silenciosa que está sendo mascarada como mensagem amigável.

**Correção necessária:** O fallback de erro precisa ser mais inteligente — em vez de enviar essa mensagem e abandonar o cliente, deveria:
1. Fazer retry automático (1x com delay de 3s)
2. Se falhar novamente, transferir para humano em vez de enviar mensagem genérica

---

## BUG CRÍTICO 2: IA nunca respondeu — 20 conversas

20 conversas foram encerradas por `ai_inactivity` **sem a IA ter enviado uma única mensagem**. Exemplos:

| Contato | Primeira msg | Problema |
|---------|-------------|----------|
| Lisanias (3x) | "Obrigado", "Estou respondendo agora", "Bom dia" | IA muda |
| Fábio Oliveira | Enviou PDF | IA não processou |
| Beatriz Rosa (2x) | "Olá! Concluí o onboarding" | IA muda |
| CELSO RICARDO | "Olá! Concluí o onboarding" | IA muda |
| Carla Takemoto | "Olá! Concluí o onboarding" | IA muda |

**Padrão:** Muitas dessas são mensagens vindas de **onboarding automático** ("Olá! Concluí o onboarding do Armazém Drop") e a IA não respondeu nada. O fluxo pode estar falhando silenciosamente para esse tipo de entrada.

---

## BUG 3: ai_decision — 88 eventos de falha

| Tipo de Decisão | Qtd | Significado |
|-----------------|-----|-------------|
| `fallback_phrase_detected` | 49 | IA não soube responder, usou fallback |
| `zero_confidence_cautious` | 36 | Confiança zero, nenhum artigo na KB |
| `confidence_flow_advance` | 3 | Avançou no fluxo por falta de confiança |

**85 de 88** (96.6%) tiveram `articles_found: 0` — a base de conhecimento não retornou nenhum artigo relevante para essas perguntas.

---

## POSITIVO: O que está funcionando

- **0 conversas órfãs** — todas em `waiting_human` têm dispatch job ativo
- **0 encerramentos indevidos pela IA** — nenhum `conversation_closed_by_ai` no período
- **Transferências funcionando** — todas as transições `handoff_to_human` registradas corretamente via `state_transition`
- **Encerramentos manuais** — 110 conversas encerradas corretamente por agentes (copilot)

---

## Plano de Correção

### 1. Error Handler do `ai-autopilot-chat` — Retry + Handoff

No catch block que envia "alta demanda":
- Adicionar **1 retry automático** com delay de 3 segundos antes de desistir
- Se o retry também falhar, **transferir para humano** (`waiting_human`) em vez de enviar mensagem genérica e abandonar
- Registrar evento `ai_error_llm_failure` na `ai_events` para monitoramento

### 2. Investigar mensagens de onboarding sem resposta

As 20 conversas onde a IA ficou muda precisam de investigação no webhook — pode ser que mensagens tipo "Olá! Concluí o onboarding" não estejam acionando o fluxo corretamente (possivelmente sendo filtradas como mensagens automáticas/bot).

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Retry no error catch + handoff em vez de msg genérica |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Investigar filtros de mensagens de onboarding |

