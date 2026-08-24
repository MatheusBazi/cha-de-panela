# POP-07: Área "Meus Presentes" (/meus-presentes)

## Objetivo
Fornecer ao convidado autenticado uma área privada onde ele pode visualizar todas as suas reservas ativas e históricas (`INV-11`, `INV-12`), acompanhar especificações dos presentes que escolheu dar e ter acesso ao botão de cancelamento durante a janela de 10 minutos.

## Entradas
- Sessão do usuário logado (`auth.uid()`).

## Saídas
- Lista de presentes reservados pelo próprio usuário:
  - Nome do presente, categoria, foto, links externos de referência, preferências (ex: cor, voltagem).
  - Status da reserva (`active`, `cancelled_by_user`, `released_by_admin`).
  - Tempo restante da janela de 10 minutos (contador decrescente em tempo real sincronizado com `cancel_until`).
  - Botão *"Desfazer reserva"* (habilitado se dentro dos 10 min).

## Pré-condições
- Usuário autenticado. Se não estiver, redirecionar para login com retorno automático a `/meus-presentes`.

## Sequência Lógica de Execução
1. Usuário acessa `/meus-presentes`.
2. Middleware/Página verifica sessão. Se anônimo, exibe tela convidativa para Login Google.
3. Se autenticado, consulta a API/Supabase:
   ```sql
   SELECT r.id as reservation_id, r.reserved_at, r.cancel_until, r.status,
          g.id as gift_id, g.slug, g.name, g.category, g.image_url, g.external_url, g.external_note, g.preferences
   FROM reservations r
   JOIN gifts g ON g.id = r.gift_id
   WHERE r.user_id = auth.uid() AND r.status = 'active'
   ORDER BY r.reserved_at DESC;
   ```
4. Frontend renderiza os cartões dos presentes com o layout acolhedor.
5. Para cada cartão:
   - Se `NOW() < cancel_until`: Exibe badge *"Reservado por você há X min"* e botão *"Desfazer reserva"*.
   - Se `NOW() >= cancel_until`: Exibe badge *"✓ Reservado por você"* sem botão de cancelamento.

## Ferramentas Futuras
- `tools/my_gifts/fetch_user_reservations.ts`

## Casos de Borda
- Usuário não tem nenhum presente reservado: exibir estado `empty` editorial: *"Você ainda não reservou nenhum presente. Que tal dar uma olhada na nossa lista?"* com botão direcionando para `/presentes`.

## Critérios de Sucesso
- Apenas o dono das reservas enxerga seus dados.
- Sincronização precisa da janela de 10 minutos.
- Facilidade de consulta para o dia do evento ou compra do presente.

## Critérios de Falha
- Exibição de presentes de outros usuários.
