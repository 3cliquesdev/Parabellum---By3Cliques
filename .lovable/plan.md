

# Condição Multi-Caminho baseada em Dados do Contato

## O que muda

Hoje o modo "Múltiplos caminhos" do nó Condição só funciona com **keywords na mensagem do usuário**. O pedido é permitir que cada regra seja uma **verificação de campo** (has_data), criando caminhos como:

- 🟢 É Cliente? → `kiwify_validated` tem dado
- 🔵 Tem Organização? → `organization_id` tem dado  
- 🟣 Tem Consultor? → `consultant_id` tem dado
- ⚪ Outros → nenhum bateu

O motor avalia na ordem — primeiro match ganha.

## Modelo de dados da regra (extensão)

Cada regra ganha dois campos opcionais:

```text
condition_rules[]: {
  id, label, keywords,          ← existente
  field?: string,               ← NOVO (ex: "organization_id")
  check_type?: "has_data" | ... ← NOVO (default: "has_data")
}
```

Se `field` estiver preenchido → avalia como condição de dados (ignora keywords).  
Se `field` estiver vazio → comportamento atual (keyword matching).

## Alterações

### 1. Editor — painel de propriedades (`ChatFlowEditor.tsx`)
- Adicionar um `Select` de campo (usando `CONDITION_CONTACT_FIELDS`) dentro de cada regra multi-caminho
- Quando `field` está selecionado, esconder o input de keywords e mostrar badge "Verifica dado"
- Opção "Nenhum (usar keywords)" para manter compatibilidade

### 2. Nó visual (`ConditionNode.tsx`)
- Se regra tem `field`, mostrar o `friendlyFieldNames[field]` no label ao invés do label genérico

### 3. Motor — `evaluateConditionPath` (`process-chat-flow/index.ts`)
- Dentro do loop de multi-regras, se `rule.field` existe:
  - Usar `getVar(rule.field, collectedData, contactData, conversationData)`
  - Avaliar com `has_data` (ou `check_type` se informado)
  - Se verdadeiro → retorna `rule.id`
- Se não tem `field` → manter lógica atual de keywords
- Requer que `contactData` e `conversationData` sejam passados para `evaluateConditionPath` (hoje não são — precisa ajustar a assinatura)

### 4. Catálogo de variáveis (`variableCatalog.ts`)
- Nenhuma mudança — já tem `CONDITION_CONTACT_FIELDS` com todos os campos necessários

## Impacto zero no existente
- Regras sem `field` continuam funcionando como keyword match
- Modo clássico Sim/Não não é afetado
- Fluxos existentes com multi-regra por keyword não quebram

## 4 arquivos alterados
1. `src/components/chat-flows/ChatFlowEditor.tsx` — select de campo na regra
2. `src/components/chat-flows/nodes/ConditionNode.tsx` — visual com nome do campo
3. `supabase/functions/process-chat-flow/index.ts` — avaliação has_data em multi-regra
4. Nenhum arquivo novo, nenhuma migration

