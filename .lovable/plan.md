

## Plano: Corrigir exibição de cargos desatualizados

### Problema
O campo `job_title` na tabela `profiles` está desatualizado para vários usuários. Exemplos:
- **Marco Cruz** → job_title: "Vendedor", role real: `cs_manager`
- **Ael** → job_title: "Vendedor", role real: `general_manager`
- **Danilo Pereira** → job_title: "Vendedor", role real: `support_manager`
- **Flavio, João, Larissa, GEISIANE** → job_title: "Vendedor", role real: `support_agent`
- **Ligia Martins** → job_title: "Vendedor", role real: `financial_agent`
- **Marcos Chen, Lucas Moreira** → job_title: "Vendedor", role real: `general_manager`
- **Oliveira** → job_title: "Consultor", role real: `admin`

### Solução (2 partes)

**1. Corrigir dados no banco** — Migração SQL para atualizar `job_title` com base no role real:

| Role | job_title correto |
|---|---|
| admin | Administrador |
| general_manager | Gerente Geral |
| manager | Gerente |
| sales_rep | Vendedor |
| consultant | Consultor |
| support_agent | Agente de Suporte |
| support_manager | Gerente de Suporte |
| financial_manager | Gerente Financeiro |
| financial_agent | Agente Financeiro |
| cs_manager | Gerente CS |
| ecommerce_analyst | Analista E-commerce |

Apenas atualiza onde `job_title` está vazio ou incorreto (diverge do role). Usuários com `job_title` customizado (ex: "Assistente de atendimento Pedidos", "Head Comercial") serão preservados.

**2. Dropdown de agentes no fluxo** — Alterar `TransferPropertiesPanel.tsx` e `useUsersByDepartment.tsx` para mostrar o **role real** do `user_roles` ao lado do nome, em vez de depender do `job_title` (que pode ficar desatualizado novamente).

### Arquivos alterados
| Arquivo | Alteração |
|---|---|
| Migração SQL | UPDATE profiles SET job_title baseado em user_roles |
| `src/hooks/useUsersByDepartment.tsx` | Incluir join com user_roles para trazer o role real |
| `src/components/chat-flows/TransferPropertiesPanel.tsx` | Mostrar label do role real no dropdown |

