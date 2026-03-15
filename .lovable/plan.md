

# Redesign Visual do Portal do Cliente

Redesenhar `ClientPortal.tsx` e `ReturnsList.tsx` mantendo toda lógica existente (hooks, handlers, dialog). Apenas mudanças visuais.

## Alterações

### `src/pages/ClientPortal.tsx`
- **Header com gradiente**: Card com `bg-gradient-to-r from-blue-600 to-purple-600` ocupando largura total, com avatar mostrando iniciais do `profile?.full_name`, nome em destaque, email menor, e badge "Cliente Ativo" verde
- **Layout**: `bg-gray-50 min-h-screen`, conteúdo centralizado em `max-w-2xl`
- **Abas**: Trocar `TabsList` compacto por abas horizontais com ícones (User, RotateCcw, BookOpen, Ticket), aba ativa com underline azul e texto bold — estilo custom fora do componente Tabs padrão, ou sobrescrevendo estilos
- **Aba Devoluções**: Header de seção com "Minhas Devoluções" à esquerda e botão "Nova Devolução" à direita
- **Aba Conta**: Card branco com info e botão WhatsApp
- **Rodapé**: Botão "Sair da conta" em texto cinza claro, discreto, fora do card
- **Geral**: Cards `bg-white rounded-xl shadow-sm`, tipografia hierárquica

### `src/components/client-portal/ReturnsList.tsx`
- **Estado vazio**: Ilustração maior com ícone em círculo colorido, texto principal + subtexto + botão CTA "Solicitar Devolução"
- **Cards de devolução**: `bg-white rounded-xl shadow-sm p-5`, protocolo em destaque, seta (ChevronRight) para indicar clicável, layout mais polido com tipografia hierárquica

### Arquivos
| Arquivo | Ação |
|---------|------|
| `src/pages/ClientPortal.tsx` | Reescrever layout visual |
| `src/components/client-portal/ReturnsList.tsx` | Melhorar visual dos cards e estado vazio |

Nenhuma mudança em hooks, edge functions ou lógica de dados.

