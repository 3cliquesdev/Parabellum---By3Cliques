

# Fix: Template Reengage — Feedback Instantâneo e Prevenção de Duplicatas

## Diagnóstico da Conversa #D3492874

- **Quem encerrou:** Fernanda Giglio (manualmente, às 12:31)
- **Template enviado 3x:** 12:13, 12:28 (sent), 12:30 (failed)
- **Causa raiz:** Após clicar "Enviar Template" no `ReengageTemplateDialog`, a conversa é reaberta no banco mas a UI não dá feedback imediato — o usuário continua vendo a conversa na aba "Encerradas", sem confirmação visual clara de que o envio funcionou. O time clica novamente achando que não foi.

## Problemas Identificados

1. **Sem navegação pós-envio:** O `ReengageTemplateDialog` fecha o dialog e mostra um toast, mas a conversa permanece na aba de encerradas. Deveria navegar automaticamente para `?filter=mine&conversation=ID` (aba "Minhas").
2. **Sem proteção contra clique duplo:** O botão "Enviar Template" não desabilita após o primeiro clique durante a mutação assíncrona corretamente — se a edge function demora >2s, o usuário clica de novo.
3. **Sem guard de conversa já aberta:** Se a conversa já foi reaberta (status = 'open'), o dialog deveria bloquear um segundo envio.

## Correções

### 1. `ReengageTemplateDialog.tsx` — Navegação imediata + guard

- Adicionar `useNavigate` do react-router
- No `onSuccess`: navegar para `/inbox?filter=mine&conversation={id}` para que a conversa apareça na aba "Minhas" instantaneamente
- Adicionar prop `onSuccess` callback para o ChatWindow poder reagir
- Adicionar guard: se `conversation.status === 'open'`, mostrar aviso "Conversa já está aberta" e não permitir reenvio

### 2. `ReengageTemplateDialog.tsx` — Feedback visual melhorado

- Mostrar spinner + texto "Enviando..." no botão (já existe `isPending` mas precisa cobrir todo o fluxo)
- Fechar dialog somente APÓS confirmação de sucesso
- Invalidar queries imediatamente para refresh da lista

### 3. `ChatWindow.tsx` — Atualizar estado local

- Após reengage com sucesso, forçar refresh da conversa atual para refletir `status: 'open'`

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/inbox/ReengageTemplateDialog.tsx` | Navegação pós-envio, guard de duplicata, feedback visual |
| `src/components/ChatWindow.tsx` | Callback onSuccess para refresh |

