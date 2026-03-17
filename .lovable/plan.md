

# Modo Jarvis — Duas alterações no ai-autopilot-chat

## Alteração 1: Desativar `forbidQuestions` (linha 9229)
Substituir:
```typescript
const forbidQuestions = flow_context.forbidQuestions ?? false;
```
Por:
```typescript
const forbidQuestions = false; // 🤖 OVERRIDDEN PARA MODO JARVIS
```
Isso permite que a IA sempre faça perguntas de triagem sem se autobloquear.

## Alteração 2: Atualizar `flowAntiTransferInstruction` (linhas 6596-6608)
Substituir o bloco inteiro pela nova versão que instrui a IA a **fazer perguntas ativamente** quando o pedido é genérico, em vez de dar fallback automático:
```typescript
const flowAntiTransferInstruction = flow_context ? `

**🚫 REGRA ABSOLUTA — VOCÊ ESTÁ DENTRO DE UM FLUXO AUTOMATIZADO:**
PROIBIDO dizer que vai transferir/direcionar/encaminhar/conectar/passar.
PROIBIDO mencionar atendente/especialista/consultor/menu/departamento/setor.
PROIBIDO criar opções numeradas (1️⃣ 2️⃣).
Se o pedido for genérico ou não houver detalhes (ex: "oi", "pedidos", "suporte"), FAÇA PERGUNTAS ativamente para investigar a dúvida e ser prestativo.
Se APÓS CONVERSAR e entender o contexto você REALMENTE não conseguir resolver com a base de conhecimento, responda SOMENTE: [[FLOW_EXIT]]
Nenhum texto antes ou depois de [[FLOW_EXIT]].
Quem decide transferências, menus e direcionamentos é o FLUXO, não você.

` : '';
```
A diferença principal: adicionada a instrução para **fazer perguntas ativamente** em pedidos genéricos antes de considerar `[[FLOW_EXIT]]`.

## Deploy
Após as edições, deploy imediato da função `ai-autopilot-chat`.

