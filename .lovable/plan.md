
# Plano: Remover Triagem Legada Restante do ai-autopilot-chat

## Diagnóstico Confirmado

### Problema Identificado
Ainda existe um **segundo bloco de triagem legada** que não foi removido anteriormente. Este bloco está gerando as mensagens destacadas na imagem:

| Mensagem | Origem | Linha no Código |
|----------|--------|-----------------|
| "Olá, Ronildo Oliveira! 👋 Que bom ter você de volta!..." | Triagem legada (linha 4637) | 4620-4700 |
| "Ótimo! Você mencionou pedidos..." | IA RAG respondendo "1" como intenção | Resposta da IA |

### Código Problemático

**Linhas 4620-4759:** Bloco condicional que ainda executa lógica de triagem:

```typescript
// Linha 4620
if (intentType === 'skip' && !isFinancialContext && isFirstMessageOfSession) {
  // CASO 1: Cliente conhecido = MENU DE TRIAGEM (linhas 4622-4700)
  if (isValidatedCustomer) {
    menuMessage = `Olá, ${contactName}! 👋 Que bom ter você de volta!...`;
    // Envia menu + define awaiting_menu_choice=true
  }
  
  // CASO 2: Lead novo = pedir email (linhas 4703-4758)
  if (!isValidatedCustomer && responseChannel === 'whatsapp') {
    leadGreeting = `Olá! Para garantir um atendimento personalizado...`;
    // Pede email
  }
}
```

### Por que Ainda Executa?

A remoção anterior (linhas 2576-2808) removeu o **processamento da escolha do menu** (quando cliente responde "1" ou "2"), mas NÃO removeu o **envio inicial do menu**:

- ❌ **Removido anteriormente**: Detectar "1" ou "2" e rotear para departamento
- ❌ **NÃO removido**: Enviar o menu "1-Pedidos / 2-Sistema" na primeira mensagem

### Por que a Segunda Mensagem Aparece?

Após enviar o menu legado, quando o cliente responde "1":
1. O código não encontra mais o handler de `awaiting_menu_choice` (foi removido)
2. A mensagem "1" cai na IA RAG
3. A IA interpreta "1" como intenção de "pedidos" e responde com "Ótimo! Você mencionou pedidos..."

---

## Solução Proposta

Remover completamente o bloco de triagem legada (linhas 4620-4759), pois o Master Flow visual já implementa:
- Saudação personalizada
- Menu de opções
- Coleta de email para leads

---

## Alterações Detalhadas

### 1. Remover bloco de triagem na primeira mensagem

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Local**: Linhas 4589-4759

**Ação**: Remover todo o bloco que:
- Detecta `isFirstMessageOfSession`
- Envia menu para `isValidatedCustomer`
- Pede email para `!isValidatedCustomer`

**Código a remover** (aproximadamente 170 linhas):

```typescript
// REMOVER: Linhas 4589-4759
// 🎯 BYPASS DA IA: Saudação Direta na PRIMEIRA MENSAGEM da SESSÃO
const rawMessages = messages || [];
// ... todo o bloco até linha 4759
```

**Substituir por comentário simples:**

```typescript
// ============================================================
// 🎯 TRIAGEM VIA MASTER FLOW
// A triagem (saudação, menu, coleta de email) é feita 100% pelo 
// Master Flow visual processado via process-chat-flow
// ============================================================
```

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Ação | Linhas Afetadas |
|---------|------|-----------------|
| `ai-autopilot-chat/index.ts` | Remover | 4589-4759 (triagem na primeira mensagem) |

### Fluxo Corrigido

```text
Cliente envia "Oi"
         │
         ▼
ai-autopilot-chat invocado
         │
         ▼
Chama process-chat-flow PRIMEIRO
         │
         ├─ useAI: false + response? ────► RETURN resposta do fluxo (CORRETO!)
         │                                  Ex: "Seja bem-vindo à 3 Cliques!"
         │
         └─ useAI: true? ────► Continuar para IA RAG
                               (SEM triagem legada no caminho)
```

### Impacto da Remoção

| Antes | Depois |
|-------|--------|
| Menu legado + Master Flow = 2 mensagens | Apenas Master Flow = 1 mensagem |
| Cliente recebe "Olá! 1-Pedidos 2-Sistema" + "Seja bem-vindo" | Cliente recebe apenas "Seja bem-vindo" |
| Resposta "1" confunde IA | Resposta "1" processada pelo fluxo visual |

---

## Ordem de Implementação

1. Localizar exatamente o início do bloco (linha 4589 - comentário "BYPASS DA IA")
2. Localizar o fim do bloco (linha 4759 - fechamento dos ifs)
3. Remover todo o bloco (4589-4759)
4. Adicionar comentário explicativo
5. Deploy da edge function
6. Testar: enviar "Oi" deve mostrar APENAS mensagem do Master Flow

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Cliente envia "Oi" | Recebe APENAS mensagem do Master Flow |
| Cliente envia "1" após menu do fluxo | Próximo nó do fluxo (não IA) |
| Logs não mostram "TRIAGEM: Enviando menu" | Mensagem só do fluxo visual |
| `awaiting_menu_choice` não é mais setado | Campo não atualizado |
