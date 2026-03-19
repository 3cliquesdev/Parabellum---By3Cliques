

# Fix: Botao "Assumir" nao visivel para atendentes

## Problema

Quando a conversa esta em modo autopilot/waiting_human (Fila IA), o sistema substitui o composer por uma mensagem "Clique em Assumir para digitar" (linha 847-859). O botao "Assumir" existe no header (linha 608-620), mas:

1. O texto "Assumir" fica **oculto em telas < 1024px** (`hidden lg:inline`) — so aparece o icone de mao, que se perde entre outros botoes
2. A area do composer que diz "Clique em Assumir" **nao tem um botao clicavel** — so texto informativo
3. Atendentes nao conseguem localizar o icone pequeno no header

## Correcao

### 1. Adicionar botao "Assumir Conversa" diretamente na area do composer bloqueado

Na area que substitui o composer (linhas 847-859 do `ChatWindow.tsx`), adicionar um botao "Assumir Conversa" grande e visivel, alem do texto informativo. Isso elimina a necessidade de o agente procurar o botao no header.

```text
┌─────────────────────────────────────┐
│  🤖 Modo Piloto Automatico          │
│  Clique abaixo para atender         │
│                                      │
│  [ 🖐 Assumir Conversa ]            │  ← botao grande e visivel
└─────────────────────────────────────┘
```

### 2. Tornar o botao do header mais visivel

Remover o `hidden lg:inline` do texto "Assumir" para que o label apareca em todas as telas, nao so em telas grandes.

### Arquivos afetados

- `src/components/ChatWindow.tsx` — 2 edicoes:
  - Linha ~618: remover `hidden lg:inline` do span do botao
  - Linhas ~847-859: adicionar botao de acao na area do composer bloqueado

