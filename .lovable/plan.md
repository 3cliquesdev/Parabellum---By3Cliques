
# Plano: Buscar por Email, Nome, Telefone e ID no Inbox

## Situação Atual

A busca do Inbox **já funciona** para a maioria dos campos solicitados:

| Campo         | Suportado | Onde |
|---------------|-----------|------|
| Nome          | ✅ Sim    | `contact_name` |
| Email         | ✅ Sim    | `contact_email` |
| Telefone      | ✅ Sim    | `contact_phone` |
| ID Conversa   | ✅ Sim    | `conversation_id` |
| ID Contato    | ❌ Não    | Não implementado |
| Mensagem      | ✅ Sim    | `last_snippet` |

O placeholder do input atualmente diz: **"Buscar por nome, email, ID..."** — não menciona telefone, mas a busca funciona.

---

## Problema Real

Embora telefone já funcione, o placeholder pode confundir usuários. Além disso, falta buscar pelo **ID do contato** (`contact_id`), que é útil para operações de suporte.

---

## Mudanças Propostas

### Arquivo 1: `src/components/inbox/InboxFilterPopover.tsx`

**Linha 140** - Atualizar placeholder:

```diff
- placeholder="Buscar por nome, email, ID..."
+ placeholder="Buscar por nome, email, telefone, ID..."
```

### Arquivo 2: `src/hooks/useInboxView.tsx`

**Linhas 177-183** - Adicionar busca por `contact_id`:

```typescript
// ANTES (linhas 177-183)
result = result.filter(item => 
  item.contact_name?.toLowerCase().includes(searchLower) ||
  item.contact_email?.toLowerCase().includes(searchLower) ||
  item.contact_phone?.toLowerCase().includes(searchLower) ||
  item.conversation_id.toLowerCase().includes(searchLower) ||
  item.last_snippet?.toLowerCase().includes(searchLower)
);

// DEPOIS
result = result.filter(item => 
  item.contact_name?.toLowerCase().includes(searchLower) ||
  item.contact_email?.toLowerCase().includes(searchLower) ||
  item.contact_phone?.toLowerCase().includes(searchLower) ||
  item.contact_id?.toLowerCase().includes(searchLower) ||
  item.conversation_id.toLowerCase().includes(searchLower) ||
  item.last_snippet?.toLowerCase().includes(searchLower)
);
```

---

## Fluxo de Busca Resultante

```
┌─────────────────────────────────────────────────────────────┐
│  Usuário digita termo no campo de busca                     │
│  Exemplo: "5511999999999" ou "fulano@email.com"             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  O termo é comparado (case-insensitive) com:                │
│                                                              │
│  ✅ contact_name    → Nome do contato                       │
│  ✅ contact_email   → Email do contato                      │
│  ✅ contact_phone   → Telefone (com ou sem máscara)         │
│  ✅ contact_id      → UUID do contato (NOVO)                │
│  ✅ conversation_id → UUID da conversa                      │
│  ✅ last_snippet    → Última mensagem                       │
│                                                              │
│  Se qualquer campo contiver o termo → conversa aparece      │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/inbox/InboxFilterPopover.tsx` | Atualizar placeholder |
| `src/hooks/useInboxView.tsx` | Adicionar `contact_id` à busca |

---

## Validação Pós-Implementação

1. Abrir Inbox
2. Digitar parte de um telefone (ex.: "999") → deve encontrar contato
3. Digitar parte de um email → deve encontrar contato
4. Digitar um ID de contato (UUID) → deve encontrar contato
5. Verificar que placeholder mostra "nome, email, telefone, ID..."

---

## Conformidade com Regras

- **Upgrade, não downgrade**: Adiciona funcionalidade sem remover nenhuma
- **Zero regressão**: Busca existente continua funcionando
- **Performance**: Filtro client-side, sem novas queries
