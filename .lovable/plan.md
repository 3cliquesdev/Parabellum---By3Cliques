

# Correção: IA Alucinando Nome da Empresa ("HidraPure")

## Diagnóstico

A IA se apresentou como "assistente virtual da HidraPure" porque:
- A persona **Helper** tem um system_prompt genérico: "assistente virtual de atendimento ao cliente" — **sem nome da empresa**
- A instrução de onboarding (primeira mensagem) também **não injeta o nome da marca**
- Sem referência explícita, a LLM **alucionou** "HidraPure" (que é apenas uma organização-cliente cadastrada no CRM)
- HidraPure **não** está em knowledge articles, training examples, flow definitions, ou branding config

## Solução

Injetar o **nome da marca da empresa** dinamicamente no system prompt do `ai-autopilot-chat`, buscando da tabela `email_branding` (que já tem "3Cliques | CRM" como default).

### Alterações no `ai-autopilot-chat/index.ts`:

1. **Buscar brand name** no início do processamento (junto com os outros enrichments):
   - Query: `email_branding` → `is_default_customer = true` → campo `name`
   - Fallback: `system_configurations` key `company_name` → fallback final: sem menção

2. **Injetar no system prompt** (linha ~7438):
   - Antes do persona.system_prompt, adicionar: `Você trabalha para a empresa ${brandName}.`
   - Isso garante que a LLM **nunca alucine** um nome de empresa

3. **Injetar na instrução de onboarding** (linha ~7365):
   - Atualizar o template para incluir: `- Empresa: ${brandName}` 
   - Instrução explícita: "NÃO invente nomes de empresa. Use EXATAMENTE o nome informado."

4. **Diferenciar `contactOrgName`**: Adicionar nota no prompt deixando claro que "Organização" no contexto do cliente é a **empresa do cliente** (não a sua empresa).

### Resultado Esperado

Em vez de "Sou a assistente virtual da HidraPure", a IA dirá algo como:
> "Olá! Sou a Helper Suporte, assistente virtual da 3Cliques | CRM. Como posso te ajudar?"

