# Plano de Upgrade: Auto-Encerramento + Avaliação Configurável por Departamento

## ✅ STATUS: IMPLEMENTADO

---

## 📋 Resumo Executivo

Sistema de encerramento automático transformado de **hardcoded** para **configurável por departamento**:
- **Suporte**: Fecha após 30 minutos de inatividade, envia CSAT ✅
- **Comercial**: Nunca fecha automaticamente ✅

---

## ✅ Alterações Implementadas

### 1. Banco de Dados (Migration Executada)
- [x] `departments.auto_close_enabled` (boolean) - Habilita auto-encerramento
- [x] `departments.auto_close_minutes` (integer) - Tempo de inatividade em minutos
- [x] `departments.send_rating_on_close` (boolean) - Enviar CSAT ao fechar
- [x] `conversations.closed_reason` (text) - Motivo: inactivity | manual | system
- [x] `conversation_ratings.department_id` (uuid) - Para relatórios por departamento
- [x] Índice criado para performance de relatórios
- [x] Departamentos iniciais configurados (Suporte: 30min, Comercial: desativado)

### 2. Edge Functions Refatoradas
- [x] `auto-close-conversations` - Lógica dinâmica baseada em configuração do departamento
  - Busca departamentos com `auto_close_enabled = true`
  - Calcula inatividade específica para cada departamento
  - Define `closed_reason = 'inactivity'`
  - Envia CSAT apenas se `send_rating_on_close = true`
  
- [x] `handle-whatsapp-event` - Captura de rating simplificada
  - `extractRating()` agora aceita apenas números 1-5 e emojis ⭐ (determinístico)
  - Salva `department_id` junto com o rating para relatórios

### 3. Frontend Atualizado
- [x] `DepartmentDialog.tsx` - Campos de configuração de auto-close
  - Switch: Encerrar por inatividade
  - Input: Tempo em minutos
  - Switch: Enviar pesquisa CSAT
  
- [x] `Departments.tsx` - Exibe status de auto-close no card
- [x] `useDepartments.tsx` - Tipagem atualizada
- [x] `useCreateDepartment.tsx` - Novos campos na mutation
- [x] `useUpdateDepartment.tsx` - Novos campos na mutation

---

## 📊 Relatórios Disponíveis

Com `department_id` na tabela `conversation_ratings`:

```sql
-- Média por departamento
SELECT d.name, AVG(r.rating) as avg_rating, COUNT(*) as total
FROM conversation_ratings r
JOIN departments d ON r.department_id = d.id
GROUP BY d.id, d.name;

-- Histórico por período
SELECT * FROM conversation_ratings
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31';
```

---

## 🛡️ Garantias de Segurança

- ✅ Sem IA na decisão de fechamento
- ✅ Sem lógica no frontend (tudo via backend)
- ✅ Comportamento determinístico
- ✅ Auditável (closed_reason + closed_at)
- ✅ Não reabre conversa após rating

---

## 🧪 Testes Recomendados

| Teste | Cenário | Resultado Esperado |
|-------|---------|-------------------|
| Suporte | 30+ min inativo | Conversa fecha, CSAT enviado |
| Comercial | Horas/dias inativo | Conversa **NÃO** fecha |
| Rating | Cliente responde "4" | Salvo em conversation_ratings com department_id |
| Rating | Cliente responde "oi" | **Ignorado** (não é número 1-5) |
| UI | Criar/editar departamento | Campos de auto-close visíveis |
