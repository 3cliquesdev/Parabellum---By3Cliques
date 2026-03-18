

# Auditoria V8 Comportamental: Ultimas 2 Horas do Motor IA

## Dados Coletados (12:00-12:53 UTC)

| Metrica | Valor |
|---|---|
| Total mensagens IA | 264 |
| Mensagens do cliente | 665 |
| Saudacoes (greeting) | 97 (37%) |
| "Entendi! Poderia me dar mais detalhes" (generico) | 89 (34%) |
| "Nao consegui resolver por aqui" | 26 (10%) |
| Respostas substantivas reais | 34 (13%) |
| Transferencias | 8 (3%) |
| contract_violation_blocked | 79 |
| zero_confidence_cautious | 21 |
| anti_loop_max_fallbacks | 4 |

**A IA so deu respostas uteis reais em 13% dos casos. 34% foi fallback generico e 10% foi desistencia.**

---

## BUG 1 (CRITICO): Loop Auto-Infligido -- Fallback Inteligente Bloqueia a Si Mesmo

**Raiz do problema:** A mensagem de fallback inteligente (L7551) diz:
> "Nao encontrei informacoes especificas... Posso **transferir** voce para um **atendente especializado**..."

Essa frase contem "transferir...atendente especializado" que acerta o `ESCAPE_PATTERNS[1]` (L1432):
```
/(vou|irei|posso)\s+(te\s+)?(direcionar|redirecionar|transferir|encaminhar|conectar|passar)/i
```

**Sequencia do loop:**
1. LLM retorna vazio (KB sem resultado relevante)
2. Sistema gera fallback inteligente oferecendo transferencia
3. ESCAPE_PATTERNS detecta "Posso transferir" como violacao de contrato
4. Sistema substitui por "Entendi! Poderia me dar mais detalhes?" e incrementa `ai_node_fallback_count`
5. Cliente responde, LLM falha de novo, repete ciclo
6. Apos 2 fallbacks → `anti_loop_max_fallbacks` → "Nao consegui resolver por aqui" → handoff forcado

**Evidencia:** 79 `contract_violation_blocked` em 2h, TODOS com `blocked_preview: "Nao encontrei informacoes especificas sobre isso na base de conhecimento. Posso transferir voce..."` -- e a propria mensagem do sistema sendo bloqueada.

**Fix:** Gerar o fallback inteligente DEPOIS do escape check, ou usar uma frase que nao acerte os patterns (ex: remover "transferir" e usar "conectar com a equipe" sem "posso"):
```typescript
assistantMessage = 'Nao encontrei informacoes especificas sobre isso. Quer que eu te conecte com a equipe de suporte, ou pode descrever a situacao de outra forma?';
```
Alternativa: skip o escape check quando `isEmptyAIResponse = true` (a mensagem foi gerada pelo sistema, nao pela LLM).

---

## BUG 2 (CRITICO): Greeting Proativo Gera Dupla Mensagem

**Evidencia em multiplas conversas:**
- Conv `a0a9b8a6`: "Ola! Sou Helper Pedidos..." + "Entendi! Poderia me dar mais detalhes?" (2 msgs em 12s)
- Conv `1909e5b5`: "Ola! Sou Lais..." + "Entendi! Poderia me dar mais detalhes?" (10s)
- Conv `162ef824`: "Ola! Sou Lais..." + "Entendi! Poderia me dar mais detalhes?" (11s)

**Causa:** Quando `isProactiveGreeting=true`, o `customerMessage` e substituido por `[SYSTEM: O cliente acabou de chegar...]`. A LLM gera uma saudacao, mas essa resposta contem elementos que acionam o `contract_violation_blocked` (oferta de opcoes, perguntas com emojis). O sistema bloqueia, substitui por fallback generico, e duas mensagens vao pro WhatsApp: a saudacao + o fallback.

**Fix:** Quando `isProactiveGreeting=true`, pular validacao de escape patterns e restriction check, ja que a resposta e uma saudacao controlada.

---

## BUG 3 (MODERADO): Variavel `{{conversation_queue}}` Vazando pro Cliente

