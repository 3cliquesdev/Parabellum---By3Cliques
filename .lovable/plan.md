
# Fix: IA Alucinando Nome da Empresa ("HidraPure") — Conversa Ronildo Oliveira

## Diagnóstico

**Sintoma:** A IA se apresentou como "assistente virtual da HidraPure" para um cliente no fluxo financeiro, sendo que HidraPure é apenas uma organização-cliente cadastrada no CRM.

**Causa raiz:** O system prompt da persona Helper e a instrução de onboarding não injetavam o nome da empresa real. Sem referência explícita, a LLM alucionou "HidraPure" a partir dos dados de contexto do contato (campo `contactOrgName`).

## Correções Aplicadas — `ai-autopilot-chat/index.ts`

### 1. Busca dinâmica do brand name
- Nova query paralela no bloco de enrichment (L2053): `email_branding` → `is_default_customer = true` → campo `name`
- Variável `companyBrandName` propagada para os prompts

### 2. Injeção no onboarding (primeira mensagem)
- Template atualizado com `- Empresa: ${companyBrandName}`
- Instrução anti-alucinação: "NÃO invente nomes de empresa. Use EXATAMENTE o nome informado."
- Fallback sem nome: "NÃO mencione nenhum nome de empresa."

### 3. Injeção no system prompt (L7438)
- Bloco `🏢 IDENTIDADE DA EMPRESA` antes do `persona.system_prompt`
- Instrução: "Este é o ÚNICO nome de empresa que você pode usar. NUNCA invente ou alucine outro nome."

### 4. Desambiguação de `contactOrgName`
- Label alterado de "Organização" para "Organização do cliente (empresa DELE, NÃO a sua)"
- Evita que a LLM confunda a empresa do cliente com a identidade do sistema

## Deploy
- ✅ `ai-autopilot-chat` deployed
