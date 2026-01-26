
## Plano: Corrigir Loop de Triagem - IA Presa no Menu de Departamentos

### Problema Identificado

A IA está em um **loop infinito de triagem**, enviando repetidamente o menu de opções e ignorando a pergunta real do cliente.

**Logs de erro:**
```
🎯 TRIAGEM: Cliente ainda não escolheu - enviando lembrete
Template "aguardando_escolha_departamento" carregado com sucesso
```

**Causa raiz:**
1. A conversa tem `awaiting_menu_choice: true` desde 15:16
2. O cliente envia "vim pelo email e gostaria de saber da promoção de pré carnaval"
3. A regex `menuChoiceRegex = /^(1|2|pedido[s]?|sistema)$/i` nao casa com essa mensagem
4. Sistema re-envia o menu de opcoes em loop infinito
5. A intencao real do cliente (saber sobre promocao) e **completamente ignorada**

**Regex atual (muito restritiva):**
```typescript
const menuChoiceRegex = /^(1|2|pedido[s]?|sistema|suporte\s*(pedido|sistema)?)[\s!.]*$/i;
```
Isso so aceita mensagens exatamente iguais a "1", "2", "pedido" ou "sistema".

---

### Solucao

Implementar 3 melhorias na logica de triagem:

1. **Deteccao de intencao clara** - Se o cliente envia uma mensagem longa com contexto especifico, ignorar o menu e processar normalmente
2. **Limite de lembretes** - Maximo de 3 lembretes antes de fazer handoff ou continuar com IA
3. **Detectar intencoes especificas** - Palavras como "promocao", "preco", "oferta" indicam intencao comercial, nao escolha de menu

---

### Arquivo a Modificar

| Arquivo | Linhas | Alteracao |
|---------|--------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | 1203-1370 | Adicionar logica de escape da triagem |

---

### Implementacao Detalhada

**1. Adicionar contador de lembretes e limite (antes da linha 1207):**

```typescript
// ============================================================
// 🎯 TRIAGEM INTELIGENTE: Detectar escolha de menu (1, 2, pedidos, sistema)
// ============================================================
const conversationMetadataForMenu = conversation.customer_metadata || {};
const isAwaitingMenuChoice = conversationMetadataForMenu.awaiting_menu_choice === true;

// 🆕 FASE 1: Contador de lembretes para evitar loop infinito
const menuReminderCount = conversationMetadataForMenu.menu_reminder_count || 0;
const MAX_MENU_REMINDERS = 3; // Maximo de lembretes antes de pular triagem

// 🆕 FASE 2: Detectar se mensagem tem intencao clara (pular triagem)
const hasSpecificIntent = customerMessage.length > 30 || // Mensagem longa = intencao especifica
  /promo[çc][ãa]o|oferta|desconto|pre[çc]o|quanto custa|comprar|pre.?carnaval|email|indicac|parceria|revenda/i.test(customerMessage);

// 🆕 FASE 3: Verificar se e referencia contextual (veio de campanha/email)
const isFromCampaign = /vim (pelo|por|do) (email|link|site|campanha|instagram|face|whats)/i.test(customerMessage);
```

**2. Modificar logica de escape da triagem (linha 1318-1367):**

