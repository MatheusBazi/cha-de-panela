# POP-01: Autenticação com Google OAuth (REVISADO)

## Objetivo
Permitir que o convidado faça login seguro utilizando sua conta Google no momento necessário, garantindo que o login seja desacoplado da reserva (`INV-02: LOGIN ≠ RESERVA`), que a autenticação seja revalidada no servidor em cada mutação (`ARQ-04`) e que o perfil seja sincronizado de forma transparente no banco de dados (`profiles`).

## Entradas
- Requisição de login disparada pelo usuário (`provider: 'google'`).
- `redirectTo`: URL de retorno preservando a rota de origem (ex: `/auth/callback?next=/presentes/jogo-de-panelas`).

## Saídas
- Sessão ativa com JWT no Supabase Auth persistida em Cookies HttpOnly SSR.
- Registro/atualização de dados básicos em `profiles` (`id`, `email`, `name`, `avatar_url`) via trigger `on_auth_user_created`.
- Redirecionamento seguro para a URL de destino.

## Configuração do Provedor (Google Cloud + Supabase Auth)
1. **Google Cloud Console (Credentials → OAuth 2.0 Client ID):**
   - **Origens JavaScript autorizadas:** `http://localhost:3000`
   - **URIs de redirecionamento autorizados:** `https://lmkasxsmsgdfqcbpdlzd.supabase.co/auth/v1/callback`
2. **Supabase Dashboard (Authentication → Providers → Google):**
   - Habilitar Provedor Google.
   - Inserir `Client ID` e `Client Secret`.
   - Salvar alterações.

## Sequência Lógica de Execução
1. Usuário clica em *"Continuar com Google"*.
2. Frontend chama `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://localhost:3000/auth/callback?next=...' } })`.
3. Provedor Google autentica o usuário e redireciona de volta para o gateway do Supabase (`/auth/v1/callback`), que redireciona para a aplicação em `/auth/callback?code=...`.
4. Rota `/auth/callback` troca o código de autorização por sessão no servidor (`exchangeCodeForSession(code)`).
5. Trigger `on_auth_user_created` sincroniza nome, e-mail e avatar em `public.profiles`.
6. Usuário é redirecionado para a tela de onde veio.
7. **Invariante Crítica (INV-02):** Zero reservas são criadas. O contador de reservas do usuário permanece inalterado.

## Critérios de Sucesso (Prova 1)
- Sessão Google reconhecida pelo Supabase.
- Sessão persiste após refresh (F5).
- Logout encerra a sessão com sucesso.
- Nenhuma reserva é gravada automaticamente (`LOGIN ≠ RESERVA`).
- Perfis de outros usuários permanecem inacessíveis.
