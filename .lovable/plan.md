

# Fix: matchAskOption não reconhece texto sem emoji

## Diagnóstico — Conversa #DA6F0D96

O cliente "Pamela Oliveira" digitou "Falar com atendente" (texto da opção 2), mas o motor de fluxos respondeu "Desculpe, não entendi sua resposta" e reenviou o menu.

**Causa raiz:** Os labels das opções no nó `ask_options` contêm emojis prefixados (ex: "👤 Falar com atendente", "↩ Voltar ao menu"). O `matchAskOption` compara o input do usuário contra o label completo (com emoji), então "Falar com atendente" ≠ "👤 Falar com atendente" em todas as 4 camadas de matching.

## Correção

### `supabase/functions/process-chat-flow/index.ts` — Função `matchAskOption`

Adicionar uma etapa de normalização que remove emojis dos labels antes de comparar, em todas as camadas (exact, startsWith, contains):

```
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]|[↩↪⬆⬇⬅➡🔄♻️✅❌⚠️💬📞📧🔔🔒🔑👤👥💰📦🎯🛒📋✉️🏠]/gu, '')
  .trim();
}
```

Aplicar `stripEmojis()` aos labels em cada camada de matching:
- Layer 2 (exact): comparar `stripEmojis(label)` com input
- Layer 3 (startsWith): comparar `stripEmojis(label)` com input
- Layer 4 (contains): usar `stripEmojis(label)` no regex

Isso garante que tanto "2" quanto "Falar com atendente" quanto "👤 Falar com atendente" funcionem.

### Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/process-chat-flow/index.ts` | Strip emojis no matcher de opções |

Deploy: `process-chat-flow`

