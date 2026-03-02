

# Diagnóstico: IA não ajudou com pedidos — transferiu direto

## Causa Raiz

A conversa foi interceptada pelo **Modo RAG Estrito** (`ai_strict_rag_mode = true`), não pela trava comercial ou financeira.

O fluxo foi:
1. Cliente enviou "Solicito prioridade de envio nos pedidos abaixo: 16466201, 16468408..."
2. O Autopilot buscou artigos na KB com ≥80% de confiança
3. Nenhum artigo de KB cobria "prioridade de envio" → `shouldHandoff: true`
4. Strict RAG disparou handoff automático com a mensagem fixa: *"Para te ajudar da melhor forma com essa questão específica, vou te conectar com um de nossos especialistas."*

**O problema**: O Strict RAG trata QUALQUER pergunta sem artigo KB como "IA não sabe → transferir humano". Isso inclui pedidos/logística, que a IA **poderia** resolver se tivesse acesso ao tracking/CRM, mas o Strict RAG nem tenta — faz handoff antes de consultar outras fontes.

## Opções de Solução

### Opção A — Excluir temas de pedidos/tracking do Strict RAG
Quando a mensagem é detectada como `tracking` (pelo `classifyTopic`), pular o Strict RAG e deixar o autopilot normal processar com acesso a KB + CRM + Tracking.

**Alteração**: No bloco do Strict RAG (~linha 4060), adicionar condição:
```
const topic = classifyTopic(customerMessage);
const skipStrictForTracking = ['tracking'].includes(topic);

if (isStrictRAGMode && !skipStrictForTracking && OPENAI_API_KEY && knowledgeArticles.length > 0) {
  // Strict RAG normal
}
```

### Opção B — Adicionar artigos de KB sobre pedidos/envio
Criar artigos na base de conhecimento cobrindo "prioridade de envio", "rastreio de pedido", etc. O Strict RAG passaria a encontrar artigos relevantes e responderia sem handoff.

**Sem alteração de código** — apenas conteúdo na KB.

### Opção C — Desativar Strict RAG globalmente
Voltar ao modo normal onde a IA tenta responder com todas as fontes disponíveis (KB + CRM + Tracking) e só faz handoff se o cliente pedir explicitamente.

**Sem alteração de código** — apenas mudar `ai_strict_rag_mode` para `false` na tabela `system_configurations`.

## Recomendação

**Opção A** é o melhor upgrade: mantém o Strict RAG para perguntas gerais (evita alucinação) mas permite que pedidos/tracking sejam processados normalmente com acesso às fontes de dados operacionais.

