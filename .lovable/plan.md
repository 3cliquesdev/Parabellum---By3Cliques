

# Corrigir Coleta PIX: Respeitar o Objective do Nó

## Problema Raiz

Quando o OTP é validado no nó financeiro, o código em `ai-autopilot-chat/index.ts` L6916 verifica se existe `description_template` ou `smartCollectionFields` e, se sim, dispara `buildCollectionMessage()` que monta uma mensagem com **todos os campos de uma vez** como instrução determinística ("envie EXATAMENTE esta mensagem").

Porém, o `objective` do nó `node_ia_financeiro` diz explicitamente: **"Pergunte UM campo por vez de forma empática"**.

O resultado: a IA ignora o objective e despeja o template inteiro, quebrando a experiência conversacional.

## Solução

Alterar a lógica pós-OTP (L6913-6934) no `ai-autopilot-chat/index.ts`:

**Se o nó tem `objective` configurado** (ou seja, o administrador definiu instruções específicas de comportamento), usar o `objective` como guia para a IA em vez de forçar o template literal. O `buildCollectionMessage` deve ser usado apenas como **referência interna** para a IA saber quais campos coletar, não como mensagem a ser enviada verbatim.

### Edição em `ai-autopilot-chat/index.ts` (L6913-6934)

Substituir a lógica de `identityWallNote` pós-OTP:

```typescript
if (!identityWallNote) {
  const otpJustValidated = (conversation as any)._otpJustValidated;
  const nodeObjective = flow_context?.objective;

  if (otpJustValidated && (flow_context?.ticketConfig?.description_template || flow_context?.smartCollectionFields?.length > 0)) {
    
    if (nodeObjective) {
      // 🎯 O nó tem objective configurado — respeitar a estratégia do administrador
      // A IA deve seguir o objective (ex: "pergunte um campo por vez")
      // Fornecemos os campos como referência, não como mensagem literal
      const fieldsReference = buildCollectionMessage(flow_context, contactName, contact?.email, contact?.phone, { format: 'plain' });
      
      identityWallNote = `\n\n**✅ IDENTIDADE CONFIRMADA — SEGUIR OBJECTIVE DO NÓ:**
Olá ${contactName}! Sua identidade foi verificada com sucesso.

**SUA MISSÃO (definida pelo administrador):**
${nodeObjective}

**CAMPOS A COLETAR (referência):**
${fieldsReference}

**REGRAS:**
- Siga o objective acima como prioridade máxima
- Após coletar TODOS os dados, use \`create_ticket\` com issue_type="saque"
- NÃO envie todos os campos de uma vez (a menos que o objective permita)`;
      console.log('[ai-autopilot-chat] 📋 identityWallNote: respeitando objective do nó para coleta pós-OTP');
    } else {
      // Sem objective — usar template literal como antes
      const resolvedMsg = buildCollectionMessage(flow_context, contactName, contact?.email, contact?.phone, { format: 'plain' });
      identityWallNote = `\n\n**✅ IDENTIDADE CONFIRMADA — COLETA DE DADOS:**
Olá ${contactName}! Sua identidade foi verificada com sucesso.

Agora envie ao cliente EXATAMENTE esta mensagem de coleta de dados (sem alterar):

---
${resolvedMsg}
---

Após receber todos os dados, use \`create_ticket\` com issue_type="saque".`;
      console.log('[ai-autopilot-chat] 📋 identityWallNote: usando buildCollectionMessage literal (sem objective)');
    }
  } else {
    identityWallNote = `\n\n**IMPORTANTE:** Este é um cliente já verificado...`; // mantém o else existente
  }
}
```

## Resultado Esperado

- **Com objective configurado** (caso do nó financeiro): a IA segue "pergunte um campo por vez" e usa os campos como checklist interno
- **Sem objective** (nós mais simples): mantém o comportamento atual de enviar template literal
- **Nenhuma alteração no frontend ou banco** — respeita a configuração existente

## Arquivo Afetado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Lógica pós-OTP L6913-6934 |

## Deploy
- `ai-autopilot-chat`

