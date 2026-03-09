

# Lista de Telefones WhatsApp na Organização

## Objetivo
Adicionar uma lista simples de telefones (nome + WhatsApp) diretamente na organização, sem criar contatos no CRM. Útil para registrar membros da equipe do cliente para fluxos de atendimento.

## Mudanças

### 1. Nova tabela: `organization_phones`
```sql
CREATE TABLE public.organization_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,          -- ex: "João - Financeiro"
  phone text NOT NULL,          -- número WhatsApp
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.organization_phones ENABLE ROW LEVEL SECURITY;

-- RLS: acesso para autenticados (mesma lógica das outras tabelas do CRM)
CREATE POLICY "Authenticated users can manage org phones"
  ON public.organization_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. Novo componente: `OrganizationPhonesSection`
- Renderizado dentro do `OrganizationContactsDialog` (ou como seção separada no card da org)
- Lista os telefones cadastrados com botão de remover
- Formulário inline: campos **Nome/Rótulo** + **WhatsApp** + botão Adicionar
- CRUD direto via Supabase SDK (insert/delete na `organization_phones`)

### 3. Editar `OrganizationContactsDialog.tsx`
- Adicionar a seção "Telefones WhatsApp" abaixo dos contatos vinculados
- Separador visual entre contatos CRM e telefones avulsos

### 4. Editar `useOrganizationContacts.tsx`
- Adicionar query para `organization_phones` (ou criar hook separado `useOrganizationPhones`)
- Mutations para add/remove phone

### 5. Exibir contagem no card da org (`Organizations.tsx`)
- Mostrar count de telefones extras ao lado dos contatos (ex: ícone de telefone com número)

## Sem impacto em features existentes
- Contatos CRM continuam funcionando igual
- Roteamento preferencial não é afetado (usa `contacts.organization_id`)
- Esses telefones são apenas registro/referência — não participam do fluxo de distribuição automaticamente

