# POP-06: Cancelamento Autônomo de Reserva (Janela de 10 Minutos)

## Objetivo
Permitir que o convidado desfaça com autonomia e segurança uma reserva efetuada por engano, desde que a solicitação ocorra dentro da janela de 10 minutos (`INV-13`, `INV-14`, `INV-15`), liberando o presente novamente para outros convidados sem apagar o histórico de auditoria.

## Entradas
- `reservation_id`: UUID da reserva ativa.
- `user_id`: UUID do usuário solicitante (verificado rigorosamente via `auth.uid()`).

## Saídas
- `status`: `'cancelled'` | `'expired'` | `'forbidden'` | `'error'`
- Atualização do registro em `reservations`: `status = 'cancelled_by_user'`, `cancelled_at = NOW()`.
- Presente volta a ficar com status `available` para todos os convidados.

## Pré-condições
- A reserva pertence ao usuário autenticado (`reservations.user_id = auth.uid()`).
- O timestamp atual `NOW()` é estritamente menor que `reservations.cancel_until` (`reserved_at + INTERVAL '10 minutes'`).
- Confirmação explícita de cancelamento pelo usuário no modal de dois passos.

## Sequência Lógica de Execução
1. Usuário visualiza sua reserva (em `/meus-presentes` ou na página do produto) e clica em *"Reservei por engano"*.
2. Modal de confirmação é exibido:
   - *"Deseja liberar este presente?"*
   - *"Ele voltará a ficar disponível para outros convidados."*
   - Opções: `[Manter reserva]` (cancela o fluxo) ou `[Liberar presente]` (prossegue).
3. Ao clicar em *"Liberar presente"*, frontend chama a RPC PostgreSQL `cancel_user_reservation(p_reservation_id)`.
4. Stored Procedure executa:
   ```sql
   UPDATE reservations
   SET status = 'cancelled_by_user',
       cancelled_at = NOW(),
       updated_at = NOW()
   WHERE id = p_reservation_id
     AND user_id = auth.uid()
     AND status = 'active'
     AND NOW() <= cancel_until;
   ```
5. Se nenhuma linha for atualizada porque o prazo expirou: retorna erro `'expired'`.
6. Se atualizada com sucesso: retorna `'cancelled'`.
7. Frontend atualiza o estado local e reflete a disponibilidade do item.

## Ferramentas Futuras
- `tools/reservations/cancel_user_reservation.sql`

## Casos de Borda
- Convidado abre o modal no minuto 9m50s e clica no minuto 10m05s: a checagem no banco rejeita a operação com `'expired'`. A interface informa com delicadeza: *"O prazo de 10 minutos para cancelamento autônomo expirou. Caso precise alterar, fale com os noivos."*.
- Usuário não autenticado ou tentando cancelar reserva de outro: bloqueado por RLS / cláusula `user_id = auth.uid()`.

## Critérios de Sucesso
- Presente liberado e disponível para o catálogo geral imediatamente.
- Registro histórico preservado no banco com `cancelled_by_user` e data/hora.
- Ação destrutiva exigiu 2 passos.

## Critérios de Falha
- Cancelamento aceito após 10 minutos decorridos.
- Deleção física do registro (`DELETE`) em vez de soft update.
