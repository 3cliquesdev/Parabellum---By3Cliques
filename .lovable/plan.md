

# Melhorar visualização e permitir edição da Chave

## Problemas
1. **Visualização ruim** — tabela com colunas mal proporcionadas, texto pequeno
2. **Chave não editável** — o campo "Chave" está `disabled` ao editar (linha 147)

## Solução

### Arquivo: `src/components/support/ReturnReasonsSettings.tsx`

**1. Trocar tabela por layout de cards/lista** — mais legível, especialmente com poucos itens:
- Cada motivo vira um card com: Label em destaque (texto grande), Chave abaixo (texto secundário), Ordem, Switch de ativo, botão editar
- Layout responsivo com `grid` ou lista vertical

**2. Permitir edição da Chave** — remover `disabled={!!editingReason}` da linha 147

### Estrutura visual de cada card:
```text
┌─────────────────────────────────────────────────┐
│  Produto Danificado                    [Switch] │
│  produto_danificado  ·  Ordem: 1      [Editar] │
└─────────────────────────────────────────────────┘
```

- Label como título principal (`text-base font-semibold`)
- Chave como subtítulo (`text-sm text-muted-foreground font-mono`)
- Switch e botão de editar alinhados à direita
- Itens inativos com `opacity-50`

