

## Problema

O template CSV usa **vírgula** como separador (`pergunta,resposta,categoria,tags`), mas no Brasil o Excel usa **ponto-e-vírgula** como separador padrão. Quando o usuário abre o CSV no Excel, tudo fica numa coluna só.

Além disso, as tags dentro do campo também usam vírgula (`"saque,dinheiro,pagamento"`), o que conflita com o delimitador.

## Solução

### 1. Template com ponto-e-vírgula (compatível com Excel BR)

No `KnowledgeTemplateDownload.tsx`, trocar o `TEMPLATE_CSV` para usar `;` como separador e adicionar BOM UTF-8 (`\uFEFF`) para o Excel reconhecer acentos corretamente:

```
\uFEFF"pergunta";"resposta";"categoria";"tags"
"Como faço um saque?";"Para fazer um saque, acesse sua conta > Menu > Saques > Solicitar. O prazo é de 3-5 dias úteis.";"Financeiro";"saque, dinheiro, pagamento"
```

### 2. Layout de 2 colunas claro na UI

Reorganizar as instruções do template para deixar claro visualmente que são **2 colunas principais** (Pergunta → Resposta) + 2 opcionais (Categoria, Tags):

- Destaque visual: Pergunta (entrada) e Resposta (saída) como campos principais obrigatórios
- Categoria e Tags como campos secundários opcionais

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/knowledge/KnowledgeTemplateDownload.tsx` | Template com `;`, BOM UTF-8, layout reorganizado |

