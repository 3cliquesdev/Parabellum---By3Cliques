# 🧪 Chat Routing & Transfer - Checklist de Testes End-to-End

## FASE 6: Validação Completa do Sistema de Roteamento Inteligente

### ✅ Pré-requisitos
- [ ] Migration executada com sucesso (campo `department` adicionado)
- [ ] Pelo menos 3 departamentos ativos cadastrados: Vendas, Suporte, Financeiro
- [ ] Usuários criados e atribuídos a departamentos diferentes:
  - [ ] 1 usuário `sales_rep` no departamento Vendas
  - [ ] 1 usuário `support_agent` no departamento Suporte
  - [ ] 1 usuário `admin` (vê tudo)

---

## 📋 Cenários de Teste

### **CENÁRIO 1: Concierge Menu (Triagem Inicial)**
**Objetivo:** Validar que o menu de seleção de departamento funciona

**Passos:**
1. Abrir navegador em modo anônimo/privado
2. Acessar `/public-chat` (sem parâmetros)
3. Verificar que aparece o menu "Como podemos ajudar você hoje?"
4. Verificar que há botões para cada departamento ativo (com emojis e nomes)

**Resultado Esperado:**
- ✅ Menu Concierge exibido
- ✅ Botões de departamento visíveis e clicáveis
- ✅ Design responsivo e profissional

---

### **CENÁRIO 2: Roteamento via Concierge para Suporte**
**Objetivo:** Conversa iniciada pelo Concierge cai na fila correta

**Passos:**
1. No `/public-chat`, clicar em "🛠️ Suporte Técnico"
2. Aguardar criação da conversa
3. Fazer login como `support_agent`
4. Ir para `/inbox` tab "Fila Humana"
5. Verificar se a nova conversa aparece na lista

**Resultado Esperado:**
- ✅ Conversa criada com `department = Suporte`
- ✅ Conversa visível APENAS para support_agent (não para sales_rep)
- ✅ Badge de departamento "🏢 Suporte" aparece no card da conversa

---

### **CENÁRIO 3: Deep Link Direto (Bypass Concierge)**
**Objetivo:** Link parametrizado cria conversa diretamente no departamento

**Passos:**
1. Fazer login como `admin`
2. Ir para `/settings/chat-links`
3. Copiar link do departamento "Vendas"
4. Abrir navegador em modo anônimo
5. Colar o link copiado (ex: `/public-chat?dept=comercial`)
6. Verificar que NÃO aparece menu Concierge
7. Verificar mensagem "Você está falando com o time de Vendas"

**Resultado Esperado:**
- ✅ Menu Concierge pulado
- ✅ Conversa criada diretamente em Vendas
- ✅ Mensagem de confirmação de departamento exibida

---

### **CENÁRIO 4: Transferência Entre Departamentos com Nota**
**Objetivo:** Transferir conversa de Vendas para Suporte preservando contexto

**Passos:**
1. Criar conversa em Vendas (via deep link ou Concierge)
2. Fazer login como `sales_rep` (usuário de Vendas)
3. Abrir a conversa no `/inbox`
4. Clicar no botão "Transferir Conversa"
5. Selecionar departamento "Suporte"
6. Verificar que dropdown de usuários mostra APENAS agentes de Suporte
7. Selecionar um agente de Suporte
8. Escrever nota: "Cliente precisa reset de senha urgente"
9. Confirmar transferência
10. Fazer logout e login como `support_agent`
11. Ir para `/inbox` e abrir a conversa transferida

**Resultado Esperado:**
- ✅ Conversa desaparece da fila do sales_rep
- ✅ Conversa aparece na fila do support_agent
- ✅ Badge "⚠️ Transferido de Vendas" visível no header do chat
- ✅ Nota interna amarela exibida: "Cliente precisa reset de senha urgente"
- ✅ Histórico completo de mensagens preservado

---

### **CENÁRIO 5: RLS - Isolamento de Departamento**
**Objetivo:** Garantir que usuários não vejam conversas de outros departamentos

**Passos:**
1. Criar 2 conversas:
   - Conversa A em Vendas
   - Conversa B em Suporte
2. Fazer login como `sales_rep`
3. Ir para `/inbox`
4. Verificar conversas listadas

