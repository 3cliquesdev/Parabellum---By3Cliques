

# Plano: Remover Lógica de Triagem Legada do ai-autopilot-chat

## Diagnóstico Confirmado

### Problema Identificado
As duas primeiras mensagens da IA mostradas na imagem são geradas pela **lógica de triagem legada** dentro do `ai-autopilot-chat`, que **conflita** com o Master Flow visual:

| Mensagem | Origem | Deveria Existir? |
|----------|--------|------------------|
| "Olá, Ronildo! ... **1** Pedidos **2** Sistema" | Triagem legada `ai-autopilot-chat` (linhas 2600-2698) | ❌ NÃO |
| "Entendi! Estou te direcionando para Suporte de Pedidos" | Triagem legada `ai-autopilot-chat` (linhas 2634-2636) | ❌ NÃO |
| "Seja bem-vindo à 3 Cliques!" | Master Flow visual (nó `1769459318164`) | ✅ SIM |

### Causa Raiz

O `ai-autopilot-chat` tem duas lógicas concorrentes:

1. **Lógica Nova (correta)**: Chama `process-chat-flow` e usa o Master Flow visual (linhas 2422-2572)
2. **Lógica Legada (duplicada)**: Triagem de menu por código que detecta "1" ou "2" como escolha (linhas 2600-2800)

Quando o Master Flow retorna uma resposta, a execução **deveria parar** (linha 2533-2548), mas a verificação de triagem **acontece ANTES** do retorno condicional em alguns cenários.

### Logs Comprovando o Conflito

```
06:04:04 - TRIAGEM: Enviando menu de departamentos (LEGADO)
06:04:48 - TRIAGEM: Cliente escolheu Suporte Pedidos (LEGADO)
06:05:05 - Chat Flow MATCH - Ignorando triagem! (CORRETO)
```

O log mostra que a triagem legada executa ANTES do bypass correto.

---

## Solução Proposta

Remover completamente a lógica de triagem legada do `ai-autopilot-chat`, pois o Master Flow visual já implementa essa funcionalidade de forma mais flexível e sem duplicação.

---

## Alterações Detalhadas

### 1. Remover bloco de triagem de menu (linhas ~2600-2800)

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Ação**: Remover ou comentar o bloco que:
- Detecta se cliente está `awaiting_menu_choice`
- Processa escolha "1" ou "2" 
- Envia mensagens de confirmação de departamento

**Código a remover** (aproximadamente linhas 2576-2830):
- Verificação de `isAwaitingMenuChoice`
- Regex `menuChoiceRegex` para detectar "1" ou "2"
- Constantes `DEPT_SUPORTE_PEDIDOS`, `DEPT_SUPORTE_SISTEMA`, `DEPT_COMERCIAL`
- Bloco que envia "Entendi! Estou te direcionando para o time de..."
- Bloco que reenvia lembrete de menu

### 2. Remover bloco que INICIA a triagem (envio do menu inicial)

**Local**: Procurar onde `awaiting_menu_choice: true` é definido e onde o menu é enviado inicialmente.

Este bloco provavelmente está mais adiante no código (~linhas 4200-4300) onde detecta cliente conhecido e envia o menu.

### 3. Garantir que `process-chat-flow` sempre tem prioridade total

A lógica existente na linha 2438-2548 já faz o bypass correto quando o fluxo retorna resposta. Precisamos garantir que **nenhum código de triagem** execute antes disso.

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Ação | Linhas Afetadas |
|---------|------|-----------------|
| `ai-autopilot-chat/index.ts` | Remover | ~2576-2830 (triagem de menu), ~4200-4300 (envio inicial do menu) |

### Fluxo Corrigido

```text
Cliente envia mensagem
         │
         ▼
meta-whatsapp-webhook recebe
         │
         ▼
ai-autopilot-chat invocado
         │
         ▼
Chama process-chat-flow PRIMEIRO
         │
         ├─ useAI: false + response? ────► RETURN resposta do fluxo (CORRETO!)
         │
         └─ useAI: true? ────► Continuar para IA RAG (sem triagem legada)
```

### Impacto

| Antes | Depois |
|-------|--------|
| Triagem legada + Master Flow = duplicação | Apenas Master Flow = resposta única |
| Cliente recebe 2 mensagens para mesma interação | Cliente recebe 1 mensagem correta |
| Lógica de departamentos hardcoded | Lógica de departamentos no fluxo visual (editável) |

---

## Ordem de Implementação

1. Identificar exatamente todas as linhas de triagem legada
2. Remover o bloco de processamento de escolha de menu (2600-2700)
3. Remover o bloco de lembrete de menu (2700-2830)
4. Remover o bloco que inicia a triagem (define `awaiting_menu_choice`)
5. Remover constantes de departamentos não usados
6. Testar que Master Flow funciona sozinho
7. Deploy da edge function

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Cliente envia "Oi" | Recebe APENAS mensagem do Master Flow |
| Cliente envia "1" | Recebe APENAS próxima mensagem do fluxo visual |
| Cliente envia mensagem livre | Fluxo avança OU IA responde (sem triagem) |
| Logs mostram apenas 1 resposta por mensagem | Sem duplicação |

---

## Nota de Segurança

A remoção da triagem legada **não afeta** o roteamento de departamentos, pois:
- O Master Flow tem nós de `transfer` que definem `departmentId`
- O `ai-autopilot-chat` já processa `flowResult.transfer === true` e chama `route-conversation` (linhas 2443-2480)

