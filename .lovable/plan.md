

# Plano: Condição ANTES da IA no Rascunho

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Conceito

Reestruturar o rascunho "Master Flow + IA Entrada" para que a **Condição seja avaliada antes da IA**. Se o cliente mandar uma mensagem que casa com uma condição (Onboarding, Carnaval, ou futuras), ele segue direto para o caminho específico **sem passar pela IA**. Apenas o caminho "Outros" (else) vai para a IA Persistente.

```text
ESTRUTURA ATUAL DO RASCUNHO:
Start → Boas-vindas → IA Persistente → Condição → caminhos

NOVA ESTRUTURA:
Start → Boas-vindas → Condição
                        ├─ Onboarding → caminho Onboarding (direto, sem IA)
                        ├─ Carnaval → caminho Carnaval (direto, sem IA)
                        └─ Outros (else) → IA Persistente → Menu principal
```

## O que muda

| Antes | Depois |
|---|---|
| IA intercepta TUDO, inclusive condições | Condições são avaliadas primeiro |
| Cliente precisa dizer "menu" para sair da IA | Cliente com mensagem de condição vai direto |
| Só 1 caminho (tudo pela IA) | Caminhos específicos pulam a IA |
| Futuras condições exigem mais exit_keywords | Futuras condições só precisam de nova regra no nó |

## Detalhamento técnico

### Ação: UPDATE no flow_definition do rascunho (id: `20a05c59-da7e-4eb9-89f7-731b1b7fb3db`)

Alteração de 4 edges no JSON:

| Edge | Antes | Depois |
|---|---|---|
| `welcome_ia` → | `ia_entrada` | `1769459229369` (condição) |
| `ia_entrada` → | `1769459229369` (condição) | `1769459318164` (menu principal) |
| Condição `else` → | `1769459318164` | `ia_entrada` (IA) |
| Condição `false` → | `1769459318164` | `ia_entrada` (IA) |

Edges de Onboarding e Carnaval **permanecem iguais** (já apontam direto para seus caminhos).

### Escalabilidade

Esta estrutura é **preparada para o futuro**: para adicionar novas condições, basta criar nova regra no nó de Condição com seu handle apontando para o caminho desejado. O caminho "Outros" (else) continua enviando para a IA. Nenhuma alteração de código é necessária.

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas UPDATE no rascunho inativo |
| Fluxo principal | Intocado |
| Kill Switch | Preservado — IA só é chamada no caminho "Outros" |
| Rollback | Reverter edges para a ordem anterior |

