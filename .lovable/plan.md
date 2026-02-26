

# Indicador de Fluxo Ativo — Mover para Header

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Situação Atual

O `ActiveFlowIndicator` está renderizado na linha 684 do `ChatWindow.tsx`, **dentro da área de chat** (entre o alert de "Assumir" e o scroll de mensagens). Isso faz com que ele fique pouco visível, especialmente quando há muitas mensagens.

Na screenshot, o usuário quer que o indicador de fluxo ativo fique visível no **header** da conversa, junto aos botões de ação (Teste, Assumir, Negócio, etc.).

## Proposta

Mover o `<ActiveFlowIndicator>` da área de conteúdo (linha 684) para o **header**, logo abaixo da barra de ações. Isso garante visibilidade permanente sem scroll.

| Mudança | Arquivo | Descrição |
|---|---|---|
| Mover ActiveFlowIndicator | `ChatWindow.tsx` | Remover da linha 684 e colocar após o fechamento do header (linha ~650), antes do alert de "Assumir" |

### Detalhamento

**ChatWindow.tsx:**
- Remover `<ActiveFlowIndicator conversationId={conversation.id} />` da posição atual (linha 684)
- Inserir o componente logo após o `</div>` que fecha o header (linha 650), antes do bloco `canShowTakeControl`
- O componente já possui toda a lógica: mostra nome do fluxo, badge ativo/rascunho, botão de cancelar

### Resultado visual

O indicador ficará fixo no topo da conversa, sempre visível, mostrando:
- Ícone de fluxo + nome do fluxo entre aspas
- Badge "Ativo" ou "Rascunho"  
- Botão X para cancelar

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — mesmo componente, apenas reposicionado |
| Upgrade | Sim — melhora visibilidade do fluxo ativo |

