
## Plano: Corrigir Estatísticas e Evoluir Sistema de IA com Fluxos Guiados

### ✅ FASE 1 - CONCLUÍDA

#### 1. ✅ Bug Corrigido: "0 clientes" no Kiwify
- `useKiwifyStats.tsx` agora conta contatos com deals (não filtra por source)
- Resultado esperado: ~10.617 clientes | ~11.061 deals

#### 2. ✅ Fonte "Importação de Planilha" adicionada
- Nova entrada no `KnowledgeSourcesWidget.tsx`
- Mostra clientes com `source=csv_import`

---

### ✅ FASE 2 - MIGRAÇÃO EXECUTADA

#### 3. ✅ Campo `is_master_flow` em chat_flows
- Permite definir um fluxo como "guia mestre" para a IA
- Trigger garante apenas um fluxo mestre por vez
- Tipo adicionado em `useChatFlows.tsx`

#### 4. ✅ Campo `default_persona_id` em profiles
- Permite vincular persona padrão a cada agente
- Usado quando agente está em modo copilot

---

### 🔜 PRÓXIMOS PASSOS (Backend)

#### 5. 🔵 Implementar lógica no ai-autopilot-chat
- Verificar se existe fluxo mestre ativo antes de responder
- Usar etapas do fluxo como guia de atendimento
- Melhorar prompt para pensamento deliberativo

#### 6. 🔵 UI para selecionar fluxo mestre
- Toggle na lista de fluxos para marcar como "Fluxo Mestre"
- Indicador visual no fluxo selecionado

#### 7. 🔵 UI para vincular persona ao agente
- Dropdown em configurações do perfil do agente
- Exibir persona ativa no inbox

---

### Arquitetura Final

```text
FLUXO MESTRE (Guia de Atendimento):
┌─────────────────────────────────────────────────────┐
│ [1] Saudação     → "Olá, sou a IA da empresa X"    │
│ [2] Identificar  → Perguntar o que precisa          │
│ [3] Classificar  → Detectar departamento/intenção   │
│ [4] Buscar KB    → Procurar resposta na base        │
│ [5] Responder    → Usar persona adequada            │
│ [6] Feedback     → Perguntar se resolveu            │
│ [7] Encerrar     → Despedida ou transferir humano   │
└─────────────────────────────────────────────────────┘
```

