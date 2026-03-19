

# Plano: Coleta financeira dinâmica via campos do fluxo

## Problema

Os campos de coleta (`smart_collection_fields`) configurados no nó de IA pelo painel visual **nunca chegam ao backend**. O `process-chat-flow` não envia esses dados no `flow_context`, e o `ai-autopilot-chat` tem tudo hardcoded no prompt. O resultado é manutenção cara e comportamento rígido.

## Solução

Propagar os campos do nó até a IA e montar a mensagem de coleta dinamicamente.

## Alterações

### 1. `process-chat-flow/index.ts` — propagar campos do nó

No bloco que monta o response com `aiNodeActive: true` (~L4637-4666), adicionar:

```typescript
smartCollectionEnabled: nextNode.data?.smart_collection_enabled ?? false,
smartCollectionFields: nextNode.data?.smart_collection_fields || [],
```

### 2. `ai-autopilot-chat/index.ts` — receber e usar campos dinâmicos

**a) Interface FlowContext (~L1211-1244):** adicionar:
```typescript
smartCollectionEnabled?: boolean;
smartCollectionFields?: string[];
```

**b) Prompt pós-OTP (~L6841-6860):** substituir a lista hardcoded por lógica dinâmica:

```typescript
// Mapear campo → label amigável
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', email: 'Email', phone: 'Telefone',
  cpf: 'CPF', pix_key: 'Chave PIX', bank: 'Banco',
  reason: 'Motivo', amount: 'Valor', address: 'Endereço'
};

const collectionFields = flow_context?.smartCollectionFields || ['pix_key','bank','amount','reason'];
const fieldList = collectionFields
  .map(f => `${FIELD_LABELS[f] || f}:`)
  .join('\n');
```

O prompt passa a ser:
```
Para dar andamento à sua solicitação, preciso que me envie os dados abaixo com atenção 😊

${fieldList}

⚠️ Preencha tudo certinho! Dados incorretos podem atrasar a resolução e precisaríamos entrar em contato novamente. Seja claro no motivo da sua solicitação!
```

**c) Remover sequência hardcoded (~L7077-7104):** substituir o fluxo PIX → banco → valor → motivo pela mesma mensagem estruturada dinâmica.

**d) Fallback pós-OTP (~L7876):** mesma mensagem estruturada.

### 3. Deploy

Redeployar `process-chat-flow` e `ai-autopilot-chat`.

## Resultado

- Os campos que o usuário marca no painel do nó (SmartCollectionSection) serão os campos que a IA pede
- Tudo numa única mensagem estruturada, com o formato que você pediu
- Sem templates hardcoded — muda no painel, muda no comportamento

