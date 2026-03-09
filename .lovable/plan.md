

# Plano: Corrigir Edges Duplicadas e Conexão Faltante no Fluxo Cópia

## Problemas Identificados

### 1. Drop Internacional sem conexão
O nó `1769459533021` (Menu Produto Cliente) tem a opção `opt_1769459583909` (Drop Internacional) **sem nenhuma edge de saída**. O cliente fica preso.

**Correção**: Adicionar edge `opt_1769459583909` → `1769459768149` (Menu Assunto), igual às outras opções de produto.

### 2. Edges duplicadas no Menu Assunto (`1769459768149`)
Cada opção tem **duas edges**: uma correta (para o nó "Trava" específico) e uma duplicada apontando para `1772196913050` (condição genérica). Isso causa comportamento imprevisível no motor de fluxos.

**4 edges a remover**:
- `opt_1769459784782` → `1772196913050` (manter a que vai para `1772136527156`)
- `opt_1769459793458` → `1772196913050` (manter a que vai para `1772136666814`)
- `opt_1769459798821` → `1772196913050` (manter a que vai para `1772136666814`)
- `opt_1769459806791` → `1772196913050` (manter a que vai para `1772136666814`)

### 3. Edges duplicadas nos nós "Trava"
Três nós "Trava" têm edge correta para seu nó condição E uma duplicada para `1772196913050`:

**3 edges a remover**:
- `1772134319850` → `1772196913050` (manter a que vai para `1772135608356`)
- `1772136527156` → `1772196913050` (manter a que vai para `1772136548363`)
- `1772136666814` → `1772196913050` (manter a que vai para `1772136698929`)

> Nota: Os nós `1772134316245`, `1772134325194` e `1772134329293` têm `1772196913050` como **única** saída, então essas edges são mantidas.

## Implementação

Uma única operação UPDATE no `flow_definition` do fluxo `abc6cfc0-...`:

1. **Remover 7 edges duplicadas** (IDs específicos listados acima)
2. **Adicionar 1 edge** para Drop Internacional → Menu Assunto

Nenhuma alteração em código frontend ou edge functions. Apenas correção de dados no `flow_definition` JSON.

