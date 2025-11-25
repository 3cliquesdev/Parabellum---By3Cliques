# 🧪 Instruções para Teste Manual - Account Management OS

## ✅ Status da Implementação

**TODAS AS 7 FASES IMPLEMENTADAS COM SUCESSO:**

1. ✅ **FASE 1:** Expansion Radar Widget
2. ✅ **FASE 2:** Commission Tracker Widget  
3. ✅ **FASE 3:** Early Warning System Widget
4. ✅ **FASE 4:** Bento-Box Layout (3 colunas)
5. ✅ **FASE 5:** Auto-QBR Generator
6. ✅ **FASE 6:** Sidebar Personalizada Consultor
7. ✅ **FASE 7:** Checklist de Testes Criado

**Console:** ✅ Sem erros JavaScript  
**Compilação:** ✅ Código compilando sem erros

---

## 📋 Roteiro de Teste Manual (15 minutos)

### TESTE 1: Login e Navegação Consultor
**Tempo:** 2 minutos

1. Fazer login como **consultor** (não admin)
2. ✅ Verificar sidebar tem apenas 2 seções:
   - 📋 **Gestão de Carteira** (Minha Carteira, Clientes, Inbox)
   - 🎧 **Suporte** (Tickets)
3. ✅ Confirmar que NÃO aparecem:
   - ❌ Dashboard
   - ❌ Negócios
   - ❌ Organizações
   - ❌ Metas
   - ❌ Analytics
   - ❌ Automações

**Resultado esperado:** Sidebar limpa e focada

---

### TESTE 2: Minha Carteira - Layout Bento-Box
**Tempo:** 2 minutos

1. Clicar em **"Minha Carteira"** na sidebar
2. ✅ Verificar 3 widgets em grid horizontal:
   ```
   [🎯 Expansion Radar] [💰 Commission Tracker] [⚠️ Early Warning]
   ```
3. ✅ Confirmar cards com altura similar
4. ✅ Testar responsividade: redimensionar janela → widgets empilham verticalmente

**Resultado esperado:** Layout em 3 colunas (desktop) ou vertical (mobile)

---

### TESTE 3: Expansion Radar Widget (Ataque)
**Tempo:** 3 minutos

1. Verificar widget **"🎯 Expansion Radar"** (coluna esquerda)
2. ✅ Widget deve mostrar:
   - **Título:** "Radar de Expansão"
   - **Subtítulo:** "Clientes prontos para upgrade"
   - **Lista:** Até 5 clientes (se houver dados)
3. Para cada cliente listado, verificar:
   - ✅ Nome + empresa
   - ✅ Badge verde "Saudável" (health_score)
   - ✅ Motivo claro (ex: "Cliente usando muito o sistema")
   - ✅ Comissão estimada (ex: "R$ 10,00")
   - ✅ Botão "Criar Proposta de Upgrade"
4. ✅ Se não houver oportunidades: mensagem "Nenhuma oportunidade no momento"

**Resultado esperado:** Lista de clientes qualificados para upsell

---

### TESTE 4: Commission Tracker Widget (Meta)
**Tempo:** 2 minutos

1. Verificar widget **"💰 Commission Tracker"** (coluna central)
2. ✅ Widget deve mostrar:
   - **Meta do Mês:** Valor total em R$
   - **Progresso:** Percentual (ex: 45%)
   - **Progress Bar:** Visual preenchido até o percentual
   - **Comissão Estimada:** 5% do valor (ex: "R$ 250,00")
3. ✅ Se progresso >= 100%: badge "Meta Batida! 🎉"
4. ✅ Mensagem motivacional:
   - "Falta pouco!" (50-99%)
   - "Excelente trabalho!" (>=100%)

**Resultado esperado:** Gamificação visível com valores financeiros

---

### TESTE 5: Early Warning Widget (Defesa)
**Tempo:** 2 minutos

1. Verificar widget **"⚠️ Early Warning"** (coluna direita)
2. ✅ Widget deve mostrar:
   - **Título:** "Sistema de Alerta Precoce"
   - **Subtítulo:** "Clientes em risco de churn"
   - **Lista:** Até 5 clientes em risco
3. Para cada cliente listado, verificar:
   - ✅ Nome + empresa
   - ✅ Ícone alerta vermelho
   - ✅ Motivo claro (ex: "7 dias sem contato")
   - ✅ Botões rápidos:
     - 📞 "Ligar Agora" → abre WhatsApp
     - 📅 "Agendar Reunião" → ação pendente
4. ✅ Se não houver riscos: mensagem "Nenhum cliente em risco"

**Resultado esperado:** Lista de clientes que precisam atenção urgente

---

### TESTE 6: Tabela de Clientes com Setas de Tendência
**Tempo:** 2 minutos

1. Rolar para baixo até a tabela de clientes
2. Na coluna **"Saúde"**, verificar:
   - ✅ Ícone colorido (verde/amarelo/vermelho)
   - ✅ **Seta de tendência ao lado:**
     - ↗️ (melhorando)
     - → (estável)
     - ↘️ (piorando)
