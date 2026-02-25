

# Plano: Criar Fluxo Rascunho com IA Persistente para Suporte

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Estratégia

Criar um **novo fluxo rascunho** (`is_active: false`) independente do Master Flow, com a seguinte estrutura simplificada para teste:

```text
Start
  |
  v
Boas-vindas (message)
  "Oi! Sou a IA de suporte da 3 Cliques.
   Posso te ajudar com duvidas sobre sistema,
   acesso, pedidos e mais. Me conta o que precisa!"
  |
  v
IA Suporte (ai_response - PERSISTENTE)
  - ai_persistent: true
  - max_ai_interactions: 10
  - exit_keywords: ["atendente","humano","transferir","falar com alguem"]
  - use_knowledge_base: true
  - use_customer_data: true
  - use_tracking: true
  - persona: Helper
  - objective: "Resolver duvidas de suporte do cliente sobre sistema, acesso, pedidos e assuntos gerais antes de transferir para humano"
  - max_sentences: 4
  - forbid_options: true
  - fallback: "Nao consegui resolver essa questao. Vou te transferir para um especialista!"
  |
  v
Transfer Suporte (transfer)
  - department: Suporte Sistema (fd4fcc90...)
```

## Como testar

1. Abrir uma conversa no inbox
2. Clicar no botao de teste (frasco)
3. Selecionar o rascunho na lista
4. O fluxo envia a mensagem de boas-vindas ao cliente
5. O cliente responde, e a IA tenta resolver usando a KB
6. Se o cliente pedir "atendente" ou atingir 10 interacoes, transfere automaticamente

## Detalhamento tecnico

### Acao unica: INSERT na tabela `chat_flows`

Inserir um novo registro com `is_active: false` (rascunho) contendo o `flow_definition` JSON com 4 nos e 3 edges:

| No | Tipo | Funcao |
|---|---|---|
| `start` | `input` | Inicio do fluxo |
| `welcome_msg` | `message` | Mensagem de boas-vindas |
| `ai_suporte` | `ai_response` | IA persistente (loop ate resolver ou escalar) |
| `transfer_suporte` | `transfer` | Transfere para Suporte Sistema |

### Impacto

| Regra | Status |
|---|---|
| Regressao zero | Sim — e um INSERT novo, nao altera o fluxo principal |
| Kill Switch | Preservado — motor valida kill switch antes de executar |
| Fluxo principal | Intocado — rascunho so executa via trigger manual |
| Rollback | Deletar o registro do rascunho |

