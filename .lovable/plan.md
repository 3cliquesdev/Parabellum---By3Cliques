

# Diagnóstico: "Somente IA" + Data = 0 resultados

## Dados do Banco (verificação direta)

A combinação **"Somente IA sem humano" + data 10/03/2026** retorna corretamente **0 resultados** porque não existem conversas autopilot sem humano nesse dia. Os dados reais são:

```text
Data         | Conversas "Somente IA"
-------------|----------------------
10/03/2026   | 0  ← dia atual, sem dados
09/03        | 2
04/03        | 3
03/03        | 31
02/03        | 75
01/03        | 44
Total geral  | 740
```

Sem filtro de data, aparecem as 740 conversas. Com data 10/03, aparecem 0 — porque genuinamente não há dados nesse dia.

## O problema real

Não é um bug no código dos filtros — é falta de **feedback visual** para o usuário entender POR QUE o resultado é zero. O sistema deveria informar isso claramente.

## Plano de melhoria

### 1. Adicionar contador de resultados visível
No topo da lista de conversas (ou logo abaixo do header "Encerradas"), mostrar um badge com a contagem: **"216 conversas"** ou **"0 de 11.170 encerradas"**. Isso dá feedback imediato ao mudar filtros.

**Arquivo**: `src/components/ConversationList.tsx` ou componente pai que renderiza a lista.

### 2. Melhorar mensagem de estado vazio com contexto
Em vez de apenas "Nenhuma conversa encontrada", mostrar:
- "Nenhuma conversa com **Somente IA** encontrada para **10/03/2026**"
- Sugestão: "Tente ampliar o período ou remover filtros"

**Arquivo**: `src/components/ConversationList.tsx`

### 3. Log de diagnóstico mais detalhado
Adicionar as datas ISO exatas no console log para debug futuro.

**Arquivo**: `src/hooks/useInboxView.tsx` (log existente na linha 159-161)

