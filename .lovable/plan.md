
## Plano: Corrigir Matching de Triggers no Chat Flow

### Problema Identificado

O fluxo "Fluxo de Carnaval" não está sendo disparado mesmo com a mensagem correta porque:

**1. Diferença no texto:**
- **Trigger configurado:** `"Olá vim pelo email e gostaria de saber da promoção de pré carnaval"`
- **Mensagem enviada:** `"vim pelo email e gostaria de saber da promoção de pré carnaval"` (sem "Olá")

**2. Lógica de matching restritiva:**
```javascript
// Linha 509 do process-chat-flow
messageLower.includes(trigger.toLowerCase())
```
Esta lógica exige que a mensagem do usuário **contenha o trigger INTEIRO**, ou seja, se o trigger tem "Olá" no início e a mensagem não tem, não há match.

**3. Aspa extra na mensagem:**
A mensagem recebida tem uma aspa (`"`) no final: `vim pelo email e gostaria de saber da promoção de pré carnaval"`. Isso pode indicar problema na interface de envio, mas não impacta o matching se a lógica for corrigida.

---

### Solução Proposta

Melhorar a lógica de matching para ser **bidirecional e mais flexível**:

1. **Match direto:** Mensagem contém trigger (atual)
2. **Match reverso:** Trigger contém mensagem (novo)
3. **Match por palavras-chave:** Dividir trigger em palavras e verificar se X% estão na mensagem

---

### Código Atual vs Proposto

**Atual (linha 508-512):**
```javascript
for (const trigger of allTriggers) {
  if (messageLower.includes(trigger.toLowerCase())) {
    matchedFlow = flow;
    break;
  }
}
```

**Proposto:**
```javascript
for (const trigger of allTriggers) {
  const triggerLower = trigger.toLowerCase().trim();
  
  // Match 1: Mensagem contém o trigger inteiro
  if (messageLower.includes(triggerLower)) {
    matchedFlow = flow;
    break;
  }
  
  // Match 2: Trigger contém a mensagem (usuário escreveu parte do trigger)
  if (triggerLower.includes(messageLower) && messageLower.length >= 10) {
    matchedFlow = flow;
    break;
  }
  
  // Match 3: Verificar palavras-chave significativas
  const triggerWords = triggerLower
    .split(/\s+/)
    .filter(w => w.length > 3); // Ignorar palavras curtas como "e", "de", "da"
  
  const matchedWords = triggerWords.filter(word => messageLower.includes(word));
  const matchRatio = matchedWords.length / triggerWords.length;
  
  // Se 70%+ das palavras significativas do trigger estão na mensagem
  if (matchRatio >= 0.7 && matchedWords.length >= 3) {
    matchedFlow = flow;
    break;
  }
}
```

---

### Exemplo de Match

| Trigger | Mensagem | Match Atual | Match Novo |
|---------|----------|-------------|------------|
| `Olá vim pelo email e gostaria de saber da promoção de pré carnaval` | `vim pelo email e gostaria de saber da promoção de pré carnaval` | ❌ | ✅ (70%+ palavras) |
| `carnaval` | `quero saber sobre carnaval` | ✅ | ✅ |
| `promoção carnaval` | `vim ver a promoção de carnaval` | ✅ | ✅ |

---

### Alternativa Simples (Recomendada)

Ao invés de modificar a lógica de matching, uma solução mais simples e segura seria:

**Adicionar keywords mais curtas no fluxo** via interface:
- `carnaval`
- `promoção`  
- `vim pelo email`

Isso mantém a lógica atual funcionando e dá controle ao administrador.

**Porém**, para resolver o problema sem exigir alteração manual do usuário, a modificação no código é necessária.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/process-chat-flow/index.ts` | Melhorar lógica de matching de triggers (linhas 508-515) |

---

### Seção Técnica

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

**Linhas afetadas:** 503-515

**Nova implementação com match flexível:**
```typescript
// Função auxiliar para normalizar texto
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .trim();
}

// Na lógica de matching (linha 503+)
for (const flow of flows) {
  const keywords = flow.trigger_keywords || [];
  const triggers = flow.triggers || [];
  const allTriggers = [...keywords, ...triggers];

  for (const trigger of allTriggers) {
    const triggerNorm = normalizeText(trigger);
    const messageNorm = normalizeText(userMessage);
    
    // Match 1: Inclusão direta (qualquer direção)
    if (messageNorm.includes(triggerNorm) || triggerNorm.includes(messageNorm)) {
      matchedFlow = flow;
      break;
    }
    
    // Match 2: Similaridade por palavras (para triggers longos)
    if (triggerNorm.length > 20) {
      const triggerWords = triggerNorm.split(/\s+/).filter(w => w.length > 3);
      const matchedWords = triggerWords.filter(w => messageNorm.includes(w));
      
      if (triggerWords.length > 0 && (matchedWords.length / triggerWords.length) >= 0.6) {
        matchedFlow = flow;
        break;
      }
    }
  }
  if (matchedFlow) break;
}
```

**Por que essa abordagem:**
1. **Normalização:** Remove acentos e pontuação para evitar falhas por caracteres especiais
2. **Bidirecional:** Aceita tanto "mensagem contém trigger" quanto "trigger contém mensagem"
3. **Fuzzy matching:** Para triggers longos, aceita 60%+ de palavras correspondentes
4. **Retrocompatível:** Triggers curtos como "carnaval" continuam funcionando normalmente