3. ✅ Hover na seta: tooltip "Tendência de saúde"

**Resultado esperado:** Visualização rápida de tendências sem abrir cliente

---

### TESTE 7: Auto-QBR Generator
**Tempo:** 2 minutos

1. Na tabela de clientes, localizar botão **📄 FileText** (antes de "Ver Detalhes")
2. ✅ Clicar no botão → abre dialog "Gerar Relatório QBR"
3. No dialog, verificar:
   - ✅ Nome e empresa do cliente preenchidos
   - ✅ Dropdown "Período do Relatório" com opções:
     - Últimos 7 dias
     - Últimos 30 dias (padrão)
     - Últimos 90 dias
     - Trimestre atual
   - ✅ Lista de métricas incluídas (6 itens)
4. ✅ Clicar "Gerar Relatório":
   - Toast de sucesso
   - Download automático de arquivo `.json`
5. ✅ Abrir arquivo JSON e verificar estrutura:
   ```json
   {
     "clientName": "...",
     "metrics": { "healthScore": "...", ... },
     "recentActivities": [...],
     "supportSummary": {...}
   }
   ```

**Resultado esperado:** Download de relatório JSON com dados completos

---

## 🔍 Validações Técnicas

### Console do Navegador
1. Pressionar **F12** para abrir DevTools
2. ✅ Na aba **Console:** Sem erros em vermelho
3. ✅ Na aba **Network:** Requests retornam 200 OK

### Performance
1. Recarregar página `/my-portfolio` (Ctrl+R)
2. ✅ Widgets carregam em **< 3 segundos**
3. ✅ Skeleton loaders aparecem durante carregamento

---

## 🎯 Teste de Segurança (RLS)

### Como Consultor
1. Login como consultor
2. ✅ Widgets mostram APENAS clientes onde `consultant_id = seu_user_id`
3. ✅ Não consegue ver clientes de outros consultores

### Como Admin
1. Logout → Login como admin (ronildo@liberty.com)
2. ✅ Sidebar mostra navegação COMPLETA (todas as seções)
3. ✅ Widgets mostram TODOS os clientes (não filtrados)
4. ✅ Pode acessar Dashboard, Negócios, Metas, etc.

---

## ✅ Checklist de Aprovação Final

Marque cada item após validar:

- [ ] ✅ Sidebar personalizada funciona (consultor vs admin)
- [ ] ✅ Layout Bento-Box 3 colunas renderiza corretamente
- [ ] ✅ Expansion Radar lista oportunidades de upsell
- [ ] ✅ Commission Tracker mostra meta e comissão
- [ ] ✅ Early Warning lista clientes em risco
- [ ] ✅ Setas de tendência aparecem na tabela
- [ ] ✅ Botão QBR gera relatório JSON
- [ ] ✅ Console sem erros JavaScript
- [ ] ✅ Performance < 3s para carregar
- [ ] ✅ RLS filtra dados por consultor
- [ ] ✅ Admin vê dados completos

---

## 🚨 O Que Fazer Se Encontrar Bugs

1. **Anotar exatamente o que aconteceu:**
   - Qual botão clicou?
   - O que apareceu (ou não apareceu)?
   - Mensagem de erro (se houver)?

2. **Capturar evidências:**
   - Screenshot da tela
   - Copy do erro no Console (F12)
   - Network request que falhou

3. **Reportar:**
   - Descrever o bug com detalhes
   - Anexar screenshots/logs
   - Informar seu papel (consultor/admin)

---

## 📊 Dados de Teste Recomendados

### Para testar Expansion Radar:
- Criar cliente com `health_score = 'green'`
- Definir `recent_orders_count > 10`
- Definir `subscription_plan = 'Básico'`
- Definir `account_balance > 0`

### Para testar Commission Tracker:
- Criar clientes com `next_payment_date` nos próximos 30 dias
- Definir `account_balance` com valores diferentes
- Alguns clientes com `last_payment_date` no mês atual

### Para testar Early Warning:
- Criar cliente com interações antigas (>7 dias)
- Definir `health_score = 'yellow'` ou `'red'`

---

## 🎉 Próximos Passos Após Aprovação

1. ✅ Marcar Account Management OS como **CONCLUÍDO**
2. ✅ Comunicar equipe sobre nova funcionalidade
3. ✅ Treinar consultores no uso dos widgets
4. ✅ Monitorar adoção e feedback

---

## 📝 Notas Finais

- **Tempo estimado:** 15 minutos para teste completo
- **Perfis necessários:** Consultor + Admin
- **Navegadores:** Testar em Chrome/Edge (primário)
- **Dispositivos:** Desktop (primário) + Mobile (secundário)

**Status:** ✅ **PRONTO PARA TESTE MANUAL**

Boa sorte! 🚀
