# POP-02: Listagem de Presentes (Catálogo Público)

## Objetivo
Exibir o catálogo de presentes do Chá de Cozinha de forma pública, rápida, elegante e com total respeito à privacidade (`INV-09`, `INV-10`), permitindo filtrar por categoria e buscar por nome.

## Entradas
- Filtros opcionais: `category`, `search_term`, `status_filter` (Todos, Disponíveis, Já escolhidos).
- Contexto de sessão do usuário (opcional, para identificar se algum item foi reservado pelo próprio usuário logado).

## Saídas
- Lista de presentes com: `id`, `slug`, `name`, `category`, `image_url`, `is_reserved` (booleano), `is_reserved_by_me` (booleano, se logado).
- **Nunca retornar:** preços (`INV-10`), nome ou e-mail de quem reservou (`INV-09`).

## Pré-condições
- Tabela `gifts` populada com itens `is_active = true`.
- View segura / consulta protegida por RLS no Supabase.

## Sequência Lógica de Execução
1. Frontend requisita a lista de presentes públicos.
2. Backend consulta `gifts` unindo com o status de `reservations` ativas.
3. Se houver usuário logado, compara o `user_id` da reserva ativa com `auth.uid()`.
4. Mapeia para o DTO público:
   - Se livre: status = `available`.
   - Se reservado por outro: status = `reserved` (`is_reserved = true, is_reserved_by_me = false`).
   - Se reservado pelo próprio: status = `reserved_by_me` (`is_reserved = true, is_reserved_by_me = true`).
5. Renderiza a grade de presentes no layout editorial com skeletons durante carregamento.

## Ferramentas Futuras
- `tools/catalog/fetch_public_gifts.ts`
- `tools/catalog/public_gifts_view.sql`

## Casos de Borda
- Nenhum presente cadastrado ou busca sem resultados: exibir estado `empty` com visual acolhedor.
- Presente desativado (`is_active = false`): não deve ser retornado no catálogo público.

## Critérios de Sucesso
- Catálogo renderizado sem exigir autenticação.
- Identidade de terceiros 100% protegida.
- Preços ocultos.
- Dono da reserva identifica visualmente seus itens reservados.

## Critérios de Falha
- Vazamento de qualquer dado de identidade de reserva para público geral.
