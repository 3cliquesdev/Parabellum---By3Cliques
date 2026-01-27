

## Plano: Simplificar Fluxo de Identificacao SEM Perder Funcionalidades

### Analise Comparativa

Comparei seu codigo proposto com o sistema atual (5774 linhas):

| Recurso | Seu Codigo | Sistema Atual | Veredicto |
|---------|-----------|---------------|-----------|
| Identificacao por telefone | SIM | SIM (via Kiwify) | Manter atual |
| Pedido de email | SIM | SIM | Manter atual |
| Verificacao de cliente na base | SIM | SIM + binding automatico | Manter atual |
| OTP para operacoes financeiras | SIM | SIM (via send-financial-otp) | Manter atual |
| Triagem por departamento | NAO | SIM (Comercial/Suporte/Sistema) | Manter atual |
| Chat Flows | NAO | SIM | Manter atual |
| Knowledge Base + RAG | NAO | SIM | Manter atual |
| Modo Estrito Anti-Alucinacao | NAO | SIM | Manter atual |
| Confidence Score | NAO | SIM | Manter atual |
| Cache de respostas | NAO | SIM | Manter atual |
| Suporte Meta + Evolution | NAO | SIM | Manter atual |
| Rate limiting | NAO | SIM | Manter atual |

**Conclusao:** Seu codigo e um downgrade significativo - perderia 80% das funcionalidades. Mas a IDEIA esta correta: simplificar o fluxo de identificacao.

---

### Problema Real Identificado

Olhando os logs, o problema nao e a arquitetura - e a **execucao**:

1. **Modelo Gemini ruim**: `google/gemini-2.5-flash` responde de forma inconsistente
2. **Transferencias para departamento errado**: A logica de `pickDepartment` e muito simples
3. **Email nao pedido corretamente**: Fluxo de deteccao de lead funciona, mas as mensagens nao sao claras

---

### Solucao: Refatorar SEM Downgrade

Em vez de substituir 5774 linhas por 60 linhas (perdendo tudo), vamos:

#### 1. Forcar OpenAI como Modelo Padrao

Alterar o fallback de `google/gemini-2.5-flash` para `openai/gpt-5-mini`:

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts` (linha 18)

```typescript
// ANTES
return data?.value || 'google/gemini-2.5-flash';

// DEPOIS  
return data?.value || 'openai/gpt-5-mini';
```

#### 2. Inserir Configuracao no Banco

Migration SQL para garantir que OpenAI seja o padrao:

```sql
INSERT INTO system_configurations (key, value, description)
VALUES ('ai_default_model', 'openai/gpt-5-mini', 'Modelo padrao para IA')
ON CONFLICT (key) DO UPDATE SET value = 'openai/gpt-5-mini';
```

#### 3. Melhorar Mensagens de Identificacao

Atualizar templates no banco `ai_message_templates`:

```sql
-- Template para pedir email (mais direto)
INSERT INTO ai_message_templates (key, content, is_active)
VALUES (
  'identity_wall_ask_email',
  'Para dar continuidade ao seu atendimento, por favor me informe o email utilizado em sua compra.',
  true
)
ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
```

#### 4. Simplificar pickDepartment

Melhorar a funcao de deteccao de departamento (linha 493-506):

```typescript
// DEPOIS - Mais preciso
function pickDepartment(question: string): string {
  const q = question.toLowerCase();
  
  // Financeiro - Prioridade alta (dinheiro envolvido)
  if (/saque|pix|reembolso|estorno|comissão|dinheiro|pagamento|carteira|transferência/i.test(q)) {
    return 'financeiro';
  }
  
  // Tecnico - Problemas de sistema
  if (/erro|bug|login|senha|acesso|não funciona|travou|caiu|site fora/i.test(q)) {
    return 'tecnico';
  }
  
  // Comercial - Vendas/Propostas (leads)
  if (/preço|proposta|plano|quanto custa|comprar|assinar|desconto|trial|teste/i.test(q)) {
    return 'comercial';
  }
  
  // Logistica - Entregas
  if (/envio|entrega|rastreio|transportadora|correios|prazo|encomenda/i.test(q)) {
    return 'logistica';
  }
  
  // Default: Suporte geral
  return 'suporte_n1';
}
```

---

### Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Modificar | Mudar fallback para OpenAI, melhorar pickDepartment |
| Migration SQL | Criar | Inserir `ai_default_model = openai/gpt-5-mini` |

---

### Secao Tecnica: Mudancas Especificas

**1. Linha 18 - Fallback do modelo:**

```typescript
// src/functions/ai-autopilot-chat/index.ts linha 18
// ANTES:
return data?.value || 'google/gemini-2.5-flash';

// DEPOIS:
return data?.value || 'openai/gpt-5-mini';
```

**2. Linhas 493-506 - pickDepartment melhorado:**

```typescript
function pickDepartment(question: string): string {
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Ordem de prioridade: Financeiro > Tecnico > Comercial > Logistica > Suporte
  const rules: Array<{ dept: string; patterns: RegExp }> = [
    { dept: 'financeiro', patterns: /saque|pix|reembolso|estorno|comiss[aã]o|dinheiro|pagamento|carteira|transfer[eê]ncia|boleto|fatura|cobran[cç]a/ },
    { dept: 'tecnico', patterns: /erro|bug|login|senha|acesso|n[aã]o funciona|travou|caiu|site fora|api|integra[cç][aã]o|token/ },
    { dept: 'comercial', patterns: /pre[cç]o|proposta|plano|quanto custa|comprar|assinar|desconto|trial|teste|orcamento|catalogo|tabela/ },
    { dept: 'logistica', patterns: /envio|entrega|rastreio|transportadora|correios|prazo|encomenda|coleta/ },
  ];
  
  for (const rule of rules) {
    if (rule.patterns.test(q)) return rule.dept;
  }
  
  return 'suporte_n1';
}
```

---

### Resultado Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Modelo AI padrao | Gemini (inconsistente) | OpenAI GPT-5-mini (estavel) |
| Deteccao de departamento | Keyword simples | Regex com prioridade |
| Mensagem de email | Generica | Direta e clara |
| Funcionalidades existentes | 100% | 100% (sem downgrade) |

---

### Por que NAO Usar seu Codigo

Seu codigo proposto perderia:

- Chat Flows (fluxos visuais)
- Knowledge Base + RAG (respostas baseadas em artigos)
- Modo Estrito Anti-Alucinacao
- Confidence Score (decisao inteligente de handoff)
- Cache de respostas (performance)
- Suporte a Meta WhatsApp + Evolution
- Rate limiting
- Triagem por departamento
- Few-shot learning (exemplos de treinamento)
- Persona routing (diferentes personas por canal)
- OTP via edge function separada (mais seguro)
- Integracao Kiwify para auto-identificacao

Todas essas funcionalidades levaram meses para desenvolver e estao funcionando. O problema e so o modelo AI e alguns prompts.

