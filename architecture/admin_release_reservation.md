# POP-09: Liberação Administrativa de Reserva

## Objetivo
Permitir que um administrador liberte manualmente uma reserva após o período de 10 minutos (ou a qualquer momento em caso de solicitação dos noivos/convidado), preservando integralmente o histórico de auditoria (`INV-14`, `INV-15`).

## Entradas
- `reservation_id`: UUID da reserva ativa a ser liberada.
- Sessão do administrador autenticado (`admin_user_id`).

## Saídas
- Atualização do registro em `reservations`: `status = 'released_by_admin'`, `released_at = NOW()`, `released_by = admin_user_id`.
- Presente imediatamente liberado e disponível novamente para o catálogo público.

## Pré-condições
- Usuário chamador é um administrador ativo verificado em `administrators`.
- Confirmação explícita de dois passos no modal administrativo.

## Sequência Lógica de Execução
1. Administrador clica em *"Liberar reserva"* no painel `/admin`.
2. Modal de confirmação administrativa é exibido:
   - *"Liberar '[Nome do Presente]'?"*
   - *"Depois da liberação, este item ficará disponível novamente para outros convidados."*
   - Botões: `[Cancelar]` ou `[Confirmar liberação]`.
3. Ao confirmar, executa RPC `admin_release_reservation(p_reservation_id)`:
   ```sql
   UPDATE reservations
   SET status = 'released_by_admin',
       released_at = NOW(),
       released_by = auth.uid(),
       updated_at = NOW()
   WHERE id = p_reservation_id
     AND status = 'active'
     AND EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid() AND is_active = true);
   ```
4. Se o usuário não tiver permissão de admin: operação abortada com erro de segurança.
5. Retorna sucesso e atualiza a tabela administrativa em tempo real.

## Ferramentas Futuras
- `tools/admin/admin_release_reservation.sql`

## Casos de Borda
- Tentativa de liberar uma reserva que já foi cancelada ou já estava inativa: operação idempotente retorna aviso sem gerar inconsistência.

## Critérios de Sucesso
- Presente volta a ficar disponível no catálogo.
- Histórico completo preservado (quem reservou, quando reservou, quando foi liberado e por qual administrador).
- Nenhuma linha excluída fisicamente do banco de dados.

## Critérios de Falha
- Usuário não-admin conseguir executar a liberação.
- Uso de `DELETE` físico.
