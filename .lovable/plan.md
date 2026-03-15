

# Criar Playbook "Onboarding Completo" com Esqueleto de 14+ Nós

## Objetivo
Criar programaticamente um playbook com a `flow_definition` completa contendo todos os nós e conexões descritos, pronto para o usuário editar e vincular templates/formulários.

## Abordagem
Criar uma página/botão ou script que insira o playbook via `useCreatePlaybook` com o `flow_definition` já montado. A forma mais prática: adicionar um **template de playbook** que o usuário pode criar com um clique, ou inserir diretamente no código como um preset.

Vou criar um arquivo utilitário com a definição do flow e um botão na listagem de playbooks para criar este template.

## Estrutura dos Nós

```text
NÓ 1 (email) "Boas-vindas"
    ↓
NÓ 2 (delay) 1 dia
    ↓
NÓ 3 (email) "Email de Valor"
    ↓
NÓ 4 (delay) 2 dias
    ↓
NÓ 5 (condition) email_clicked
   ├─ TRUE → NÓ 6A (form) "Cliente Engajado"
   └─ FALSE → NÓ 6B (email) "Reengajamento"
         ↓           ↓
         └───────────┘
              ↓
NÓ 7 (delay) 2 dias
    ↓
NÓ 8 (condition) form_score gte 1
   ├─ TRUE → NÓ 9A (email) "Consultor Definido"
   └─ FALSE → NÓ 9B (email) "Lembrete Urgente"
         ↓           ↓
         └───────────┘
              ↓
NÓ 10 (delay) 2 dias
    ↓
NÓ 11 (condition) form_score gte 1
   ├─ TRUE → NÓ 12 (delay) 3 dias ──→ NÓ 13 (email) "Check-in 14d" → NÓ 14 (task)
   └─ FALSE → NÓ 11B (email) "Último Lembrete" → NÓ 12 (mesmo delay)
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/lib/playbook-templates.ts` | **Criar** — definição completa de nodes + edges do template |
| `src/pages/Playbooks.tsx` (ou equivalente) | **Editar** — adicionar botão "Criar Template Onboarding" que usa `useCreatePlaybook` com o flow pré-definido |

## Detalhes Técnicos

- Cada nó terá `id` fixo (ex: `node_1`, `node_2`, etc.) e `position` calculada para layout vertical legível
- Nós condition usam handles `true`/`false` como source handles
- Edges conectam os nós na sequência descrita, usando `sourceHandle` para branches condicionais
- O playbook é criado com `is_active: false` e `is_template: true` para servir como modelo
- Nenhum `template_id` ou `form_id` é vinculado — o usuário configura depois

