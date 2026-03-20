

## Diagnóstico — #672F64F7: Template genérico em vez do configurado

### O que aconteceu
1. Cliente chegou ao nó financeiro, disse "Quero sacar"
2. OTP já estava verificado de sessão anterior (recent verification no DB)
3. O **POST-OTP guard** (L6398) foi **PULADO** porque `isFirstInteraction = true`
4. A IA foi chamada, retornou `fallback_phrase_detected` (0 artigos)
5. O **fallback handler** (L10006) tentou smart collection mas usou o template genérico

### 3 Causas Raiz

**1. `isFirstInteraction` lê do lugar errado**
- Código: `(conversation.customer_metadata).__ai?.interaction_count` → **undefined** → `0` → `isFirstInteraction = true` → guard pulado
- O `interaction_count` está em `chat_flow_states.collected_data.__ai`, não em `customer_metadata`
- **Resultado**: O guard que deveria enviar a coleta imediatamente é sempre pulado

**2. Prioridade invertida: smartCollection > description_template**
- O código verifica smart collection PRIMEIRO, e `description_template` só como fallback
- Mas o usuário configurou um template explícito no dashboard:
  ```
  Para eu criar o seu ticket vou precisa que me enviei essas informações.
  Nome: {{customer_name}}
  Chave Pix: {{pix_key}}
  Banco: {{bank}}
  ...
  ```
- O `description_template` é a mensagem real que o usuário quer — deveria ter prioridade

**3. `fieldLabels` com chaves erradas**
- Campos configurados no nó: `pix_key`, `bank`, `reason`, `amount`, `email`
- Chaves no mapa de labels: `nome_completo`, `tipo_chave_pix`, `chave_pix`, `valor`, `banco`, `motivo`
- Nenhum match → cai no fallback genérico `📝 **pix_key:** [preencha]`
- Mas como o fallback handler no L10020 ainda gera a mensagem bonita genérica, é isso que aparece

### Correção (3 partes)

**Parte A — Inverter prioridade: `description_template` primeiro**

Em **todos os 4 blocos** de geração de template (L2207, L6405, L6590, L10006):
- Verificar `description_template` ANTES de smart collection
- Se existir, usar direto com prefixo "Identidade confirmada!"
- Smart collection só entra se NÃO houver description_template

**Parte B — Corrigir `fieldLabels` para corresponder às chaves reais**

Atualizar o mapa em todos os 4 blocos para incluir as chaves reais usadas no fluxo:
```typescript
const fieldLabels: Record<string, string> = {
  'pix_key': '🔐 **Chave PIX:** [sua chave completa]',
  'bank': '🏦 **Banco:** [nome do banco]',
  'reason': '📝 **Motivo:** [motivo da solicitação]',
  'amount': '💰 **Valor:** [R$ X,XX ou "valor total da carteira"]',
  'email': '📧 **E-mail:** [seu e-mail]',
  'name': '📋 **Nome completo:** [seu nome]',
  'phone': '📱 **Telefone:** [seu telefone]',
  'cpf': '🪪 **CPF:** [seu CPF]',
  'address': '📍 **Endereço:** [seu endereço]',
  // manter keys antigas por compatibilidade
  'nome_completo': '📋 **Nome completo:** [seu nome]',
  'chave_pix': '🔐 **Chave PIX:** [sua chave completa]',
  'valor': '💰 **Valor:** [R$ X,XX]',
  'banco': '🏦 **Banco:** [nome do banco]',
  'motivo': '📝 **Motivo:** [motivo da solicitação]',
};
```

**Parte C — Corrigir `isFirstInteraction` para ler do flow_context**

No POST-OTP guard (L6395), buscar `interaction_count` também de `flow_context.collectedData.__ai`:
```typescript
const aiInteractions = 
  (conversation.customer_metadata as any)?.__ai?.interaction_count || 
  (flow_context as any)?.collectedData?.__ai?.interaction_count || 0;
```

### Arquivo afetado
`supabase/functions/ai-autopilot-chat/index.ts` — 4 blocos de template (L2207, L6390-6407, L6586-6604, L10006-10020)

### Resultado esperado
"Quero sacar" com OTP verificado → template do dashboard:
```
✅ Identidade confirmada!

Para eu criar o seu ticket vou precisa que me enviei essas informações.
Nome: [nome]
Chave Pix: [pix]
Banco: [banco]
Motivo: [motivo]
Valor: [valor]

Preencha com atenção...
```

