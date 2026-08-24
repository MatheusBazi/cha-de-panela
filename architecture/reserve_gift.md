# POP-04: Reserva Atômica de Presente (CRÍTICO)

## Objetivo
Processar a intenção de reserva de um presente com garantia de atomicidade no PostgreSQL, proteção contra concorrência simultânea via Unique Index parcial, idempotência estrutural `(user_id, idempotency_key)` e fronteira obrigatória via Route Handler (`ARQ-01`, `ARQ-04`, `ARQ-05`, `INV-04` a `INV-08`, `INV-16`).

## Entradas
- Requisição HTTP POST para `/api/reservations/reserve`.
- Headers: `Authorization: Bearer <JWT>` ou Cookie de Sessão Supabase Auth.
- Body:
  ```json
  {
    "gift_id": "uuid",
    "idempotency_key": "uuid-v4"
  }
  ```

## Saídas
- HTTP 200: `{ "status": "success", "reservation": { "id": "...", "gift_id": "...", "reserved_at": "...", "cancel_until": "..." } }`
- HTTP 409: `{ "status": "conflict", "message": "Este presente acabou de ser reservado por outro convidado." }`
- HTTP 400/422: `{ "status": "error", "message": "Presente indisponível ou inativo." }`
- HTTP 401: `{ "status": "unauthenticated", "message": "Sessão expirada. Faça login novamente." }`

## Pré-condições
- Usuário autenticado com token válido verificado no servidor (`ARQ-04`).
- Confirmação explícita no modal pelo usuário.
- `idempotency_key` UUID v4 gerada pelo cliente no início da intenção.

## Sequência Lógica de Execução

```text
[Cliente clica "Confirmar Reserva" no Modal]
  │
  ├─> UI entra em estado "reserving" (Desabilita botão, spinner sutil, trava duplo clique)
  │
  ▼
[POST /api/reservations/reserve] (Fronteira Oficial ARQ-05)
  │
  ├─ 1. Route Handler valida sessão do usuário no Supabase (`auth.getUser()`) -> Obtém `user_id` autenticado (ARQ-04)
  │      - Se inválido: Retorna HTTP 401
  │
  ▼
[Chamada da RPC PostgreSQL: `reserve_gift_atomic(p_gift_id, p_idempotency_key)`]
  │
  ├─ 2. Início de Transação Atômica:
  │      - `SELECT * FROM gifts WHERE id = p_gift_id AND is_active = true FOR UPDATE;`
  │      - Se não encontrado: ROLLBACK -> Retorna `error`
  │
  ├─ 3. Checagem Estrutural de Idempotência:
  │      - `SELECT * FROM reservations WHERE user_id = auth.uid() AND idempotency_key = p_idempotency_key;`
  │      - Se já existe: Retorna o registro existente (status='success') SEM alterar timestamps (ARQ-01).
  │
  ├─ 4. Checagem de Concorrência:
  │      - `SELECT id, user_id FROM reservations WHERE gift_id = p_gift_id AND status = 'active';`
  │      - Se já existe reserva ativa:
  │          * Se `user_id = auth.uid()`: Retorna reserva do usuário
  │          * Se `user_id != auth.uid()`: ROLLBACK -> Retorna `conflict`
  │
  ├─ 5. Inserção Atômica:
  │      - `INSERT INTO reservations (gift_id, user_id, idempotency_key, status, reserved_at, cancel_until)`
  │        `VALUES (p_gift_id, auth.uid(), p_idempotency_key, 'active', NOW(), NOW() + INTERVAL '10 minutes');`
  │      - *Garantias estruturais do PostgreSQL:*
  │          1. `CREATE UNIQUE INDEX unique_active_gift_reservation ON reservations(gift_id) WHERE status = 'active'`
  │          2. `CREATE UNIQUE INDEX unique_user_reservation_idempotency ON reservations(user_id, idempotency_key)`
  │
  └─ 6. COMMIT -> Retorna `{ "status": "success", "reservation": ... }`
        │
        ▼
[Recepção no Cliente]
  │
  ├─ Se HTTP 200 (`success`): UI transiciona para `success` (Nunca otimista).
  ├─ Se HTTP 409 (`conflict`): UI transiciona para `conflict` (POP-05).
  └─ Se Timeout/Network Error: UI entra em `network_uncertain` e dispara POP-10 mantendo a MESMA `idempotency_key` (ARQ-02, ARQ-03).
```

## Ferramentas Futuras
- `tools/reservations/reserve_route_handler.ts`
- `tools/reservations/reserve_gift_atomic.sql`

## Casos de Borda
- Duas requisições idênticas simultâneas: tratadas por `unique_user_reservation_idempotency` retornando a mesma resposta.
- Duas pessoas no mesmo milissegundo: a mais lenta recebe `conflict` pelo índice único parcial.

## Critérios de Sucesso
- Apenas 1 reserva ativa por presente.
- Zero presunção no frontend.
