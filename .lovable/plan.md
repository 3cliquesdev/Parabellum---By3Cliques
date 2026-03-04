

# Plano: Corrigir IA fabricando linguagem de transferência sem executar

## Problema raiz

A IA dentro do nó `ai_response` do fluxo está gerando mensagens como **"Vou te direcionar para nosso menu de atendimento"** — texto que simula uma transferência mas NÃO executa nenhuma ação real. O cliente fica confuso achando que vai ser transferido, mas nada acontece.

A causa: a lista `ESCAPE_PATTERNS` no `ai-autopilot-chat` não inclui variantes como "direcionar", "redirecionar", "conectar com", "encaminhar para", etc. Só pega "transferir" e "encaminhar" em formas específicas.

## Solução (2 arquivos)

### 1. `supabase/functions/ai-autopilot-chat/index.ts` — Expandir ESCAPE_PATTERNS

Adicionar padrões que a IA usa para simular transferência sem executar:

```typescript
const ESCAPE_PATTERNS = [
  /vou te transferir/i,
  /vou transferir voc[êe]/i,
  /vou encaminhar/i,
  /vou te direcionar/i,          // NOVO
  /vou direcionar voc[êe]/i,     // NOVO
  /vou te redirecionar/i,        // NOVO
  /vou te conectar/i,
  /vou conectar voc[êe]/i,       // NOVO
  /aguarde.*atendente/i,
  /estou.*transferindo/i,
  /estou.*direcionando/i,        // NOVO
  /estou.*encaminhando/i,        // NOVO
  /estou.*redirecionando/i,      // NOVO
  /vou chamar.*especialista/i,   // NOVO
  /vou chamar.*atendente/i,      // NOVO
  /escolha uma das op[çc][õo]es/i,
  /selecione uma op[çc][ãa]o/i,
  /1️⃣|2️⃣|3️⃣|4️⃣|5️⃣/,
  /qual.*prefere\?/i,
  /menu de atendimento/i,        // NOVO — exatamente o caso do screenshot
  /encontrar.*especialista/i,    // NOVO
];
```

### 2. `supabase/functions/ai-autopilot-chat/index.ts` — Reforçar system prompt no flow_context

No prompt do sistema que é enviado quando `flow_context` existe, adicionar instrução explícita:

```
PROIBIDO: Você NÃO pode dizer que vai transferir, direcionar, encaminhar ou conectar o cliente com ninguém.
Você NÃO pode mencionar "menu de atendimento", "especialista", ou "atendente".
Você SÓ responde com informação. Quem decide transferências é o FLUXO, não você.
```

Isso ataca o problema na raiz (prompt) e na validação (ESCAPE_PATTERNS).

## Impacto
- **Zero regressão**: apenas adiciona mais padrões de detecção e reforça prompt
- **Upgrade**: IA não pode mais fabricar linguagem de transferência dentro de um fluxo
- **1 arquivo**: `ai-autopilot-chat/index.ts` (ESCAPE_PATTERNS + system prompt)

