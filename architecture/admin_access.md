# POP-08: Acesso e Painel Administrativo (/admin)

## Objetivo
Garantir controle de acesso estrito ao painel administrativo dos noivos e organizadores, separando conceitualmente autenticação de autorização e utilizando o `user_id` autenticado como a autoridade primária de autorização (`ARQ-07`).

## Entradas
- Sessão Google do usuário.
- `user_id` autenticado no servidor (`auth.uid()`).

## Saídas
- Permissão de acesso ao painel `/admin` ou retorno silencioso HTTP 404 (Not Found).
- Dados administrativos completos para os noivos: listagem de presentes, status, nomes e e-mails dos convidados que reservaram cada item, data/hora da reserva e histórico de auditoria.

## Pré-condições
- O `user_id` do usuário autenticado deve estar presente e ativo em `public.administrators`.

## Regra Fundamental de Autorização (ARQ-07)
- **Autoridade Primária:** O `user_id` autenticado do Supabase Auth.
- **E-mail:** Armazenado exclusivamente para conveniência, identificação e auditoria administrativa, não sendo a chave primária de decisão de acesso.
- **Separação:** `Autenticação ≠ Autorização`. Ter uma conta Google válida não concede nenhum acesso ao `/admin`.

## Sequência Lógica de Execução
1. Usuário acessa `/admin`.
2. Server Component / Route Handler do Next.js obtém a sessão do usuário com `supabase.auth.getUser()`.
3. Se não autenticado: Redireciona para o login Google com `next=/admin`.
4. Se autenticado, consulta a tabela de autorização:
   ```sql
   SELECT role, is_active FROM administrators WHERE user_id = auth.uid() AND is_active = true;
   ```
5. Se não for administrador autorizado: Retorna tela 404 Not Found silenciosa (ARQ-07).
6. Se autorizado: Renderiza o painel com visão geral e ferramentas de liberação manual.

## Critérios de Sucesso
- Apenas usuários com `user_id` cadastrado em `administrators` acessam a área restrita.
- Convidado não autorizado recebe 404 silencioso sem vazamento de metadados.
