

## Plano: Correção do Build e Melhoria de Log

### Problema 1: Roteamento incorreto (Configuração do Fluxo)
O problema NAO e de codigo. As duas regras no no de condicao estao configuradas com as **mesmas keywords** e a Regra 1 vem antes, entao sempre ganha. Alem disso, o termo "Ola" (separado por virgula) e generico demais e bate em qualquer mensagem.

**Acao necessaria do usuario (no editor de fluxo):**
- Regra 1 (Onboarding Armazem Drop): configurar keywords como `onboarding, armazem drop`
- Regra 2 (Comercial/Carnaval): configurar keywords como `ressaca, carnaval`
- Nao usar termos genericos como "Ola" porque batem em tudo

### Problema 2: Erro de build (mux-embed)
O `package-lock.json` contem referencias a `mux-embed` e `@mux/mux-player` que nao existem no `package.json`. Isso causa o erro `mux-embed@workspace:* failed to resolve`.

**Acao tecnica:**
Recriar o `package-lock.json` removendo todas as entradas de `mux-embed`, `@mux/mux-player`, e `@mux/mux-player-react` para resolver o erro de build.

### Secao Tecnica

| Acao | Arquivo | Detalhe |
|------|---------|---------|
| Limpar mux-embed | `package-lock.json` | Remover entradas `node_modules/mux-embed`, `node_modules/@mux/mux-player`, `node_modules/@mux/mux-player-react` e todas as referencias `"mux-embed"` |
| Adicionar log de debug | `supabase/functions/process-chat-flow/index.ts` | Logar as keywords de cada regra durante avaliacao para facilitar debug futuro |

### Impactos
- Nenhum downgrade: o motor de fluxo nao muda comportamento
- Upgrade: build volta a funcionar + logs melhorados para debug de regras
- A correcao do roteamento depende do usuario ajustar as keywords no editor visual

