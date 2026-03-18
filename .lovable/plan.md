

# Auditoria do Sistema — 2026-03-18 02:58 UTC

## Conversa Ativa Analisada: 92a9624f (Gabriel Coelho Contato)

```text
02:53:32  Cliente: "1" → Drop Nacional
02:53:47  Cliente: "1" → Pedidos (roteado para node_ia_pedidos) ✅
02:54:31  Cliente: "subi uma etiqueta errada no pedido 16565212"
          → Tracking bypass: pedido encontrado, dados retornados ✅ (6.3s)
02:55:36  Cliente: "Eu enviei a etiqueta de envio errada"
          → KB: 2 artigos (70.7%, 67.6%) — NÃO cobrem o problema real
          → Saudação proativa enviada ✅
          → LLM gpt-5-mini chamada → VAZIO
          → Retry com prompt reduzido → VAZIO
          → FALLBACK: "Não consegui resolver por aqui." ❌
```

---

## Bug 1: LLM Retorna Vazio para Pergunta Legítima (CRÍTICO)

**Problema**: "Eu enviei a etiqueta de envio errada" é uma pergunta real, não greeting. Os 2 artigos da KB encontrados ("primeira venda preciso enviar etiqueta" e "vendendo em site próprio como faço envios") tratam de envio de etiquetas **corretas** — nenhum cobre o cenário de etiqueta **errada**. O LLM não consegue formular resposta a partir de artigos irrelevantes ao problema e retorna vazio.

**Causa raiz**: GAP na Base de Conhecimento. Não existe artigo sobre "etiqueta de envio errada" ou "troca de etiqueta".

**Causa secundária**: Quando o LLM não tem KB suficiente, deveria responder com algo como "Entendo que enviou a etiqueta errada. Para resolver isso, preciso transferir para nossa equipe de Pedidos." — mas o prompt restritivo do nó proíbe respostas fora da KB, e o LLM interpreta como "melhor não responder nada".

**Fix proposto (código)**: No `ai-autopilot-chat`, quando a LLM retorna vazio E existem artigos da KB (score > 0) E `flow_context` está ativo, em vez de usar o `fallbackMessage` genérico do nó, gerar uma resposta contextual: "Não encontrei informações específicas sobre isso na base de conhecimento. Posso transferir para um atendente especializado, ou deseja tentar descrever a situação de outra forma?"

**Fix proposto (KB)**: Criar artigo na Base de Conhecimento cobrindo "etiqueta de envio errada / troca de etiqueta" com instruções de como proceder.

---

## Bug 2: Loop Infinito de Reconciliação de Órfãos (MÉDIO)

**Problema**: 11 conversas `waiting_human` + `open` + `assigned_to=null` estão sendo reconciliadas a cada CRON cycle (cada 60s). O `dispatch-conversations` cria dispatch jobs `pending`, que são imediatamente processados e completados (sem agentes disponíveis às 3h da manhã). No próximo ciclo, não há job `pending`/`escalated` → cria novamente. Loop infinito.

**Impacto**: ~22 INSERTs desnecessários por minuto + log noise. Não afeta o cliente, mas desperdiça recursos.

**Conversas afetadas** (todas de 17/Mar, horário comercial já encerrado):
- 5x departamento `fd4fcc90` (provavelmente Suporte)
- 2x `b7149bf4`, 2x `2dd0ee5c`, 1x `f446e202`, 1x `36ce66cd`

**Fix proposto**: No bloco de reconciliação do `dispatch-conversations`, adicionar verificação: se já existe um job `completed` para esta conversa criado nos últimos 30 minutos, **não criar novo job**. Isso interrompe o loop sem perder a proteção contra órfãos reais.

---

## Bug 3: `skipInitialMessage` — Validação

O `skipInitialMessage` **não foi testado nesta conversa** porque o roteamento de `ask_options → ai_response` ocorreu normalmente (linha 31: "selected=Pedidos input=1"). O dígito "1" ainda foi bufferizado (linha 51 do webhook: "Message buffered: 67bbd9d0") e chegou ao autopilot, mas o `skipLLMForGreeting` atuou como rede de segurança. O `skipInitialMessage` precisa de teste em produção com o caminho de intent-routing.

---

## Resumo de Saúde

| Item | Status |
|------|--------|
| Fluxo de menus | ✅ Funcionando |
| Tracking bypass | ✅ Funcionando (6.3s) |
| Saudação proativa | ✅ Enviada sem duplicidade |
| skipLLMForGreeting | ✅ Ativo como rede de segurança |
| LLM vazio para perguntas reais | ❌ Bug ativo |
| Reconciliação órfãos em loop | ⚠️ Loop infinito (baixo impacto) |
| Dispatch de agentes | ✅ Sem jobs pendentes (fora de horário) |
| CRON buffered-messages | ✅ Processando normalmente |

---

## Plano de Correção

### 1. `ai-autopilot-chat` — Fallback inteligente quando LLM retorna vazio com KB disponível
Quando LLM retorna vazio após retries, em vez de usar `fallbackMessage` genérico, verificar:
- Se `articles_found > 0` e `hasFlowContext`: gerar resposta contextual oferecendo transferência
- Se `articles_found === 0`: manter fallback atual

### 2. `dispatch-conversations` — Cooldown na reconciliação
Adicionar check: se já existe job `completed` para a conversa criado em `< 30 min`, skip.

### 3. Deploy
Deploy de `ai-autopilot-chat` e `dispatch-conversations`.

