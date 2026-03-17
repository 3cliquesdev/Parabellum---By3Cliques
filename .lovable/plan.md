
Objetivo: corrigir de vez a recuperação de senha do portal do cliente.

O que encontrei
1. O botão “Esqueci minha senha” em `src/pages/ClientLogin.tsx` chama a backend function `send-recovery-email`.
2. Essa function existe e depende de `RESEND_API_KEY`, que está configurada.
3. Porém, em `supabase/config.toml` não existe configuração para `send-recovery-email` nem para `auth-email-hook`.
4. Como a tela `/portal` é pública, o envio da recuperação acontece sem usuário autenticado. Se a function estiver usando a validação padrão de JWT, a chamada falha antes mesmo de executar.
5. Isso bate com os sinais do projeto:
   - não há logs recentes da function `send-recovery-email`
   - não há registros recentes `auth_*` em `email_send_log`
6. Além disso, a página `src/pages/SetupPassword.tsx` depende de a sessão de recovery aparecer automaticamente via URL/hash. Hoje ela não faz troca explícita do token/código da URL por sessão, então existe um segundo ponto frágil: o usuário pode abrir o link e ser redirecionado antes de conseguir definir a nova senha.

Plano de implementação
1. Liberar a function pública de recuperação
   - Adicionar `send-recovery-email` no `supabase/config.toml` com `verify_jwt = false`.
   - Isso é necessário porque o cliente pede recuperação sem estar logado.

2. Fortalecer a página de redefinição
   - Ajustar `src/pages/SetupPassword.tsx` para processar corretamente o link de recuperação ao carregar.
   - Implementar tratamento explícito dos parâmetros/hash da URL para estabelecer a sessão de recovery antes de decidir redirect.
   - Segurar o redirect inicial enquanto essa validação acontece.

3. Melhorar a detecção do fluxo de recovery
   - Cobrir os formatos reais que podem vir no link:
     - `#type=recovery...`
     - `?code=...`
     - possíveis variantes de callback de autenticação
   - Garantir que, se o link for válido, a tela vá direto para “definir nova senha”.

4. Preservar o fluxo atual de primeiro acesso
   - Não mexer na lógica de OTP do primeiro acesso.
   - Separar claramente:
     - primeiro acesso = código por email
     - recuperação = link direto para redefinir senha

5. Validar via logs e persistência
   - Depois da correção, conferir se:
     - a function passa a registrar execução
     - o email de recuperação é enviado
     - o link abre a tela correta
     - a senha é atualizada e o usuário consegue entrar no portal

Arquivos envolvidos
- `supabase/config.toml`
- `src/pages/SetupPassword.tsx`
- possível revisão leve em `src/pages/ClientLogin.tsx` apenas se eu precisar melhorar feedback de erro/sucesso

Resultado esperado
- O cliente clica em “Esqueci minha senha”
- O email é enviado com sucesso
- Ao abrir o link, ele cai em `/setup-password`
- A tela reconhece o recovery, permite criar nova senha e conclui o acesso normalmente

Detalhes técnicos
```text
Problema principal provável:
portal público
  -> invoke(send-recovery-email)
  -> function sem verify_jwt=false
  -> bloqueio antes da execução
  -> sem log / sem email

Problema secundário:
link de recovery
  -> SetupPassword lê hash/sessão de forma passiva
  -> sessão pode não estar pronta
  -> redirect cedo demais
  -> usuário acha que “não funciona”
```
