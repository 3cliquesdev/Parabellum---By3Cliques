

# Plano: Validação Estrita para `ask_options` + Atualização do Super Prompt

## Problema Identificado

O código atual no `process-chat-flow` tem matching numérico e fuzzy para `ask_options`, **mas quando nenhuma opção é encontrada**, ele:
1. Deixa `path = undefined`
2. Chama `findNextNode()` com path indefinido
3. O sistema busca "qualquer edge" como fallback e pode avançar incorretamente

**Resultado:** Cliente digita "Fff", fluxo avança para nó errado em vez de pedir que repita a resposta.

---

## Alterações a Implementar

### 1. Edge Function: `process-chat-flow/index.ts`

**Linhas 480-518** - Adicionar validação estrita com reenvio de opções:

```typescript
if (currentNode.type === 'ask_options') {
  const options = currentNode.data?.options || [];
  let selectedOption = options.find((opt: any) => 
    opt.label.toLowerCase() === userMessage.toLowerCase() ||
    opt.value.toLowerCase() === userMessage.toLowerCase()
  );
  
  // 🔢 MATCHING NUMÉRICO: Permitir resposta "1", "2", "3"...
  if (!selectedOption) {
    const numericChoice = parseInt(userMessage.trim());
    if (!isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= options.length) {
      selectedOption = options[numericChoice - 1];
      console.log('[process-chat-flow] 🔢 Numeric choice matched:', numericChoice, '→', selectedOption?.label);
    }
  }
  
  // 🔍 MATCHING FUZZY: Match parcial (desabilitado por padrão - muito permissivo)
  // Removido para garantir validação estrita
  
  // ❌ VALIDAÇÃO ESTRITA: Se nenhuma opção válida, NÃO avança
  if (!selectedOption) {
    console.log('[process-chat-flow] ❌ Invalid option response:', userMessage);
    
    // Formatar opções para reenvio
    const formattedOptions = options.map((opt: any, idx: number) => ({
      label: opt.label,
      value: opt.value,
      id: opt.id
    }));
    
    return new Response(
      JSON.stringify({
        useAI: false,
        response: "❗ Não entendi sua resposta.\n\nPor favor, responda com o *número* ou *nome* de uma das opções:",
        options: formattedOptions,
        retry: true,
        flowId: activeState.flow_id,
        nodeId: currentNode.id, // Mantém no mesmo nó
        invalidOption: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // ✅ Opção válida - avança normalmente
  path = selectedOption.id;
  collectedData[currentNode.data?.save_as || 'choice'] = selectedOption.value;
}
```

**Mudanças principais:**
- Remover matching fuzzy (muito permissivo, causa confusão)
- Adicionar validação estrita com mensagem clara
- Retornar `retry: true` para manter no mesmo nó
- Incluir `nodeId` e `invalidOption` para tracking

### 2. Função Helper: `matchAskOption()`

Adicionar função utilitária no início do arquivo para padronizar matching:

```typescript
// Matcher estrito para ask_options
function matchAskOption(
  userInput: string,
  options: Array<{ label: string; value?: string; id?: string }>
): { label: string; value?: string; id?: string } | null {
  const normalized = userInput.trim().toLowerCase();

  // 1️⃣ Número (1, 2, 3…)
  const index = parseInt(normalized, 10);
  if (!isNaN(index) && options[index - 1]) {
    return options[index - 1];
  }

  // 2️⃣ Texto exato da opção (label ou value)
  const exactMatch = options.find(opt =>
    opt.label.toLowerCase() === normalized ||
    (opt.value && opt.value.toLowerCase() === normalized)
  );
  
  return exactMatch || null;
}
```

### 3. Super Prompt v2.3: Adicionar Contrato de `ask_options`

**Arquivo:** `src/docs/SUPER_PROMPT_v2.2.md` → renomear para `v2.3`

**Nova seção a adicionar:**

```markdown
---

## 13. Contrato de `ask_options` (Validação Estrita)

### Regras obrigatórias
Nós do tipo `ask_options` exigem validação estrita de resposta.

### Entradas válidas
✅ Número correspondente à posição (1, 2, 3...)
✅ Texto exato do label da opção
✅ Texto exato do value da opção

### Entradas inválidas
❌ Texto parcial ou fuzzy
❌ Números fora do range
❌ Qualquer outra resposta

### Comportamento para entrada inválida
1. Fluxo **NÃO avança**
2. Fluxo **NÃO transfere**
3. Fluxo **NÃO chama IA**
4. Sistema reenvia a pergunta com orientação clara:

```
❗ Não entendi sua resposta.

Por favor, responda com o *número* ou *nome* de uma das opções:
1️⃣ Pedidos
2️⃣ Sistema
3️⃣ Acesso
4️⃣ Outros
```

### Exemplo de comportamento

| Entrada | Resultado |
|---------|-----------|
| `1` | ✅ Avança para opção 1 |
| `Pedidos` | ✅ Avança para opção "Pedidos" |
| `pedidos` | ✅ Avança (case-insensitive) |
| `Fff` | ❌ Repete opções |
| `5` (se só há 4 opções) | ❌ Repete opções |
| `Ped` | ❌ Repete opções (sem fuzzy) |

---
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/process-chat-flow/index.ts` | Validação estrita + helper `matchAskOption()` |
| `src/docs/SUPER_PROMPT_v2.2.md` | Atualizar para v2.3 com contrato de `ask_options` |

---

## Impacto

### Antes
| Entrada | Resultado |
|---------|-----------|
| `Fff` | ❌ Avança para nó errado (fallback) |
| `5` (4 opções) | ❌ Comportamento indefinido |
| `Ped` | ⚠️ Fuzzy match - pode acertar ou errar |

### Depois
| Entrada | Resultado |
|---------|-----------|
| `Fff` | ✅ Repete opções com orientação |
| `5` (4 opções) | ✅ Repete opções |
| `Ped` | ✅ Repete opções (sem fuzzy) |

---

## Segurança

| Controle | Status |
|----------|--------|
| Fluxo não avança com entrada inválida | ✅ |
| IA não é chamada com entrada inválida | ✅ |
| Transferência não ocorre com entrada inválida | ✅ |
| Cliente recebe feedback claro | ✅ |
| Matching fuzzy removido (ambíguo) | ✅ |

---

## Compatibilidade

A mudança é **backward compatible**:
- Entradas numéricas (1, 2, 3) continuam funcionando
- Entradas de texto exato continuam funcionando
- Apenas fuzzy matching foi removido (era fonte de bugs)

