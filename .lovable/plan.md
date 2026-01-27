
# Plano: Agente RAG Visível + Fontes de Dados Expandidas + Coleta Inteligente

## Contexto e Diagnóstico

Após análise detalhada do código, identifiquei que:

### O que é o "RAG" neste sistema?

O RAG (Retrieval-Augmented Generation) é o **coração do autopilot** - não é um componente visível separado, mas está embutido na edge function `ai-autopilot-chat`. Ele funciona assim:

```text
Cliente envia mensagem
        │
        ▼
┌──────────────────────────┐
│   Query Expansion        │  ← Expande pergunta em variações
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│   Busca Semântica        │  ← Embeddings + match_knowledge_articles
│   (knowledge_articles)   │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│   Score de Confiança     │  ← 0.70+ = responde, abaixo = handoff
│   (anti-alucinação)      │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│   Geração de Resposta    │  ← GPT-4o/GPT-5-mini com contexto KB
│   (citando fontes)       │
└──────────────────────────┘
```

### Problema 1: O painel do nó IA só mostra categorias da KB

O `AIResponsePropertiesPanel.tsx` atual permite filtrar categorias, mas **não expõe as outras fontes de dados** (Kiwify, Tracking) que já existem no sistema e são usadas via tools da persona.

### Problema 2: Coleta de dados é manual (blocos separados)

Atualmente você precisa arrastar blocos "Nome", "Email", "CPF" no canvas. A IA deveria fazer isso conversacionalmente, como atendimentos enterprise.

---

## Implementação Proposta

### FASE 1: Tornar o RAG Visível no Painel

**Arquivo: `src/components/chat-flows/AIResponsePropertiesPanel.tsx`**

Expandir o painel para mostrar TODAS as fontes de dados disponíveis:

| Seção | Descrição | Como Funciona |
|-------|-----------|---------------|
| 📚 Base de Conhecimento | Artigos FAQ, políticas | Busca semântica (embeddings) |
| 🛒 Dados do Cliente (Kiwify) | Pedidos, status de compra | Tool `check_order_status` |
| 📦 Rastreio Logístico | Status de envio | Tool `check_tracking` |
| 🎯 Sandbox Training | Regras aprendidas | Mesma busca semântica |

**Nova UI proposta:**

```text
┌─────────────────────────────────────────────┐
│ 🤖 Agente / Persona     [Seletor ▼]        │
├─────────────────────────────────────────────┤
│                                             │
│ 📊 FONTES DE DADOS (RAG)                   │
│ ─────────────────────────────────────────── │
│                                             │
│ 📚 Base de Conhecimento                     │
│   [✓] Usar KB para responder                │
│   Categorias: [Manual] [Suporte] [+]        │
│                                             │
│ 🛒 Dados do Cliente (CRM)                  │
│   [✓] Consultar pedidos Kiwify              │
│   [ ] Verificar histórico de compras        │
│                                             │
│ 📦 Rastreio de Pedidos                      │
│   [ ] Consultar status de envio             │
│                                             │
├─────────────────────────────────────────────┤
│ ✨ Contexto Adicional                       │
│   [textarea]                                 │
└─────────────────────────────────────────────┘
```

**Campos adicionados ao data do nó:**

```typescript
interface AIResponseNodeData {
  // Existentes
  label: string;
  persona_id?: string;
  persona_name?: string;
  use_knowledge_base: boolean;
  kb_categories?: string[];
  context_prompt?: string;
  fallback_message?: string;
  
  // NOVOS
  use_customer_data?: boolean;    // Consultar Kiwify/CRM
  use_order_history?: boolean;    // Histórico de pedidos
  use_tracking?: boolean;         // Consultar rastreio logístico
}
```

---

### FASE 2: Integrar Fontes no Backend (ai-autopilot-chat)

**Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`**

Atualmente o autopilot já tem acesso a essas tools via persona, mas não respeita toggles por nó. Precisamos:

1. Ler os novos campos do nó (`use_customer_data`, `use_tracking`)
2. Habilitar/desabilitar tools dinamicamente baseado nessas flags
3. Incluir dados dessas fontes no contexto da IA

```typescript
// Exemplo de lógica a adicionar
if (nodeData.use_customer_data && contact?.email) {
  // Buscar dados do cliente na Kiwify
  const { data: customerData } = await supabaseClient.functions.invoke(
    'check-order-status',
    { body: { email: contact.email } }
  );
  
  if (customerData?.orders) {
    additionalContext += `\n\n📦 Pedidos do cliente:\n${formatOrders(customerData.orders)}`;
  }
}