**Evidencia:**
> "Transferindo para um atendente... {{conversation_queue}}"

Mensagem enviada no conv `a0a9b8a6` as 12:51:47. A variavel nao foi interpolada pelo `replaceVariables()` no `process-chat-flow`.

**Fix:** Verificar se a variavel `conversation_queue` esta mapeada no resolver de variaveis do motor de fluxos. Se nao existir, remover do template do no de transferencia.

---

## BUG 4 (MODERADO): "Entendi sua situacao financeira" em Contextos Errados

**Evidencia:**
- Conv `162ef824`: Cliente diz "fiz o pagamento da mensalidade e **nao recebi o acesso**" → IA responde "Entendi sua situacao financeira. Pode me informar o e-mail..."
- Conv `1a5bb339`: Cliente quer "cancelar o plano Creation" → mesma resposta financeira

O `isFinancialRequest` (L7540) esta detectando "pagamento" e "cancelar" como financeiro, mas sao problemas de **suporte/acesso** e **cancelamento de assinatura**.

**Fix:** Refinar a regex de detecao financeira para exigir contexto mais especifico (reembolso, saque, boleto, cobranca duplicada) e nao acertar em "pagamento + acesso" ou "cancelar plano".

---

## BUG 5 (MODERADO): KB Retornando Artigos Irrelevantes

**Evidencia nos ai_events:**
- Cliente pergunta sobre pedido/estoque → KB retorna "Treinamento: Boa noite" (similarity ~0.40)
- Cliente quer cancelar assinatura → KB retorna "Como escolher um nicho lucrativo no dropshipping?"
- Artigos de treinamento sandbox ("Treinamento: Boa noite") aparecem em quase TODAS as buscas com score ~0.40

**Causa:** Artigos de `source=sandbox_training` com conteudo generico ("Boa noite") tem embeddings amplos que matcham com qualquer query. O threshold de similaridade nao esta filtrando esses resultados de baixa qualidade.

**Fix:** Aumentar threshold minimo de similaridade na RPC `match_knowledge_articles` (atualmente parece aceitar ~0.40, deveria ser >= 0.60 para resultados uteis). Ou excluir artigos de `sandbox_training` da busca principal e usa-los apenas para few-shot no prompt.

---

## BUG 6 (MENOR): Typo no Nome da Persona

"Assisntente IA" em vez de "Assistente IA" -- aparece em todas as saudacoes da persona Lais.

**Fix:** Corrigir o campo `name` da persona no banco de dados.

---

## Resumo dos Bugs por Prioridade

| # | Severidade | Bug | Impacto |
|---|---|---|---|
| 1 | CRITICO | Fallback inteligente bloqueia a si mesmo (79 vezes em 2h) | 34% das respostas sao fallback generico |
| 2 | CRITICO | Greeting proativo gera dupla mensagem | Experiencia ruim em todas as novas conversas |
| 3 | MODERADO | `{{conversation_queue}}` vazando pro cliente | Variable crua visivel |
| 4 | MODERADO | Deteccao financeira muito ampla | Clientes de suporte recebem fluxo financeiro |
| 5 | MODERADO | KB retornando artigos sandbox irrelevantes (score 0.40) | IA nao encontra informacoes uteis |
| 6 | MENOR | Typo "Assisntente" na persona | Visual |

## Plano de Correcoes

1. **Bug 1:** No bloco L7549-7551, trocar a frase do fallback inteligente para nao acertar ESCAPE_PATTERNS. OU: no bloco L9534-9535, adicionar guard `if (!isEmptyAIResponse)` para so checar escape em respostas reais da LLM.
2. **Bug 2:** No bloco L9534, adicionar guard `if (!isProactiveGreeting)` para pular escape check em saudacoes.
3. **Bug 3:** Localizar o no de transferencia no fluxo Jarvis que contem `{{conversation_queue}}` e remover ou mapear a variavel.
4. **Bug 4:** Refinar a logica `isFinancialRequest` para exigir termos mais especificos.
5. **Bug 5:** Ajustar threshold de similaridade ou filtrar artigos sandbox da busca principal.
6. **Bug 6:** UPDATE na tabela de personas para corrigir o typo.

