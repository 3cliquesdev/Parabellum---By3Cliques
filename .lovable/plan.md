
## Plano: Completar Importação Kiwify e Corrigir Busca de Clientes

### Situação Atual

**Importação Kiwify:**
| Métrica | Valor |
|---------|-------|
| Clientes únicos nos webhooks | 5.739 |
| Já existem no banco | 5.694 (99.2%) |
| Faltando importar | 50 |

A importação via API (`import-kiwify-contacts`) está travando por timeout. A maioria dos clientes já foi importada via CSV ou webhooks anteriores.

**Problema da Busca:**
O cliente `juh.naiara@gmail.com` **existe no banco** (JULIA NAIARA FREITAS COUTINHO, status: customer). O problema é que a busca no modal de criação de tickets não encontrou porque:
- A busca funciona corretamente via service role (backend)
- Pode haver um problema de case-sensitivity ou cache no frontend

---

### Ações Planejadas

#### 1. Importar os 50 contatos faltantes via SQL direto
Executar uma inserção direta usando os dados dos webhooks Kiwify já existentes na tabela `kiwify_events`:

```sql
INSERT INTO contacts (email, first_name, last_name, phone, document, source, status, blocked)
SELECT DISTINCT ON (lower((payload->'Customer'->>'email')::text))
  lower((payload->'Customer'->>'email')::text) as email,
  COALESCE(
    (payload->'Customer'->>'first_name')::text, 
    split_part((payload->'Customer'->>'full_name')::text, ' ', 1),
    'Cliente'
  ) as first_name,
  COALESCE(
    (payload->'Customer'->>'last_name')::text,
    CASE 
      WHEN array_length(string_to_array((payload->'Customer'->>'full_name')::text, ' '), 1) > 1 
      THEN array_to_string((string_to_array((payload->'Customer'->>'full_name')::text, ' '))[2:], ' ')
      ELSE NULL
    END
  ) as last_name,
  COALESCE(
    (payload->'Customer'->>'mobile')::text, 
    (payload->'Customer'->>'mobile_phone')::text
  ) as phone,
  COALESCE(
    (payload->'Customer'->>'CPF')::text, 
    (payload->'Customer'->>'cpf')::text
  ) as document,
  'kiwify_import' as source,
  'customer' as status,
  false as blocked
FROM kiwify_events 
WHERE event_type IN ('paid', 'order_approved')
  AND (payload->'Customer'->>'email') IS NOT NULL
  AND lower((payload->'Customer'->>'email')::text) NOT IN (
    SELECT lower(email) FROM contacts WHERE email IS NOT NULL
  )
ORDER BY lower((payload->'Customer'->>'email')::text), created_at DESC;
```

#### 2. Cancelar jobs de importação travados
Limpar a fila de importação para evitar processamento desnecessário:

```sql
UPDATE kiwify_import_queue SET status = 'cancelled' WHERE status IN ('pending', 'processing');
UPDATE sync_jobs SET status = 'cancelled', completed_at = NOW() WHERE status = 'running' AND job_type = 'kiwify_contacts_import';
```

---

### Resultado Esperado

| Antes | Depois |
|-------|--------|
| 5.694 contatos Kiwify | 5.744 contatos Kiwify |
| 50 faltando | 0 faltando |
| Busca não encontra alguns clientes | Todos os clientes da Kiwify disponíveis para busca |

---

### Arquivos a Modificar

Nenhum arquivo precisa ser modificado - apenas execução de SQL no banco.

---

### Seção Técnica

A importação via API da Kiwify (`process-kiwify-import-queue`) está dando timeout devido ao rate limiting da API externa. A solução mais eficiente é usar os dados já coletados via webhooks (`kiwify_events`) que contêm 8.630 registros de vendas com dados completos dos clientes.
