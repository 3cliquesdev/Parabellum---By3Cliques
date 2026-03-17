

# Investigação Conversa #735B0BA5

## Diagnóstico

**Conversa**: `735b0ba5-cf53-406c-9eb8-ce1311f92caa`
**Status**: open | ai_mode: autopilot | Nó atual: `node_ia_pedidos`
**Fallback count**: 2 (de 5 máximo)

### Fluxo da conversa:
1. Cliente: "Bom dia" → Fluxo inicia, boas-vindas
2. Cliente: "Nacional" → Selecionou Drop Nacional no menu produto
3. Cliente: "Pedidos" → Selecionou opção 1 no menu assunto → Entrou no nó `node_ia_pedidos`
4. **IA falhou**: A IA recebeu "Cliente selecionou: pedidos" mas retornou **conteúdo vazio** (rawAIContent vazio). O código caiu no fallback `flowFallbackMessage` = **"Não consegui resolver por aqui."** — que é a mensagem configurada no nó.
5. Cliente: "Oi" → Segunda tentativa. IA novamente retornou **conteúdo vazio** (0 artigos, score 0). Fallback detectado novamente.

### Causa raiz
A IA (gpt-5-mini) está retornando **respostas vazias** para mensagens genéricas ("Pedidos", "Oi") dentro do nó `node_ia_pedidos`. Isso faz o sistema cair na cadeia de fallback:
1. `rawAIContent` é vazio → usa `flowFallbackMessage` ("Não consegui resolver por aqui.")
2. Detector de fallback detecta essa frase (match pelo prefixo de 30 chars do `fallbackMessage` do nó)
3. Como tem `flow_context`, fica em `stay_in_node` (não faz handoff)
4. Incrementa `ai_node_fallback_count` (agora em 2)

### Problema real
A **fallback_message do nó** está configurada como **"Não consegui resolver por aqui."** — que é genérica demais e passa a impressão de incapacidade. A IA deveria estar respondendo normalmente com base na KB (tem 4 categorias: Logística e Pedidos, Atendimento e Suporte, FAQ, Operação e Processos), mas está retornando vazio.

Possíveis causas da resposta vazia:
- O `objective` inclui `{{produto}}` que deveria resolver para "Drop Nacional" — verificar se a interpolação está funcionando
- A KB pode não estar retornando artigos relevantes para queries genéricas como "Oi"
- O modelo pode estar sendo instruído de forma muito restritiva (allowed_sources: kb, crm, tracking apenas)

### O que aconteceria com mais tentativas
No fallback count 5, o anti-loop forçaria `flow_advance_needed`, que empurraria para o próximo nó (`node_escape_pedidos` — menu "Voltar ao menu / Falar com atendente").

## Sugestões de correção

### 1. Melhorar a fallback_message do nó (configuração no fluxo)
Trocar "Não consegui resolver por aqui." por algo mais útil:
> "Pode me dizer mais sobre o que precisa? Por exemplo: rastrear um pedido, trocar um produto ou tirar uma dúvida."

### 2. Investigar por que a IA retorna vazio
Verificar no código se o system prompt está sendo montado corretamente com o `objective` interpolado e se a KB está retornando artigos para queries curtas.

### 3. Reduzir threshold do anti-loop
Atualmente: 5 fallbacks antes de forçar avanço. Considerar reduzir para 3 para não travar o cliente.

---

**Resumo**: A IA está retornando vazio para o Helper Pedidos e caindo no fallback "Não consegui resolver por aqui." repetidamente. O cliente fica preso no nó sem ajuda real. Precisa investigar por que a IA não gera resposta (possível issue de prompt/KB) e melhorar a fallback_message para ser mais orientativa.

