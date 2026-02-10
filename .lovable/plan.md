

# Adicionar campo obrigatório "Operação" aos Tickets

## Resumo

Criar um cadastro editável de **Operações** (similar a Departamentos/Categorias) e adicionar um dropdown obrigatório "Operação" no formulário de criação de tickets. As 3 operações iniciais serão: **Nacional**, **Internacional**, **Híbrido**.

---

## Etapas

### 1. Criar tabela `ticket_operations` no banco de dados

Estrutura idêntica à `ticket_categories` para manter consistência:
- `id` (uuid, PK)
- `name` (text, NOT NULL, UNIQUE)
- `description` (text, nullable)
- `color` (text, default '#6B7280')
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamps)

Seed com 3 registros: Nacional, Internacional, Híbrido.

RLS: leitura para usuários autenticados, escrita para admins/managers.

### 2. Adicionar coluna `operation_id` na tabela `tickets`

- Tipo: `uuid`, nullable (para compatibilidade com tickets antigos)
- FK referenciando `ticket_operations.id`

### 3. Criar hook `useTicketOperations`

Arquivo: `src/hooks/useTicketOperations.tsx`

Espelho do `useTicketCategories` existente -- query simples com cache, filtrando por `is_active = true`.

### 4. Atualizar `CreateTicketDialog`

- Importar `useTicketOperations`
- Adicionar estado `operationId`
- Adicionar dropdown "Operação *" (obrigatório) entre Prioridade/Categoria e Tags
- Incluir `operation_id` no payload de criação
- Bloquear submit se `operationId` estiver vazio

### 5. Atualizar `useCreateTicket`

- Aceitar `operation_id` no tipo `CreateTicketData`
- Passar para o insert do ticket

### 6. Exibir Operação no `TicketDetails`

- Mostrar a operação do ticket na seção de informações laterais (junto com departamento, categoria, etc.)

### 7. (Opcional futuro) Tela de CRUD de Operações

A tabela já estará pronta para um CRUD em "Cadastros > Operações" na sidebar, similar a Categorias e Departamentos. Isso pode ser feito em um passo futuro.

---

## Detalhes Técnicos

### Migration SQL

```text
-- Tabela de operações
CREATE TABLE public.ticket_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6B7280',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed
INSERT INTO public.ticket_operations (name) VALUES
  ('Nacional'), ('Internacional'), ('Híbrido');

-- RLS
ALTER TABLE public.ticket_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read operations"
  ON public.ticket_operations FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins can manage operations"
  ON public.ticket_operations FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager','general_manager'))
  );

-- Coluna na tickets
ALTER TABLE public.tickets ADD COLUMN operation_id uuid REFERENCES public.ticket_operations(id);

-- Realtime (opcional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_operations;
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useTicketOperations.tsx` | Novo hook (query + create mutation) |
| `src/hooks/useCreateTicket.tsx` | Adicionar `operation_id` ao tipo e ao insert |
| `src/components/support/CreateTicketDialog.tsx` | Dropdown obrigatório de Operação |
| `src/components/TicketDetails.tsx` | Exibir operação nos detalhes |

### Impacto

- Zero regressao: coluna `operation_id` é nullable, tickets antigos continuam funcionando
- O campo é obrigatório apenas no formulário de criação (validação no frontend)
- A tabela `ticket_operations` segue o mesmo padrão de `ticket_categories`, facilitando manutenção futura