if (nodeData.use_tracking && orderId) {
  // Buscar rastreio
  const { data: trackingData } = await supabaseClient.functions.invoke(
    'check-tracking',
    { body: { order_id: orderId } }
  );
  
  if (trackingData) {
    additionalContext += `\n\n🚚 Status de envio:\n${formatTracking(trackingData)}`;
  }
}
```

---

### FASE 3: Coleta Inteligente pela IA

**Conceito**: Em vez de arrastar blocos manuais, a IA coleta dados conversacionalmente quando necessário.

**Novo Toggle no Nó IA:**

```text
┌─────────────────────────────────────────────┐
│ 🤖 Coleta Inteligente                       │
│   [✓] IA coleta dados quando necessário     │
│                                             │
│   Dados que a IA pode solicitar:            │
│   [✓] Nome     [✓] Email    [ ] CPF        │
│   [✓] Telefone [ ] Endereço                 │
└─────────────────────────────────────────────┘
```

**Lógica no ai-autopilot-chat:**

```typescript
// Se coleta inteligente ativa
if (nodeData.smart_collection_enabled) {
  const requiredFields = nodeData.smart_collection_fields || [];
  const missingFields = [];
  
  if (requiredFields.includes('email') && !contact.email) {
    missingFields.push('email');
  }
  if (requiredFields.includes('name') && !contact.first_name) {
    missingFields.push('nome');
  }
  // ... etc
  
  if (missingFields.length > 0) {
    // Instruir IA a coletar esses dados naturalmente
    systemPrompt += `\n\nIMPORTANTE: Você ainda precisa coletar: ${missingFields.join(', ')}. 
    Solicite de forma natural durante a conversa, um dado por vez.`;
  }
}
```

---

### FASE 4: Widget "Orquestrador RAG" nas Configurações

**Novo arquivo: `src/components/settings/RAGOrchestratorWidget.tsx`**

Um painel visual que mostra o status do RAG em tempo real:

```text
┌─────────────────────────────────────────────┐
│ 🎯 Orquestrador RAG                         │
│                                             │
│ Status: ✅ Ativo                            │
│ Modelo: GPT-5-mini                          │
│ Modo Estrito: ❌ Desativado                 │
│                                             │
│ Fontes Conectadas:                          │
│ ├─ 📚 KB: 247 artigos (189 com embedding)   │
│ ├─ 🛒 Kiwify: 1,234 clientes                │
│ ├─ 📦 Tracking: MySQL conectado             │
│ └─ 🎓 Sandbox: 12 regras aprendidas         │
│                                             │
│ Última busca: há 2 min                      │
│ Score médio: 0.82                           │
│                                             │
│ [Ver Logs] [Configurar Thresholds]          │
└─────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `src/components/chat-flows/AIResponsePropertiesPanel.tsx` | Adicionar seção "Fontes de Dados (RAG)" com toggles | ALTA |
| `src/components/chat-flows/nodes/AIResponseNode.tsx` | Exibir badges das fontes ativas (CRM, Tracking) | ALTA |
| `supabase/functions/ai-autopilot-chat/index.ts` | Ler novos campos e integrar fontes dinamicamente | ALTA |
| `src/components/settings/RAGOrchestratorWidget.tsx` | **NOVO** - Painel de status do RAG | MÉDIA |
| `src/pages/Settings.tsx` ou `/settings/ai-trainer` | Incluir RAGOrchestratorWidget | MÉDIA |

---

## Resultado Esperado

1. **RAG Visível**: Painel no editor mostrando claramente quais fontes a IA pode consultar
2. **Toggles por Fluxo**: Poder habilitar/desabilitar Kiwify, Tracking por nó específico
3. **Coleta Inteligente**: IA solicita dados naturalmente, sem blocos manuais
4. **Dashboard RAG**: Visão geral do orquestrador nas configurações

---

## Benefícios Enterprise

- **Consistência**: Todas as conversas seguem as mesmas regras de acesso a dados
- **Flexibilidade**: Diferentes fluxos podem ter diferentes fontes habilitadas
- **Visibilidade**: Gestores veem exatamente o que a IA pode acessar
- **Qualidade**: Coleta conversacional é mais natural e profissional
