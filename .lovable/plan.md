
## Corrigir Warning de Extensao Link Duplicada no Tiptap

### Problema
O Tiptap v3 `StarterKit` ja inclui a extensao `Link` por padrao. Dois arquivos importam `Link` separadamente e adicionam ao array de extensoes, causando o warning "Duplicate extension name 'link'" no console.

### Solucao
Em ambos os arquivos, remover a importacao separada do `Link` e configurar o link diretamente via `StarterKit.configure()`.

### Arquivos afetados

**1. `src/components/playbook/RichTextEditor.tsx`**
- Remover `import Link from '@tiptap/extension-link'`
- Remover `Link.configure(...)` do array de extensoes
- Mover a configuracao do link para dentro do `StarterKit.configure({ link: { openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } } })`

**2. `src/components/email-builder-v2/blocks/TextBlock.tsx`**
- Remover `import TiptapLink from "@tiptap/extension-link"`
- Remover `TiptapLink.configure(...)` do array de extensoes
- Mover a configuracao para `StarterKit.configure({ link: { openOnClick: false } })`

### Impacto
- Zero downgrade: mesma funcionalidade, apenas elimina o warning
- Nenhuma feature existente e afetada
