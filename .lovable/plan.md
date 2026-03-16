

# Bug: Nome do cliente exibindo nome de produto

## Causa Raiz

**1.122 contatos** importados via `csv_import` tiveram o **nome do produto** mapeado para o campo `first_name` e o **nome real da pessoa** no campo `last_name`.

Exemplos no banco:
| first_name | last_name |
|---|---|
| TV Stick Smart TV Android 4K – Wi-fi, HDMI, Streaming LB-007 | Erike Diego Silva de Souza Vale |
| 1 UNIDADE - Câmera Lâmpada de Segurança Vigilância IP Wi-Fi 360° | Evandro Dias da Assunção |
| Game Stick 4K Retrô 10.000 Jogos | JAIR ANTUNES |

O código do dialog de ticket exibe `{first_name} {last_name}`, então aparece "TV Stick... Pedro Henrique Silva Correia".

## Correção (duas partes)

### 1. Migration: Corrigir os 1.122 contatos existentes

Rodar um SQL que:
- Identifica contatos com `source = 'csv_import'` e `first_name` com padrão de produto (length > 50 ou contendo palavras-chave como "UNIDADE", "Stick", "Câmera", "4K", etc.)
- Move o `last_name` atual para `first_name` (split em first/last corretamente)
- Salva o nome do produto antigo em `metadata` (JSONB) para não perder a informação

```sql
-- Lógica: Para contatos com produto no first_name,
-- splittar o last_name (nome real) em first/last e 
-- guardar o product_name antigo no metadata
UPDATE contacts
SET 
  first_name = split_part(last_name, ' ', 1),
  last_name = CASE 
    WHEN array_length(string_to_array(last_name, ' '), 1) > 1 
    THEN substring(last_name from position(' ' in last_name) + 1)
    ELSE last_name 
  END,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('imported_product_name', first_name)
WHERE source = 'csv_import'
  AND (length(first_name) > 50 
    OR first_name ILIKE '%UNIDADE%' 
    OR first_name ILIKE '%Stick%' 
    OR first_name ILIKE '%Câmera%'
    OR first_name ILIKE '%Smart TV%'
    OR first_name ILIKE '%Retrô%');
```

### 2. Prevenção: Validação no CSV import

Verificar o fluxo de importação CSV (provavelmente via Edge Function) e adicionar validação para rejeitar/alertar quando `first_name` tem mais de 50 caracteres ou padrões de produto.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Corrigir 1.122 contatos com produto no first_name |
| Edge Function de import CSV (se existir) | Adicionar validação de tamanho/padrão no first_name |

## Impacto

- Corrige imediatamente os nomes exibidos em tickets, inbox e todos os componentes que usam `displayName()`
- Preserva o nome do produto original no campo `metadata` para referência

