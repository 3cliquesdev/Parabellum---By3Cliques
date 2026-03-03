

# Plano: Transferência direta para Consultor no Chat Flow

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Situação Atual

O webhook **já possui** lógica de atribuição ao consultor durante transferências (linhas 919-1022 do `meta-whatsapp-webhook`). Ele busca o `consultant_id` do contato e atribui automaticamente. Porém, isso acontece de forma implícita em qualquer transferência — não há uma opção explícita "Transferir para Consultor" no editor de fluxos.

## O que será feito

Adicionar um novo tipo de transferência **"consultant"** ao nó Transfer do Chat Flow, permitindo que o editor visual tenha a opção clara de "Meu Consultor".

### Mudanças

**1. UI — TransferPropertiesPanel.tsx**
- Adicionar opção `"consultant"` no Select de tipo de transferência com label "Consultor do cliente"
- Quando selecionado, mostrar mensagem explicativa: "A conversa será direcionada ao consultor vinculado ao contato. Se não houver consultor, vai para o pool do departamento selecionado."
- Manter seletor de departamento como fallback obrigatório

**2. UI — TransferNode.tsx**
- Adicionar renderização do tipo "consultant" com ícone e label "Meu Consultor"

**3. Backend — meta-whatsapp-webhook/index.ts**
- Quando `transferType === "consultant"`, **priorizar** a busca pelo consultor antes de qualquer distribuição
- Se não encontrar consultor: usar departamento configurado no nó como fallback
- A lógica existente (linhas 926-1022) já faz isso — apenas garantir que `transfer_type=consultant` force essa priorização mesmo quando `consultant_manually_removed` está ativo (neste caso, ir para pool)

**4. Backend — process-chat-flow/index.ts**
- Passar `transferType: "consultant"` quando o nó tem esse tipo configurado (já funciona pois passa `node.data.transfer_type`)

### Fluxo no Canvas

```text
[IA Entrada] 
    → exit_keyword "consultor" 
    → [Nó Transfer: tipo=consultant, fallback=dept Suporte]
        → Webhook detecta transfer_type=consultant
        → Busca consultant_id do contato
        → Se tem: assigned_to=consultor, ai_mode=copilot ✅
        → Se não tem: pool do departamento fallback
```

## Impacto
- Zero regressão — os tipos existentes (department, agent, queue) não são alterados
- A lógica de consultor no webhook já existe, apenas será ativada de forma explícita
- Exit keywords "consultor" (do plano anterior) + este nó = fluxo completo

