

# Corrigir Saudação Proativa — Remover Vazamento do Campo `objective`

## Problema
Na linha 7215 do `ai-autopilot-chat/index.ts`, o campo `flow_context.objective` é concatenado diretamente na mensagem de saudação enviada ao cliente. Como esse campo contém instruções internas do sistema (ex: "Consultar KB para soluções conhecidas", "coletar descrição do erro e criar ticket"), o cliente recebe texto técnico/robótico.

## Correção

Remover a injeção do `greetObjective` na mensagem e substituir por uma saudação humanizada baseada apenas no `personaName` e no contexto do produto/departamento.

**Código atual (linhas 7210-7216):**
```typescript
const greetObjective = flow_context.objective || '';
// ...
if (greetObjective) greetingMsg += ' ' + greetObjective + '.';
greetingMsg += ' Como posso te ajudar?';
```

**Código proposto:**
```typescript
// NÃO usar flow_context.objective — contém instruções internas
// Usar apenas departamento/produto para contextualizar
const greetDepartment = flow_context.collectedData?.assunto || flow_context.collectedData?.Assunto || '';
let greetingMsg = 'Olá! Sou ' + personaGreetName;
if (greetProduto) greetingMsg += ' do time de ' + greetProduto;
greetingMsg += '.';
if (greetDepartment) greetingMsg += ' Vou te ajudar com ' + greetDepartment + '.';
greetingMsg += ' Como posso te ajudar? 😊';
```

A variável `greetObjective` é removida completamente. Em seu lugar, usamos o campo `assunto` do `collectedData` (que contém a escolha do menu do usuário, não instruções internas) para contextualizar a saudação de forma segura.

## Arquivo Afetado
- `supabase/functions/ai-autopilot-chat/index.ts` — linhas 7208-7216

## Redeploy
- Redeploy da função `ai-autopilot-chat` após a alteração.

