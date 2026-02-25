

# Plano: Cópia do Fluxo Principal com IA na Entrada

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Conceito

Criar um **rascunho** (cópia inativa) do fluxo principal onde um nó de **IA Persistente** é inserido logo após o Start, **antes** de qualquer menu ou condição. A IA tenta resolver a dúvida do cliente direto. Se não conseguir, o fluxo segue normalmente para a triagem por menus (já é cliente? → qual produto? → etc.).

```text
FLUXO ATUAL:
Start → Condição (Onboarding/Carnaval/Outros) → Menus → Transfer

FLUXO NOVO (RASCUNHO):
Start → Boas-vindas → IA Persistente (tenta resolver)
                          │
                          ├─ Resolveu? → Encerra naturalmente
                          │
                          └─ Não resolveu / pediu humano / max interações
                              → Condição (Onboarding/Carnaval/Outros) → Menus → Transfer
                              (fluxo original continua normalmente)
```

## O que muda em relação ao fluxo principal

| Elemento | Fluxo Principal | Rascunho Novo |
|---|---|---|
| Primeiro nó após Start | Condição (triagem) | IA Persistente |
| IA tenta resolver antes? | Não | Sim (até 10 interações) |
| Menus aparecem quando? | Sempre | Só se IA não resolver |
| Fluxo principal afetado? | — | Não (é um INSERT separado) |

## Configuração do nó IA na entrada

- `ai_persistent: true` — loop até resolver ou escalar
- `max_ai_interactions: 10`
- `exit_keywords: ["atendente", "humano", "transferir", "falar com alguem", "menu", "opcoes"]`
- `use_knowledge_base: true`
- `use_customer_data: true`
- `use_tracking: true`
- `objective: "Resolver a dúvida do cliente usando a base de conhecimento. Se não souber, diga que vai direcionar para o menu de atendimento."`
- `fallback_message: "Vou te direcionar para nosso menu de atendimento para encontrar o especialista certo!"`
- `max_sentences: 4`
- `forbid_options: true`
- `persona: Helper (0d2f4c7c...)`

## Estrutura do rascunho

```text
Nós (total: todos os originais + 2 novos):

[start] → [welcome_ia] (message: "Oi! Sou a assistente virtual da 3 Cliques...")
         → [ia_entrada] (ai_response persistente)
         → [1769459229369] (Condição original: Onboarding/Carnaval/Outros)
         → ... todo o resto do fluxo original idêntico ...
```

**Edges alteradas:**
- `start` → aponta para `welcome_ia` (novo) em vez de `1769459229369`
- `welcome_ia` → aponta para `ia_entrada` (novo)
- `ia_entrada` → aponta para `1769459229369` (condição original, como fallback)
- Todas as outras edges e nós permanecem idênticos

## Detalhamento técnico

### Ação: INSERT na tabela `chat_flows`

Um único INSERT com:
- `name: "Master Flow + IA Entrada (Rascunho)"`
- `is_active: false` (rascunho para teste)
- `is_master_flow: false`
- `flow_definition`: JSON completo com todos os nós originais + 2 novos (`welcome_ia` e `ia_entrada`) + edges redirecionadas

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — INSERT novo, fluxo principal intocado |
| Kill Switch | Preservado — motor valida antes de executar IA |
| Rollback | Deletar o registro |
| Teste | Via botão 🧪 no inbox |

