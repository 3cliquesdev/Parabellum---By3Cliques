
# Plano: Autonomia Total do RAG com OpenAI

## Resumo Executivo

Você quer controle total para configurar o sistema RAG (Retrieval-Augmented Generation) diretamente da página **AI Trainer**, com prioridade para usar **OpenAI**. O plano adiciona configurações editáveis para modelo, thresholds e fontes de dados, eliminando valores hardcoded na Edge Function.

---

## O Que Será Implementado

### 1. Painel de Configuração RAG na Página AI Trainer

Um novo card "Configuração do RAG" com:

- **Seletor de Modelo**: OpenAI (GPT-5, GPT-5 Mini, GPT-5 Nano) e Gemini como opções
- **Provider Padrão**: OpenAI será marcado como recomendado
- **Thresholds de Confiança**: Sliders editáveis para definir quando a IA responde ou transfere
- **Toggle Modo Estrito**: Ativar/desativar anti-alucinação com 1 clique

### 2. Controle de Fontes de Dados

Toggles para ativar/desativar cada fonte globalmente:

| Fonte | Descrição |
|-------|-----------|
| Base de Conhecimento (KB) | Artigos e FAQs |
| Dados CRM (Kiwify) | Histórico de compras |
| Rastreio Logístico | Status de entregas |
| Sandbox Training | Regras de aprendizado |

### 3. Persona com Permissões Editáveis

Tornar o widget `PersonaDataAccessWidget` editável, permitindo:

- Clicar nas badges para ativar/desativar permissões
- Salvar automaticamente no banco de dados

### 4. Edge Function Dinâmica

A função `ai-autopilot-chat` passará a ler as configurações do banco:

- `ai_rag_confidence_threshold` → threshold mínimo
- `ai_rag_sources_enabled` → JSON com fontes ativas
- Modelo já configurável via `ai_default_model`

---

## Detalhes Técnicos

### Arquivos a Modificar

```text
src/pages/AITrainer.tsx
├── Adicionar: RAGConfigurationCard (novo componente inline)
├── Adicionar: Sliders de threshold com react-hook-form
└── Mover: Seletor de modelo para este card

src/components/settings/PersonaDataAccessWidget.tsx
├── Tornar badges clicáveis
├── Adicionar mutation useUpdatePersona
└── Feedback visual ao salvar

supabase/functions/ai-autopilot-chat/index.ts
├── Ler thresholds do banco (não hardcoded)
├── Ler fontes ativas do banco
└── Respeitar toggle de cada fonte
```

### Novas Configurações no Banco (system_configurations)

| Key | Valor Padrão | Descrição |
|-----|--------------|-----------|
| `ai_default_model` | `openai/gpt-5-mini` | Modelo padrão |
| `ai_rag_min_threshold` | `0.10` | Score mínimo (0-1) |
| `ai_rag_direct_threshold` | `0.75` | Score para resposta direta |
| `ai_rag_sources_enabled` | `{"kb":true,"crm":true,"tracking":true}` | Fontes ativas |

### UI do Novo Card "Configuração do RAG"

```text
┌─────────────────────────────────────────────────────────┐
│ 🎯 Configuração do RAG                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Modelo da IA                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ OpenAI GPT-5 Mini (Recomendado)              ▼      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Threshold de Confiança                                  │
│                                                         │
│ Mínimo (handoff se abaixo)   ──●──────────── 10%       │
│ Direto (sem cautela)         ──────────●─── 75%        │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Fontes de Dados                                         │
│                                                         │
│ [✓] Base de Conhecimento                                │
│ [✓] Dados CRM (Kiwify)                                  │
│ [✓] Rastreio Logístico                                  │
│ [✓] Sandbox Training                                    │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ [○ OFF] Modo Estrito Anti-Alucinação                   │
│         85%+ confiança, citação obrigatória            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

```text
AITrainer.tsx (UI)
       │
       ▼
system_configurations (Banco)
       │
       ▼
ai-autopilot-chat (Edge Function)
       │
       ├─► Lê ai_default_model → Usa OpenAI/Gemini
       ├─► Lê ai_rag_min_threshold → Define score mínimo
       └─► Lê ai_rag_sources_enabled → Ativa/desativa KB, CRM, etc.
```

---

## Mudanças no Comportamento

### Antes (Hardcoded)
- Thresholds fixos no código (10%, 40%, 75%)
- Modelo configurado em página separada
- Fontes sempre ativas

### Depois (Configurável)
- Thresholds editáveis via UI
- Modelo e RAG na mesma página
- Fontes controláveis por toggle
- OpenAI como padrão recomendado

---

## Próximos Passos (Após Aprovação)

1. Criar hooks para salvar/ler configurações RAG
2. Implementar card de configuração no AITrainer
3. Tornar PersonaDataAccessWidget editável
4. Atualizar Edge Function para ler do banco
5. Definir OpenAI GPT-5 Mini como modelo padrão
6. Testar fluxo completo

---

## Notas Importantes

- ✅ **Preservação**: Tudo que funciona hoje continua funcionando
- ✅ **Compatibilidade**: Se config não existe, usa valores default atuais
- ✅ **OpenAI Priorizado**: GPT-5 Mini como padrão recomendado
- ✅ **Sem Downtime**: Alterações são incrementais

