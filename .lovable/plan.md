

# Diagnóstico: IAs só transferem sem ajudar + sem roteamento cruzado entre Helpers

## Problemas Identificados

### 1. Triagem configurada para NUNCA ajudar
O objetivo do nó `IA Triagem` (node_4_ia_triagem) diz literalmente:
- "Identifique a intenção do cliente e **encaminhe imediatamente**"
- "**Nunca tente resolver**"
- "Se a intenção estiver clara, encaminhe SEM fazer perguntas"

Isso faz a IA gerar `[[FLOW_EXIT:pedidos]]` na primeira mensagem sem tentar ajudar o cliente.

### 2. Nenhum nó V4 tem `forbid_*` flags ativados
Todos os 11 nós de IA do V4 Master têm TODOS os `forbid_*` como `null` (desativado):
- forbid_financial, forbid_commercial, forbid_cancellation, forbid_support, forbid_pedidos, forbid_devolucao, forbid_saque, forbid_consultant = todos `null`

Isso significa que o sistema de regex do `process-chat-flow` (que detecta intenções por palavras-chave) **nunca dispara** — só funciona quando `forbid_*` está `true`.

A única forma de exit é:
- A IA enviar `[[FLOW_EXIT:intent]]` voluntariamente
- Atingir `max_interactions` (4 na triagem, 4-6 nos helpers)

### 3. Helpers não fazem roteamento cruzado
Se o cliente está no Helper Pedidos e começa a falar de saque:
- O Helper Pedidos **não tem** `forbid_saque=true`
- A regex de saque não dispara
- A IA não tem instrução no prompt para fazer `[[FLOW_EXIT:saque]]`
- O helper fica preso tentando ajudar com pedidos até `max_interactions=5`
- Quando atinge o máximo, vai para a saída `default` → Transfer Suporte Pedidos (humano)
- O cliente **nunca chega** no Helper Saque

### 4. Helpers têm edges de roteamento cruzado, mas sem triggers
Os edges existem no canvas (ex: Helper Pedidos → Helper Devoluções via `devolucao`, Helper Suporte → Helper Financeiro via `financeiro`), mas como nenhum `forbid_*` está ativo, esses caminhos **nunca são usados**.

## Plano de Correção

### Fix 1 — Mudar objetivo da Triagem para AJUDAR antes de rotear
**Arquivo**: Atualização do nó `node_4_ia_triagem` no flow_definition do V4 Master

Novo objetivo:
```
Você é a assistente de triagem do atendimento 3 Cliques.
Primeiro, TENTE AJUDAR o cliente com a Base de Conhecimento.
Se a resposta está na KB, responda diretamente.
Se NÃO conseguir resolver ou o cliente precisar de ação específica,
identifique a intenção e encaminhe para o especialista certo.

QUANDO ENCAMINHAR (usar [[FLOW_EXIT:intent]]):
- Ação financeira (saque, reembolso, estorno) → [[FLOW_EXIT:saque]] ou [[FLOW_EXIT:financeiro]]
- Cancelar plano/assinatura → [[FLOW_EXIT:cancelamento]]
- Produto defeituoso/troca → [[FLOW_EXIT:devolucao]]
- Rastreio/status pedido → [[FLOW_EXIT:pedidos]]
- Bug/erro sistema → [[FLOW_EXIT:suporte_sistema]]
- Comprar/preço → [[FLOW_EXIT:comercial]]
- Falar com consultor → [[FLOW_EXIT:consultor]]

QUANDO NÃO ENCAMINHAR:
- Dúvidas informativas que a KB responde
- Saudações (responda normalmente)
- Perguntas gerais sobre como funciona algo
```

Também aumentar `max_interactions` de 4 para 8 e desativar `forbid_questions: false` para permitir perguntas de clarificação.

### Fix 2 — Ativar `forbid_*` flags nos nós de Triagem e Helpers (roteamento cruzado)

**Triagem** (node_4_ia_triagem): Ativar TODOS os forbid_* flags para que a regex do `process-chat-flow` funcione como backup do `[[FLOW_EXIT]]`:
- forbid_financial=true, forbid_commercial=true, forbid_cancellation=true, forbid_pedidos=true, forbid_devolucao=true, forbid_saque=true, forbid_support=true, forbid_consultant=true

**Helpers especializados**: Ativar forbid_* para temas FORA do seu escopo:
- Helper Pedidos: `forbid_saque=true`, `forbid_financial=true`, `forbid_cancellation=true`, `forbid_commercial=true`
- Helper Financeiro: `forbid_pedidos=true`, `forbid_commercial=true`, `forbid_cancellation=true`
- Helper Saque: `forbid_pedidos=true`, `forbid_commercial=true`, `forbid_cancellation=true`
- Helper Suporte: `forbid_saque=true`, `forbid_financial=true`, `forbid_cancellation=true`, `forbid_commercial=true` (já tem edges para esses destinos)
- etc.

Isso garante que quando o cliente muda de assunto dentro de um helper, o regex do motor detecta e roteia automaticamente.

### Fix 3 — Adicionar instrução de roteamento cruzado no prompt restritivo dos Helpers

Quando um Helper tem `forbid_*` flags ativos, adicionar ao prompt restritivo:
```
Se o cliente mudar de assunto para um tema fora do seu escopo,
responda: "Entendi! Vou te encaminhar para o especialista certo."
E retorne [[FLOW_EXIT:intent]] com a intenção detectada.
```

### Implementação

1. **Atualizar flow_definition do V4 Master** via SQL (UPDATE no jsonb) — mudar objectives e adicionar forbid_* flags em cada nó
2. **Atualizar `generateRestrictedPrompt`** no `ai-autopilot-chat` — adicionar travas para pedidos, devolução, saque, sistema e internacional (hoje só tem financial, cancellation, commercial e consultant)
3. **Aumentar `max_interactions`** da Triagem de 4 para 8

### Resultado Esperado
- Triagem tenta ajudar o cliente ANTES de rotear
- Se não conseguir, roteia para o especialista certo
- Se o cliente muda de assunto dentro de um helper, o helper detecta e roteia para outro helper
- Roteamento funciona por regex (backup) E por `[[FLOW_EXIT]]` (IA)

