

# Análise da Conversa #0889710A — Progresso Real + 3 Problemas Restantes

## O Que Funcionou (progresso confirmado)

A IA respondeu corretamente em VÁRIAS interações complexas:
- Acolhida + menu de produtos/departamentos ✅
- Perguntou código do pedido corretamente ✅
- Consultou MySQL e retornou dados de 4 pedidos (3 encontrados, 1 não) ✅
- Mudança de assunto ("devolução") foi entendida ✅

**Isso é um avanço enorme** — o pipeline de ponta a ponta está funcional. Faltam 3 ajustes.

---

## Problema 1: Encoding UTF-8 Quebrado (caracteres "feios")

**Evidência:** A mensagem com dados dos pedidos chegou assim no WhatsApp:
```
Encontrei as informaÃ§Ãµes do seu pedido:
ðŸ"¦ Embalado em: 11/03/2026
```

**Causa:** O arquivo `ai-autopilot-chat/index.ts` inteiro tem strings hardcoded com encoding Latin-1 ao invés de UTF-8. As linhas ~5154-5189 contêm templates como:
```
`Encontrei as informaÃ§Ãµes do seu pedido:`  // deveria ser "informações"
`ðŸ"¦ Embalado em:`                           // deveria ser 📦
`âœ… Status:`                                 // deveria ser ✅
`â" O cÃ³digo **${code}** nÃ£o foi encontrado` // deveria ser ❓ código
```

**Correção:** Reescrever TODAS as strings hardcoded das linhas 5150-5195 com UTF-8 correto. São ~10 linhas de templates.

---

## Problema 2: "Devolução" Dispara Barreira Financeira Indevida

**Evidência:** Cliente perguntou "Como eu faço para ver uma devolução?" (informacional, no nó de Pedidos) → IA respondeu "Entendi sua solicitação financeira. Para prosseguir com segurança, qual é o seu e-mail de cadastro?"

**Causa:** `FINANCIAL_BARRIER_KEYWORDS` (linha 763) inclui `'devolução'` e `'devolver'`. Qualquer mensagem com essas palavras ativa a barreira financeira, mesmo que o cliente esteja no nó de **Pedidos** perguntando como funciona o processo.

**Correção:** Remover `'devolução'` e `'devolver'` de `FINANCIAL_BARRIER_KEYWORDS`. Estas palavras já estão corretamente cobertas em `REFUND_ACTION_PATTERNS` (linha 1114), que é mais contextual e só ativa para ações explícitas como "quero devolução do pedido".

---

## Problema 3: `'não consigo resolver'` Ainda Causa Falso Positivo

**Evidência:** Após a barreira financeira falhar, a IA respondeu algo contendo "não consigo resolver" → `fallback_phrase_detected` → "Não consegui resolver por aqui."

**Causa:** A frase `'não consigo resolver'` (linha 727) é detectada via `.includes()`, então "Não consigo resolver por aqui" ou "Não consegui resolver essa questão" também casam.

**Correção:** Tornar mais específico:
```
'não consigo resolver'  →  'não consigo resolver por aqui'
```
Ou usar match mais estrito (whole phrase, não substring).

---

## Resumo de Alterações

| # | Arquivo | Linhas | O quê |
|---|---------|--------|-------|
| 1 | `ai-autopilot-chat/index.ts` | 5150-5195 | Reescrever templates de rastreio com UTF-8 correto |
| 2 | `ai-autopilot-chat/index.ts` | 763-764 | Remover `'devolução'` e `'devolver'` de `FINANCIAL_BARRIER_KEYWORDS` |
| 3 | `ai-autopilot-chat/index.ts` | 727 | Refinar `'não consigo resolver'` → `'não consigo resolver por aqui'` |

Após as 3 correções, deploy de `ai-autopilot-chat`.

