# Account Management OS - Testing Checklist

## FASE 7: End-to-End Testing

### ✅ FASE 1: Expansion Radar Widget
- [ ] Hook `useExpansionOpportunities` busca clientes do consultor
- [ ] Detecta clientes com `health_score = "green"` 
- [ ] Critério 1: Uso intenso (pedidos > média * 1.5)
- [ ] Critério 2: Plano básico com saldo positivo
- [ ] Critério 3: Onboarding completo recente (<60 dias)
- [ ] Widget exibe top 5 oportunidades ordenadas por pedidos
- [ ] Comissão estimada calculada (R$ 10 por upgrade)
- [ ] Botão "Criar Proposta de Upgrade" funcional
- [ ] Mensagens apropriadas quando sem oportunidades

**Teste Manual:**
1. Login como consultor
2. Navegar para /my-portfolio
3. Verificar widget "🎯 Expansion Radar"
4. Confirmar clientes listados atendem critérios
5. Clicar em "Criar Proposta de Upgrade"

---

### ✅ FASE 2: Commission Tracker Widget
- [ ] Hook `useCommissionTracker` calcula meta mensal
- [ ] Busca clientes com `next_payment_date` nos próximos 30 dias
- [ ] Calcula progresso baseado em pagamentos efetuados
- [ ] Comissão estimada em 5% do valor renovado
- [ ] Badge "Meta Batida! 🎉" quando progresso >= 100%
- [ ] Progress bar visual atualiza corretamente
- [ ] Mensagens motivacionais ("Falta pouco!", "Excelente!")

**Teste Manual:**
1. Verificar widget "💰 Commission Tracker"
2. Confirmar meta total e progresso
3. Verificar comissão estimada (5%)
4. Testar com diferentes datas de `next_payment_date`

---

### ✅ FASE 3: Early Warning System Widget
- [ ] Hook `useChurnPrediction` analisa tendências de saúde
- [ ] Detecta mudanças de padrão (era regular, agora silencioso)
- [ ] Identifica clientes >7 dias sem contato (antes regular)
- [ ] Calcula tendência (↘️ down, ↗️ up, → stable)
- [ ] Widget lista top 5 clientes em risco
- [ ] Botões "Ligar Agora" e "Agendar Reunião" funcionais
- [ ] Ícone de alerta vermelho para clientes críticos

**Teste Manual:**
1. Verificar widget "⚠️ Early Warning"
2. Confirmar clientes em risco listados
3. Testar botão WhatsApp
4. Verificar setas de tendência na tabela principal

---

### ✅ FASE 4: Bento-Box Layout
- [ ] Grid de 3 colunas no /my-portfolio
- [ ] Coluna 1: Expansion Radar (Ataque)
- [ ] Coluna 2: Commission Tracker (Meta)
- [ ] Coluna 3: Early Warning (Defesa)
- [ ] Layout responsivo em mobile (stacked)
- [ ] Cards com altura equilibrada

**Teste Manual:**
1. Verificar layout 3 colunas em desktop
2. Redimensionar para mobile
3. Confirmar ordem: Ataque → Meta → Defesa

---

### ✅ FASE 5: Auto-QBR Generator
- [ ] Hook `useGenerateQBR` compila dados do cliente
- [ ] Busca interações dos últimos X dias
- [ ] Busca tickets de suporte
- [ ] Calcula health score e onboarding progress
- [ ] Dialog permite seleção de período
- [ ] Gera arquivo JSON com métricas completas
- [ ] Toast de sucesso ao gerar relatório
- [ ] Botão na tabela de clientes funcional

**Teste Manual:**
1. Clicar em botão FileText na linha do cliente
2. Selecionar período (30/90 dias)
3. Clicar "Gerar Relatório"
4. Verificar download do arquivo JSON
5. Conferir métricas no arquivo

---

### ✅ FASE 6: Sidebar Personalizada Consultor
- [ ] Consultores veem apenas 3 seções
- [ ] Seção "Gestão de Carteira": Minha Carteira, Clientes, Inbox
- [ ] Seção "Suporte": Tickets
- [ ] Consultores NÃO veem: Dashboard, Negócios, Organizações
- [ ] Consultores NÃO veem: Automações, Analytics, Metas
- [ ] Consultores NÃO veem: Gestão (Produtos, Usuários)
- [ ] Admin/Manager veem navegação completa

**Teste Manual:**
1. Login como consultant (não admin/manager)
2. Verificar sidebar tem apenas 2 seções
3. Confirmar links: Minha Carteira, Clientes, Inbox, Tickets
4. Logout e login como admin
5. Confirmar navegação completa visível

---

### ✅ Integração Completa
- [ ] Todos os 3 widgets carregam sem erros
- [ ] Performance: widgets carregam em <3 segundos
- [ ] Dados sincronizados entre widgets
- [ ] Cliente em Expansion também pode estar em Early Warning
- [ ] Filtros da tabela funcionam com widgets
- [ ] Console sem erros JavaScript
- [ ] Network requests retornam 200 OK
- [ ] RLS policies aplicadas corretamente

**Teste Manual:**
1. Console do navegador sem erros
2. Network tab: todas requests 200 OK
3. Testar como sales_rep (vê apenas próprios clientes)
4. Testar como consultant (navegação limitada)
5. Testar como admin (vê todos os dados)

---

## Checklist de Bugs Conhecidos

### ❌ Issues Encontradas
- [ ] useExpansionOpportunities: verificar se `consultant_id` está correto
- [ ] useChurnPrediction: garantir cálculo de tendência não causa loop
- [ ] QBRGeneratorDialog: validar se todos os campos são populados
- [ ] Sidebar: confirmar isConsultant funciona sem isAdmin

### ✅ Issues Resolvidas
- ✅ Layout 3 colunas implementado
- ✅ Hooks criados e funcionais
- ✅ Widgets integrados no MyPortfolio
- ✅ Dialog QBR criado
- ✅ Sidebar personalizada implementada

---

## Próximos Passos (Pós-FASE 7)

Após validação end-to-end, considerar:
1. **FASE 8 (opcional)**: Geração real de PDF com biblioteca
2. **FASE 9 (opcional)**: Notificações push para Early Warning
3. **FASE 10 (opcional)**: Dashboard Analytics para consultores
4. **FASE 11 (opcional)**: Integração com calendário para reuniões

---

## Status Final

**Data:** [Preencher após testes]
**Testado por:** [Ronildo]
**Status:** 
- [ ] ✅ Todas as fases aprovadas
- [ ] ⚠️ Issues menores encontradas
- [ ] ❌ Issues críticas bloqueiam release

**Observações:**
[Adicionar notas sobre testes aqui]
