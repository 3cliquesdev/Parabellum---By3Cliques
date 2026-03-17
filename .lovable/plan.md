

# Configurar emails de autenticação (recuperação de senha) com domínio próprio

## Problema atual
Os emails de recuperação de senha estão sendo enviados pelo domínio padrão (`noreply@mail.app.supabase.io`), que tem baixa entregabilidade e é frequentemente filtrado pelo Gmail.

## Solução

### Passo 1: Configurar domínio de email
O projeto ainda não tem um domínio de email configurado na infraestrutura de emails do Lovable Cloud. Precisamos configurar o domínio (ex: `mail.3cliques.net` ou outro) através do setup de email.

### Passo 2: Scaffold dos templates de autenticação
Criar os templates customizados para:
- **Recovery** (recuperação de senha) -- o caso principal
- Signup, magic-link, invite, email-change, reauthentication

### Passo 3: Aplicar branding do Parabellum
- Cores do projeto (primary, foreground, etc. do CSS)
- Logo existente em `/logo-parabellum-light.png`
- Textos em português, tom compatível com o app ("Bem-vindo ao Q.G")

### Passo 4: Deploy do `auth-email-hook`
Deploy da Edge Function que intercepta eventos de autenticação e renderiza os templates customizados.

### Resultado
Emails de recuperação de senha passarão a ser enviados pelo domínio próprio verificado, com branding do Parabellum, garantindo entregabilidade no Gmail e outros provedores.

---

**Primeiro passo**: precisamos configurar o domínio de email. Vou abrir o setup para você configurar.

