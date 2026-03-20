

# Execução — Fase Final: Branding Soberano

Toda a investigação já está feita. Estas são as edições cirúrgicas restantes.

---

## 1. `ai-governor/index.ts` — 4 substituições + 1 refactor

O `ai-governor` já busca branding internamente (L726-745) mas em escopo local da função de email. As strings "Parabellum"/"3Cliques" ficam em 4 pontos que precisam usar `brandName`:

**L604** — Prompt da IA: `"analista executivo da Parabellum"` → `"analista executivo da ${brandNameForAI}"`

Para isso, `generateAIAnalysis` precisa receber `brandName` como parâmetro adicional (atualmente só recebe metrics, salesMetrics, dateStr, openaiKey). Adicionar parâmetro `brandName: string` na assinatura e na chamada (L1264).

**L937** — Header do email HTML: `"Report Diário CRM 3Cliques"` → `"Report Diário ${brandName}"`
(já em escopo do `brandName` local)

**L1157** — Subject do email: `"Report Diario CRM 3Cliques"` → `"Report Diario ${brandName}"`
(já em escopo)

**L1357** — Mensagem WhatsApp (main handler): `"Report Diario CRM 3Cliques"` e `"Parabellum by 3Cliques"` → `"Report Diario ${brandName}"` e `"${brandName}"`

Para os pontos no main handler (L1264 e L1357), adicionar resolução de branding no início do handler:
```typescript
// Após L1261 (collectSalesMetrics), antes de L1263
const { data: _org } = await supabase.from('organizations').select('name').limit(1).maybeSingle();
const brandNameForReport = _org?.name || 'CRM';
```

---

## 2. `create-user/index.ts` — URL dinâmica (2 pontos)

**L310**: `https://parabellum.work` → `${siteUrl}`
**L317**: `https://parabellum.work/auth` → `${siteUrl}/auth`

Adicionar no início do handler de email:
```typescript
const siteUrl = Deno.env.get('SITE_URL') || 'https://parabellum.work';
```

---

## 3. `resend-welcome-email/index.ts` — URL dinâmica (1 ponto)

**L192**: `https://parabellum.work` → `${siteUrl}`

Mesmo padrão: `const siteUrl = Deno.env.get('SITE_URL') || 'https://parabellum.work';`

---

## 4. Frontend — Placeholders neutros (3 arquivos)

**`SetupPassword.tsx` L219**: `alt="Seu Armazém Drop"` → `alt="Logo"`

**`PublicOnboarding.tsx` L231**: `alt="Seu Armazém Drop"` → `alt="Logo"`
(L237 `alt="3CLIQUES"` → `alt="Logo"` também)

**`EmailSendersCard.tsx`**:
- L118: placeholder `"Ex: Seu Armazém Drop Suporte"` → `"Ex: Suporte"`
- L129: placeholder `"Ex: contato@mail.3cliques.net"` → `"Ex: contato@seudominio.com"`

---

## Deploys necessários
- `ai-governor`
- `create-user`
- `resend-welcome-email`

## Não alterar
- Auth.tsx "PARABELLUM" — identidade do produto
- OnboardingHeader.tsx — branding do produto
- GlobalFilters, kiwifyProductMapping — dados reais
- Workspace IDs — single-tenant

