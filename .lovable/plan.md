

# Melhorar legibilidade da tabela de Motivos de Devolução

## Problema
A coluna "Chave" ocupa espaço excessivo e o texto monospace pequeno dificulta a leitura. A tabela não está bem distribuída visualmente.

## Solução
- Reduzir largura da coluna "Chave" com `w-[200px]` e aplicar um badge/chip estilizado ao invés de texto mono cru
- Aumentar destaque visual do "Label" (fonte medium)
- Melhorar espaçamento geral das colunas com larguras fixas para Ordem, Ativo e Ações
- Adicionar descrição visual sutil na chave (ex: background pill com `bg-muted rounded-md px-2 py-1`)

## Arquivo
`src/components/support/ReturnReasonsSettings.tsx` — ajustar estilos das `TableHead` e `TableCell`

