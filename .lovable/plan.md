

# Auditoria Completa — Últimas 3 Horas (21:14 – 00:25)

## Resumo Executivo

**13 conversas analisadas** | **5 problemas críticos** | **4 alertas** | **4 OK**

---

## Conversa por Conversa

### ✅ OK — Conversas sem problemas

| # | Cliente | Nó | Resultado |
|---|---------|-----|-----------|
| 1 | Derli (4d9388a9) | Menu produto | Abandono natural — cliente não respondeu ao menu. Encerrado por inatividade. Correto. |
| 2 | Edileno (a0549174) | Consultor | IA detectou pedido complexo ("enviar 12 peças restantes"), encaminhou para consultor. Correto — IA não tinha como resolver. |
| 3 | Bruno Rocha (a28334cc) | Dúvidas | IA respondeu com artigo RAG ("Publicar Catálogo"), cliente não ficou satisfeito, pediu atendente. Handoff correto após 4 interações. |
| 4 | Magda Alves (94aab02f) | Pedidos | IA consultou pedido 16448354, trouxe dados reais (rastreio AN627118702BR). Cliente perguntou sobre prazo — IA atingiu max_interactions (5) e fez handoff. Correto. |

---

### 🔴 CRÍTICO — Problemas Graves

#### 1. Hyan (78c37575) — IA NÃO RESPONDEU ao cliente comercial
- **Nó:** `node_ia_comercial`
- **Problema:** Cliente mandou 3 mensagens detalhadas sobre catálogo fitness masculino, embalagens personalizadas, modelo de trabalho. A IA NUNCA respondeu a nenhuma delas.
- **Timeline:**
  - 00:13:17 — IA: "Sou Hunter... Como posso te ajudar?"
  - 00:13:43 — Cliente: pergunta sobre catálogo fitness
  - 00:16:14 — Cliente: pergunta detalhada sobre embalagens e estoque
  - 00:18:18 — Cliente: "vocês tem essa camisa?"
  - 00:19:26 — Cliente: "Mas eu já falei."
  - 00:20:20 — Cliente: "6" (tentou menu de desespero)
  - 00:20:23 — Sistema: menu escape → handoff
- **Diagnóstico:** A IA ficou muda por 7 minutos. As mensagens do cliente estão no banco mas ZERO respostas IA entre 00:13:17 e 00:20:23. O `ai_events` mostra `zero_confidence_cautious` — a IA não encontrou artigos RAG e ficou cautelosa demais.
- **Evento:** `ai_decision_zero_confidence_cautious` (00:20:11) + `ai_transfer max_interactions` (00:20:22)
- **Impacto:** Lead comercial qualificado PERDIDO. Cliente frustrado.

#### 2. Fabiana (bbbe48fe) — IA NÃO RESPONDEU e encerrou por inatividade
- **Nó:** `node_ia_sistema`
- **Problema:** Cliente perguntou 3x sobre cores de copos térmicos Bluetooth. IA NUNCA respondeu.
- **Timeline:**
  - 22:50:34 — IA: "Sou Helper Sistema... Como posso te ajudar?"
  - 22:50:53 — Cliente: "cores dos copos térmicos"
  - 22:54:08 — Cliente: "cores que vocês tem em estoque"
  - 22:57:11 — Cliente: "Estoque de copos térmicos com Bluetooth"
  - 23:10:08 — Sistema: encerrou por inatividade (!!!)
- **Diagnóstico:** IA ficou MUDA por 20 minutos, depois o auto-close encerrou a conversa. Provavelmente mesmo bug de `zero_confidence` — sem artigos RAG, a IA não gerou resposta. Nenhum ai_event registrado para esta conversa nas últimas 3h.
- **Impacto:** Cliente ativo abandonado sem resposta alguma.

#### 3. Anderson (c1225361) — IA travou no cancelamento sem resolver
- **Nó:** `node_ia_financeiro` → `node_ia_cancelamento`
- **Problema:** Cliente pediu cancelamento. IA redirecionou para nó de cancelamento (`forbidCancellation` ativou `cancellation_blocked`), mas depois ficou MUDA.
- **Timeline:**
  - 00:05:50 — IA: "Sou Helper Financeiro..."
  - 00:07:05 — Cliente: "quero cancelar"
  - 00:07:24 — IA: "Sou Helper Cancelamento..." (mudou de nó — correto)
  - 00:07:33 — Cliente: "como faço para cancelar?"
  - 00:09:03 — Cliente: "Cancelar"
  - 00:10:23 — Cliente: "Cancelar"
  - 00:20:07 — Sistema: encerrou por inatividade (!!!)
- **Diagnóstico:** Após mudar para `node_ia_cancelamento`, a IA ficou muda. O `ai_events` mostra `ai_blocked_cancellation` + `cancellation_blocked` exit. O nó de cancelamento provavelmente tem `forbidCancellation: true` que bloqueou a resposta da IA, mas o handoff para humano NÃO foi executado corretamente — a conversa ficou em `autopilot` sem resposta até o auto-close.
- **Avaliação do cliente:** ⭐ 1/5
- **Impacto:** Cliente quer cancelar, foi ignorado por 13 minutos.

