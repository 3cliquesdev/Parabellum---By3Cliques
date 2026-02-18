

## Correção: Limpar Keywords Duplicadas e Prevenir Repetição

### Problema Confirmado (dados do banco)
Ambas as regras no nó de condição têm o campo `keywords` com o **mesmo valor idêntico**:
- Regra 1 (Onboarding): keywords = "Olá, vim pelo email e gostaria de saber mais sobre a ressaca de carnaval"
- Regra 2 (Carnaval): keywords = "Olá, vim pelo email e gostaria de saber mais sobre a ressaca de carnaval"

Como o campo keywords não está vazio, o fallback para o label nunca é acionado. E como são idênticos, a Regra 1 sempre ganha.

### Solução (3 partes)

**1. Correção dos dados no banco (migração SQL)**

Limpar o campo `keywords` de todas as regras que tenham keywords idêntico ao label de outra regra no mesmo nó, permitindo que o fallback para label funcione:

```sql
-- Atualizar o flow_definition para limpar keywords das regras de condição
-- Isso forçará o motor a usar o label de cada regra como texto de matching
```

Na prática: atualizar o JSON do flow removendo o conteúdo do campo `keywords` das duas regras, para que o motor use os labels "Onboarding" e "Carnaval" (ou os labels corretos que o usuário definir).

**2. Validação na UI: impedir keywords duplicadas entre regras**

No `ChatFlowEditor.tsx`, adicionar validação ao salvar: se duas regras no mesmo nó de condição tiverem keywords idênticas, exibir alerta e bloquear o salvamento.

**3. Auto-clear: limpar keywords quando igual ao label**

No `ChatFlowEditor.tsx`, quando o usuário salvar, se o campo keywords de uma regra for idêntico ao label dela, limpar o keywords automaticamente (já que o motor usa o label como fallback).

### Mudanças Técnicas

**Arquivo: `src/components/chat-flows/ChatFlowEditor.tsx`**

- Na função de salvar/atualizar regras de condição, adicionar:
  1. Validação de duplicatas: `if (rules[i].keywords === rules[j].keywords && keywords não vazio) -> alerta`
  2. Auto-clear: `if (rule.keywords.trim() === rule.label.trim()) -> rule.keywords = ""`

**Arquivo: `supabase/functions/process-chat-flow/index.ts`**

- Sem mudança na lógica do motor (já está correta com o fallback para label)

**Correção de dados: migração SQL**

- Atualizar o `flow_definition` do fluxo ativo (id: `3ea0d227-01f3-46a6-bcad-80a085ec2337`) para limpar o campo keywords das duas regras, forçando uso dos labels

### Impactos
- Sem downgrade: a lógica do motor permanece igual
- Upgrade: dados corrigidos, validação previne recorrência
- O usuário só precisa garantir que os **labels** das regras sejam as frases corretas de matching
