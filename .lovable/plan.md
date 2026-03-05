

# Plano: Adicionar abas "Horário Comercial" e "Tags" na página de Departamentos

## O que muda

Adicionar duas novas abas na página `src/pages/Departments.tsx`:

1. **"Horário Comercial"** -- Redireciona para `/settings/sla` (onde já existe a configuração completa de horário comercial e feriados)
2. **"Tags"** -- Redireciona para `/settings/tags` (onde já existe o gerenciamento de tags)

## Abordagem

Em vez de duplicar os componentes, as novas abas usarão `useNavigate` para redirecionar quando clicadas. Alternativa melhor: embutir os componentes diretamente nas abas se forem componentes reutilizáveis. Vou verificar qual abordagem é mais limpa.

**Opção escolhida**: Adicionar as abas como links de navegação rápida no TabsList, redirecionando ao clicar. Isso mantém a experiência centralizada sem duplicar código.

## Alteração

| Arquivo | O que |
|---|---|
| `src/pages/Departments.tsx` | Adicionar 2 `TabsTrigger` extras ("Horário Comercial" e "Tags") que ao serem clicados fazem `navigate("/settings/sla")` e `navigate("/settings/tags")` respectivamente. Importar `useNavigate` e ícones `Clock` (já importado) e `Tags` |

## Impacto

- Zero regressão: apenas adiciona triggers no TabsList existente
- Não altera nenhum componente ou rota existente
- Navegação intuitiva: o usuário encontra tudo no mesmo menu de Departamentos & Operações