#### 4. Edson (8b4b0ae7) — IA ficou muda, cliente frustrado
- **Nó:** `node_ia_duvidas`
- **Problema:** Cliente perguntou sobre imagens indisponíveis no site. IA nunca respondeu.
- **Timeline:**
  - 21:55:40 — IA: "Sou Laís... Como posso te ajudar?"
  - 21:56:14 — Cliente: "Porque tem produtos com imagem não disponível?"
  - 22:05:11 — Cliente: "Como vou saber qual produto?"
  - 22:06:46 — Cliente: "Suporte horrível"
  - 22:07:29 — Cliente: "Falar com atendente" → handoff
- **Diagnóstico:** IA ficou muda por 12 minutos. Provavelmente `zero_confidence` novamente.
- **Impacto:** Cliente explicitamente chamou o suporte de "horrível".

#### 5. Ezequias (7aded61b) — IA ficou muda, lead comercial perdido
- **Nó:** `node_ia_comercial`
- **Problema:** Interessado em vender no Mercado Livre, mandou 4 mensagens. IA nunca respondeu.
- **Timeline:**
  - 22:47:02 — IA: "Sou Hunter... Como posso te ajudar?"
  - 22:47:47 — Cliente: "Gostaria de vender produtos no mercado livre"
  - 22:48:37 — Cliente: "Quais produtos você tem?"
  - 22:48:42 — Cliente: "Para vender"
  - 22:49:35 — Cliente: "Vendas de produtos" → menu escape → handoff
- **Diagnóstico:** IA muda por 2.5 minutos. Zero confidence comercial.
- **Impacto:** Outro lead comercial perdido.

---

### ⚠️ ALERTAS

#### 1. Eude (0da725ed) — IA respondeu sobre cancelamento no nó errado
- **Nó:** `node_ia_consultor`
- O cliente escolheu "Falar com meu consultor" (opção 6) e pediu "quero cancelar". A IA estava no nó de consultor mas respondeu com instruções de cancelamento Kiwify (link de reembolso). Tecnicamente a informação é útil, mas o nó era de consultor — a IA deveria ter feito handoff para o consultor tratar o cancelamento.

#### 2. route-conversation ERROR
- Erro nos logs: `operator does not exist: uuid && unknown`
- Conversa: 94aab02f (Magda Alves) — departamento "Suporte Pedidos"
- O dispatch job ficou `pending` sem agente atribuído. Bug no SQL do route-conversation ao buscar agentes com `.overlaps()` em campo UUID.

#### 3. Gabriel Saldanha (8f3c0f75) — IA ficou muda no nó de sistema
- Nó: `node_ia_sistema` — cliente reportou cobrança indevida após cancelamento de assinatura.
- IA ficou muda por ~3.5 minutos até o cliente pedir atendente.
- Menos grave porque o handoff aconteceu rápido.

#### 4. Claudemir (e171a782) — Fluxo de cancelamento confuso
- IA respondeu "Vou direcionar para o setor responsável" mas logo após apareceu menu escape sem opções de transferência direta. O cliente respondeu "Não quero mais pagar" e recebeu "Desculpe, não entendi" em vez de ser transferido.

---

## Diagnóstico Global: IA MUDA (zero_confidence_cautious)

**5 de 13 conversas** tiveram o mesmo problema: a IA enviou a saudação inicial mas NUNCA respondeu às mensagens seguintes do cliente. O padrão é:

1. Cliente navega no menu normalmente
2. IA envia greeting do nó ("Sou Hunter/Helper/Laís...")
3. Cliente faz pergunta real
4. **IA FICA MUDA** — nenhuma resposta por 3-20 minutos
5. Cliente fica frustrado e pede atendente ou abandona

O `ai_events` confirma: `zero_confidence_cautious` — quando a IA não encontra artigos relevantes na base de conhecimento (RAG), ela entra em modo cauteloso e NÃO responde nada.

---

## Plano de Correção

### Fix 1: Zero Confidence NÃO pode significar silêncio total
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Quando `zero_confidence_cautious` é detectado, a IA atualmente retorna sem enviar mensagem. Deveria:
- Enviar resposta genérica baseada no contexto do nó (comercial, sistema, dúvidas)
- Após 2 tentativas sem RAG, oferecer o menu escape (voltar ao menu / falar com atendente)
- Registrar telemetria para monitoramento

### Fix 2: Cancelamento bloqueado deve fazer handoff imediato
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Quando `cancellation_blocked` dispara no `node_ia_cancelamento`, o sistema deveria fazer handoff para humano imediatamente em vez de ficar mudo. O `forbidCancellation` está impedindo a IA de responder mas não está transferindo.

### Fix 3: route-conversation UUID operator error
**Arquivo:** `supabase/functions/route-conversation/index.ts`

O erro `operator does not exist: uuid && unknown` indica uso de `.overlaps()` em campo UUID. Trocar para `.in()` conforme convenção do projeto.

### Arquivos a alterar
1. `supabase/functions/ai-autopilot-chat/index.ts` — Fix 1 (zero confidence response) + Fix 2 (cancellation handoff)
2. `supabase/functions/route-conversation/index.ts` — Fix 3 (UUID operator)

