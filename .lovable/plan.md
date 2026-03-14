
## Plano: Configurar Base de Conhecimento e Controles em cada IA do Fluxo V4

### Situação Atual
- O fluxo V4 tem **11 nós de IA** (triagem + 10 especialistas)
- O nó de triagem usa categorias **desatualizadas** que não existem mais ("Cancelamento", "Importado", "Produto")
- Os demais nós provavelmente não têm categorias de KB vinculadas
- Existem **8 personas ativas** no sistema, cada uma com seu system_prompt especializado

### Mapeamento Proposto (Nó → Persona → Categorias KB → Controles)

| Nó | Persona | Categorias KB | Travas |
|---|---|---|---|
| **IA Triagem** (node_4) | Clicker | Dúvidas Gerais, Sobre a Empresa, Atendimento e Suporte, Planos e Ofertas | forbid_options: true, max_sentences: 2 |
| **IA Saque** (node_5) | Helper Saque | Financeiro e Pagamentos, Segurança | forbid_options: true, forbid_questions: false |
| **IA Financeiro** (node_6) | Helper Financeiro | Financeiro e Pagamentos, Segurança | forbid_options: true |
| **IA Cancelamento** (node_7) | Helper Cancelamento | Cancelamento e Políticas, Planos e Ofertas | forbid_options: true |
| **IA Devoluções** (node_8) | Helper Devoluções | Logística e Pedidos, Operação e Processos | forbid_options: false (precisa oferecer troca/reembolso) |
| **IA Pedidos** (node_9) | Helper Pedidos | Logística e Pedidos, Operação e Processos | forbid_options: true |
| **IA Sistema** (node_10) | Helper (Suporte) | Tecnologia e Integrações, Manual e Treinamento, Atendimento e Suporte | forbid_options: true |
| **IA Comercial** (node_11) | Clicker | Vendas, Planos e Ofertas, Produtos e Serviços, Benefícios e Qualidade | forbid_options: false |
| **IA Internacional** (node_12) | Clicker | Vendas, Planos e Ofertas, Produtos e Serviços | forbid_options: false |
| **IA Consultor** (node_13) | Clicker | Sobre a Empresa, Atendimento e Suporte | forbid_options: true, max_sentences: 2 |
| **IA Suporte** (node_14) | Helper (Suporte) | Atendimento e Suporte, Manual e Treinamento, Dúvidas Gerais, Tecnologia e Integrações | forbid_options: true |

### O que será feito
1. **Atualizar o `flow_definition` (JSON)** do fluxo V4 no banco de dados, configurando em cada nó `ai_response`:
   - `persona_id` e `persona_name` corretos
   - `kb_categories` com as categorias padronizadas relevantes
   - `forbid_options`, `forbid_questions`, `max_sentences`, `fallback_message`
   - `context_prompt` (instruções extras específicas por nó quando necessário)

2. **Nenhuma alteração de código** -- é apenas uma atualização de dados no campo `flow_definition` da tabela `chat_flows`

### Detalhe Importante
- As personas já possuem `knowledge_base_paths: null` (acesso global), mas as `kb_categories` no nó filtram o que a IA consulta no RAG **durante aquele nó específico**
- Isso garante que a IA de Saque só busque artigos de "Financeiro e Pagamentos" e não traga artigos de "Marketing e Escala", por exemplo
