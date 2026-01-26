

## Plano: Corrigir Erro do Enum sender_type ("agent" invalido)

### Problema Identificado

As conversas nao podem ser transferidas e mensagens de agentes nao estao sendo salvas porque o codigo esta usando `sender_type: 'agent'` que **nao existe no banco de dados**.

**Enum valido no banco:**
- `user` - mensagens de usuarios/agentes do sistema
- `contact` - mensagens de clientes
- `system` - mensagens do sistema/IA

**O que o codigo esta tentando usar:**
- `agent` (INVALIDO - causa erro de INSERT)

**Logs de erro recentes:**
```
invalid input value for enum sender_type: "agent"
```

Isso afeta:
1. Envio de mensagens pelo agente via WhatsApp
2. Registro de mensagens da IA
3. Sincronizacao de historico
4. Funcionamento geral do chat (mensagens nao sao salvas)

---

### Arquivos a Corrigir

| Arquivo | Linha | Problema | Correcao |
|---------|-------|----------|----------|
| `supabase/functions/send-meta-whatsapp/index.ts` | 242 | `sender_type: "agent"` | `sender_type: "user"` |
| `supabase/functions/ai-autopilot-chat/index.ts` | 5025 | `sender_type: 'agent'` | `sender_type: 'user'` |
| `supabase/functions/sync-whatsapp-history/index.ts` | 306 | `'agent' : 'customer'` | `'user' : 'contact'` |
| `src/hooks/useAutoHandoff.tsx` | 9 | Type definition com `'agent'` | `'user'` |
| `src/hooks/useTakeControl.tsx` | 144 | Type assertion com `'agent'` | `'user'` |

---

### Detalhes das Correcoes

**1. send-meta-whatsapp/index.ts (linha 242)**
```typescript
// ANTES
sender_type: "agent",

// DEPOIS  
sender_type: "user",
```

**2. ai-autopilot-chat/index.ts (linha 5025)**
```typescript
// ANTES
sender_type: 'agent',

// DEPOIS
sender_type: 'user',
```

**3. sync-whatsapp-history/index.ts (linha 306)**
```typescript
// ANTES
sender_type: msgKey.fromMe ? 'agent' : 'customer',

// DEPOIS
sender_type: msgKey.fromMe ? 'user' : 'contact',
```

**4. useAutoHandoff.tsx (linha 9)**
```typescript
// ANTES
sender_type: 'customer' | 'agent' | 'system';

// DEPOIS
sender_type: 'user' | 'contact' | 'system';
```

**5. useTakeControl.tsx (linha 144)**
```typescript
// ANTES
sender_type: m.sender_type as 'customer' | 'agent' | 'system'

// DEPOIS
sender_type: m.sender_type as 'user' | 'contact' | 'system'
```

---

### Por que usar "user" em vez de criar "agent"?

1. **Semantica correta:** No contexto do sistema, "user" representa qualquer usuario autenticado da plataforma (agentes, gerentes, etc.)
2. **Consistencia:** O enum ja existe e e usado em outras partes do sistema
3. **Menos risco:** Alterar o enum no banco poderia causar problemas em dados existentes
4. **Performance:** Nao precisa de migracao de banco de dados

---

### Impacto Esperado

Apos a correcao:
- Mensagens enviadas por agentes serao salvas corretamente
- Transferencias de conversa funcionarao (o registro de interacao sera criado)
- Sincronizacao de historico do WhatsApp funcionara
- Logs de erro `invalid input value for enum sender_type: "agent"` desaparecerao

---

### Secao Tecnica

**Enum atual no banco (pg_enum):**
```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'sender_type'::regtype;
-- Resultado: user, contact, system
```

**Edge Functions que precisam de redeploy:**
1. `send-meta-whatsapp`
2. `ai-autopilot-chat`
3. `sync-whatsapp-history`

**Hooks frontend que precisam de atualizacao:**
1. `useAutoHandoff.tsx`
2. `useTakeControl.tsx`

**Validacao pos-correcao:**
- Testar envio de mensagem pelo agente via WhatsApp
- Verificar se mensagem aparece no historico
- Testar transferencia de conversa entre agentes
- Monitorar logs do Postgres para confirmar ausencia de erros de enum