**Resultado Esperado:**
- ✅ `sales_rep` vê APENAS Conversa A (Vendas)
- ✅ `sales_rep` NÃO vê Conversa B (Suporte)
- ✅ Tentar acessar diretamente Conversa B via URL retorna erro 403

**Passos Adicionais:**
5. Fazer login como `admin`
6. Ir para `/inbox`

**Resultado Esperado:**
- ✅ `admin` vê AMBAS as conversas (A e B)
- ✅ Sem restrição de departamento para admin

---

### **CENÁRIO 6: Filtros de Departamento no Inbox**
**Objetivo:** Filtrar conversas por departamento

**Passos:**
1. Fazer login como `admin` (para ver tudo)
2. Criar pelo menos 1 conversa em cada departamento (Vendas, Suporte, Financeiro)
3. Ir para `/inbox`
4. Verificar que há botões de filtro por departamento
5. Clicar em "🏢 Todos"
6. Verificar quantidade total
7. Clicar em "💰 Vendas"
8. Verificar que lista mostra APENAS conversas de Vendas

**Resultado Esperado:**
- ✅ Filtros dinâmicos baseados nos departamentos ativos
- ✅ Contador de conversas por departamento correto
- ✅ Lista atualiza ao trocar filtro

---

### **CENÁRIO 7: Gerador de Links na Página de Configurações**
**Objetivo:** Validar interface de geração de links

**Passos:**
1. Fazer login como `admin`
2. Ir para `/settings/chat-links`
3. Verificar que há uma seção para cada departamento ativo
4. Clicar em "Copiar Link" de Suporte
5. Verificar que link foi copiado para clipboard
6. Clicar em "Abrir Portal"
7. Verificar que abre em nova aba diretamente no chat de Suporte

**Resultado Esperado:**
- ✅ Interface mostra todos os departamentos ativos
- ✅ Botões "Copiar Link" e "Abrir Portal" funcionam
- ✅ Links gerados estão corretos (formato: `/public-chat?dept={id}`)

---

## 🐛 Checklist de Debugging

### Console Errors
- [ ] Nenhum erro no console do navegador ao acessar `/public-chat`
- [ ] Nenhum erro ao criar conversa via Concierge
- [ ] Nenhum erro ao transferir conversa

### Edge Function Logs
- [ ] `create-public-conversation` executa sem erros
- [ ] Log mostra `department_id` correto sendo passado
- [ ] Contact criado/atualizado corretamente

### Database Verification
Executar queries para validar:

```sql
-- Verificar conversas têm departamento
SELECT id, contact_id, department, ai_mode, status 
FROM conversations 
ORDER BY created_at DESC 
LIMIT 10;

-- Verificar interactions de transferência
SELECT * FROM interactions 
WHERE type = 'conversation_transferred' 
ORDER BY created_at DESC 
LIMIT 5;

-- Verificar departamentos ativos
SELECT * FROM departments WHERE is_active = true;
```

**Resultado Esperado:**
- ✅ Todas as conversas novas têm `department` preenchido
- ✅ Interactions de transferência contêm metadata com departamentos e nota

---

## ✅ Critérios de Aceitação Final

Para considerar a implementação **COMPLETA E APROVADA**, todos os itens abaixo devem ser validados:

- [ ] **CENÁRIO 1** - Concierge menu funcional
- [ ] **CENÁRIO 2** - Roteamento correto por departamento
- [ ] **CENÁRIO 3** - Deep links funcionam e pulam Concierge
- [ ] **CENÁRIO 4** - Transferência preserva histórico e exibe nota interna
- [ ] **CENÁRIO 5** - RLS impede acesso cross-department (exceto admin)
- [ ] **CENÁRIO 6** - Filtros de departamento no Inbox funcionam
- [ ] **CENÁRIO 7** - Gerador de links operacional
- [ ] **Zero erros** no console do navegador
- [ ] **Edge Function logs** confirmam execução bem-sucedida
- [ ] **Database queries** mostram dados consistentes

---

## 🚀 Próximos Passos Após Aprovação

Quando todos os testes passarem:
1. ✅ Documentar feature no README do projeto
2. ✅ Criar memória da implementação completa
3. ✅ Iniciar próxima feature (se houver)

---

**Status Atual:** 🔴 Aguardando Testes Manuais pelo Usuário