```typescript
// Se cliente esta aguardando escolha mas enviou outra coisa
if (isAwaitingMenuChoice && !menuChoice && contact.email) {
  
  // 🆕 ESCAPE 1: Se mensagem tem intencao clara ou veio de campanha, pular triagem
  if (hasSpecificIntent || isFromCampaign) {
    console.log('[ai-autopilot-chat] 🎯 BYPASS TRIAGEM: Detectada intencao especifica', {
      hasSpecificIntent,
      isFromCampaign,
      messagePreview: customerMessage.substring(0, 50)
    });
    
    // Limpar flag e continuar processamento normal
    await supabaseClient.from('conversations')
      .update({
        customer_metadata: {
          ...conversationMetadataForMenu,
          awaiting_menu_choice: false, // 🆕 Limpar flag
          triage_bypassed: true,
          triage_bypass_reason: hasSpecificIntent ? 'specific_intent' : 'campaign_reference'
        }
      })
      .eq('id', conversationId);
    
    // Nao fazer return - deixar continuar para processamento da IA
  }
  // 🆕 ESCAPE 2: Se ja enviou muitos lembretes, parar e processar
  else if (menuReminderCount >= MAX_MENU_REMINDERS) {
    console.log('[ai-autopilot-chat] 🎯 BYPASS TRIAGEM: Limite de lembretes atingido (' + menuReminderCount + ')');
    
    // Limpar flag e encaminhar para IA
    await supabaseClient.from('conversations')
      .update({
        customer_metadata: {
          ...conversationMetadataForMenu,
          awaiting_menu_choice: false,
          triage_bypassed: true,
          triage_bypass_reason: 'max_reminders_exceeded'
        }
      })
      .eq('id', conversationId);
    
    // Nao fazer return - deixar continuar para processamento da IA
  }
  // COMPORTAMENTO ORIGINAL: Enviar lembrete (com contador)
  else {
    // Incrementar contador de lembretes
    await supabaseClient.from('conversations')
      .update({
        customer_metadata: {
          ...conversationMetadataForMenu,
          menu_reminder_count: menuReminderCount + 1
        }
      })
      .eq('id', conversationId);
    
    const reminderTemplate = await getMessageTemplate(supabaseClient, 'aguardando_escolha_departamento', {});
    const reminderMessage = reminderTemplate || 'Por favor, escolha uma das opcoes:\n\n**1** - Pedidos (entregas, rastreio, trocas)\n**2** - Sistema (acesso, duvidas tecnicas)';
    
    console.log('[ai-autopilot-chat] 🎯 TRIAGEM: Lembrete ' + (menuReminderCount + 1) + '/' + MAX_MENU_REMINDERS);
    
    // ... resto do codigo de lembrete existente ...
    
    // RETURN EARLY - Lembrete enviado
    return new Response(JSON.stringify({
      status: 'awaiting_menu_choice',
      message: reminderMessage,
      reminder_count: menuReminderCount + 1,
      // ...
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
```

---

### Fluxo Apos Correcao

```
Cliente envia: "vim pelo email e gostaria de saber da promocao de pre carnaval"
            ↓
ai-autopilot-chat verifica:
  1. isAwaitingMenuChoice = true
  2. menuChoice = null (nao e 1, 2, pedido, sistema)
  3. isFromCampaign = true ✅ (detectou "vim pelo email")
  4. hasSpecificIntent = true ✅ (detectou "promocao")
            ↓
🎯 BYPASS TRIAGEM: awaiting_menu_choice = false
            ↓
Continua para processamento normal da IA
            ↓
IA responde sobre a promocao ✅
```

---

### Casos de Teste

| Mensagem | Acao Esperada |
|----------|---------------|
| "1" | Direcionar para Suporte Pedidos |
| "2" | Direcionar para Suporte Sistema |
| "oi" | Lembrete 1/3 |
| "oi" (2a vez) | Lembrete 2/3 |
| "oi" (3a vez) | Lembrete 3/3 |
| "oi" (4a vez) | BYPASS - processar com IA |
| "vim pelo email saber da promocao" | BYPASS imediato - processar com IA |
| "quero saber o preco do produto X" | BYPASS imediato - intencao clara |

---

### Secao Tecnica Detalhada

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

**Mudancas:**

1. **Linha 1207-1215 (adicionar):**
```typescript
// Contador de lembretes
const menuReminderCount = conversationMetadataForMenu.menu_reminder_count || 0;
const MAX_MENU_REMINDERS = 3;

// Detectar intencao clara
const hasSpecificIntent = customerMessage.length > 30 || 
  /promo[çc][ãa]o|oferta|desconto|pre[çc]o|quanto custa|comprar|pre.?carnaval|email|indicac|parceria|revenda/i.test(customerMessage);

// Detectar referencia de campanha
const isFromCampaign = /vim (pelo|por|do) (email|link|site|campanha|instagram|face|whats)/i.test(customerMessage);
```

2. **Linha 1318-1367 (substituir):**
Implementar logica de escape conforme detalhado acima.

**Edge Function a fazer redeploy:**
- `ai-autopilot-chat`
