
Objetivo: auditar e fechar 100% o comportamento do primeiro nó (entrada IA), eliminando qualquer saída prematura.

Diagnóstico da auditoria (estado atual)

1) O primeiro nó efetivo do fluxo ativo (e44da799...) NÃO é a IA
- O motor escolhe o primeiro nó sem aresta de entrada.
- Hoje existem 2 raízes: `start` e `welcome_ia`.
- Como `start` vem primeiro no array, ele é o nó inicial real.
- Caminho atual do `start`: `start -> 1769459229369 (condition) -> else -> 1769459318164 (ask_options)`.
- Resultado: o caminho `welcome_ia -> ia_entrada` fica bypassado no início.

2) Se a IA for alcançada, a saída dela está estruturalmente incompleta
- `ia_entrada -> 1772133662928 (condition inactivity)`.
- Esse nó tem apenas aresta `true -> end`, sem `false/else`.
- Em mensagem normal (usuário ativo), path tende a `false`; sem aresta, o fluxo pode encerrar de forma inesperada.

3) Bug crítico no `ai-autopilot-chat` (ainda no nó de entrada)
- No bloco de fallback com `flow_context`, a função limpa frases e dá `return` imediato.
- Esse retorno acontece antes do pipeline padrão de persistir/enviar resposta.
- Efeito: pode “sumir resposta” (sensação de abandono), mesmo com status de sucesso.

4) Bug latente no bypass do Strict RAG com `flow_context`
- Quando `strictResult.shouldHandoff=true` e `flow_context` existe, o handoff é ignorado (correto),
  mas o fluxo continua tentando usar `strictResult.response` (que pode ser `null`).
- Isso pode gerar erro de insert de mensagem (`content` obrigatório) e disparar fallback de saída no webhook.

5) Regras ainda agressivas para “pedido humano”
- `EXPLICIT_HUMAN_REQUEST_PATTERNS` contém padrão amplo (`/atendente\s*(humano)?/i`).
- `exit_keywords` do nó também inclui termos isolados (`atendente`, `transferir`, `consultor`).
- Isso ainda pode causar saída precoce por falso positivo sem pedido realmente explícito.

Plano de correção (prioridade 1)

Fase A — Corrigir motor IA (sem alterar UX)
1. Ajustar bloco fallback-clean no `ai-autopilot-chat`:
- Remover `return` precoce no branch com `flow_context`.
- Manter limpeza de texto, mas seguir para persistência/envio normal da resposta.
- Preservar o anti-fallthrough encapsulando o handoff real apenas no branch “sem flow_context”.

2. Blindar Strict RAG com `flow_context`:
- Se `shouldHandoff=true` com fluxo ativo, NÃO usar `strictResult.response` diretamente.
- Fazer fallback explícito para geração normal (persona/contexto) ou resposta segura não nula.
- Garantir que nunca chegue `content=null` no insert de mensagem.

3. Endurecer saída apenas por pedido humano explícito:
- Trocar padrões amplos por frases intencionais (“quero falar com humano”, “me transfere para atendente”).
- No `process-chat-flow`, preferir match por frase/token completo para `exit_keywords` (não substring solta).

Fase B — Corrigir o desenho do fluxo ativo (e44da799...)
4. Garantir entrada soberana da IA:
- Unificar raiz de entrada (apenas `start`).
- Conectar `start` ao roteamento inicial correto para cair em `welcome_ia -> ia_entrada` no caminho padrão (else/default).

5. Corrigir pós-saída da IA:
- No nó `1772133662928` (inactivity), adicionar aresta `false` para o próximo nó operacional (menu/triagem), não encerrar.
- Manter `true -> end` para timeout real.

Fase C — Validação de aceite
6. Checklist de validação (obrigatório):
- Caso “saudação” no primeiro contato: entra no nó IA, responde e permanece.
- Caso “sem KB”: responde cauteloso, sem avançar nó.
- Caso “fallback phrase”: resposta é limpa, salva e enviada (sem handoff).
- Caso “pedido humano explícito”: avança corretamente para próximo nó de fluxo.
- Caso “financeiro/comercial” com trava ativa: sai apenas pela regra configurada.
- Confirmar nos logs que não há `forceAIExit` indevido nem inserts com `content null`.

Resultado esperado após execução
- O primeiro nó IA volta a ser realmente o ponto de entrada.
- A IA não abandona prematuramente.
- Saída do nó só ocorre pelos gatilhos legítimos (pedido explícito, max interactions, travas configuradas).
