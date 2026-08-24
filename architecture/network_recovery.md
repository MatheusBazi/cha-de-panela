# POP-10: Recuperação de Incerteza de Rede (CRÍTICO)

## Objetivo
Garantir que falhas de rede, oscilações mobile, timeouts ou interrupções de conexão nunca gerem falsos positivos nem falsos negativos, reconciliando o estado exclusivamente com a Fonte da Verdade e preservando rigorosamente a mesma `idempotency_key` (`ARQ-02`, `ARQ-03`, `INV-07`, `INV-08`, `INV-19`).

## Entradas
- `idempotency_key`: A MESMA UUID v4 gerada na intenção de reserva inicial.
- `gift_id`: UUID do presente disputado.
- Contexto de autenticação do usuário.

## Saídas
O mecanismo de verificação sincroniza-se com o banco de dados antes de emitir qualquer veredito. Os **únicos 3 resultados finais permitidos** são:
1. `reserved_by_me` (Sucesso confirmado).
2. `reserved_by_other / conflict` (Conflito confirmado).
3. `available / operação não ocorreu` (Confirmação de que a operação não foi gravada).

## Regras Críticas de Incerteza
- **Regra 1:** Jamais considerar automaticamente `presente aparentemente disponível = operação falhou` enquanto houver possibilidade de a requisição original estar sendo processada no servidor.
- **Regra 2:** Enquanto a tentativa estiver em `network_uncertain`, **preservar a MESMA `idempotency_key`**. Proibido gerar nova chave ou nova intenção enquanto a anterior não for reconciliada. Retries devem reenviar a mesma chave.

## Sequência Lógica de Execução

```text
[Cliente dispara POST /api/reservations/reserve]
  │
  ▼
[Falha de Conexão / Timeout / Network Error]
  │
  ├─> UI entra imediatamente em estado `network_uncertain`
  ├─> Exibe: "Verificando o status real da sua reserva com o servidor..."
  ├─> Bloqueia novos cliques e PRESERVA a `idempotency_key` atual.
  │
  ▼
[Execução de Polling / Sincronização via POST /api/reservations/verify]
  │ (Backoff exponencial: 1.5s, 3s, 5s - até 3 tentativas de sincronização)
  │
  ├─ 1. Route Handler executa RPC `verify_reservation_status(p_gift_id, p_idempotency_key)`
  │
  ├─ Caso A: Existe reserva com `(user_id = auth.uid() AND idempotency_key = p_idempotency_key)`
  │    └──> Veredito: `reserved_by_me`
  │         UI atualiza: "Sua reserva foi confirmada com sucesso!"
  │
  ├─ Caso B: Existe reserva com `status = 'active'` mas `user_id != auth.uid()`
  │    └──> Veredito: `reserved_by_other / conflict`
  │         UI atualiza: "Este presente acabou de ser reservado por outro convidado."
  │
  └─ Caso C: Presente continua `is_active = true` e sem reserva ativa após janela de sincronização
       └──> Veredito: `available / operação não ocorreu`
            UI atualiza: "Sua reserva não foi realizada devido à falha de conexão. Deseja tentar novamente?"
            (Permite ao usuário acionar novo clique com a mesma intenção ou desistir).
```

## Ferramentas Futuras
- `tools/recovery/verify_route_handler.ts`
- `tools/recovery/verify_reservation_status.sql`

## Critérios de Sucesso
- A interface nunca declara falha enquanto uma reserva pode estar sendo gravada.
- Retries utilizam a mesma `idempotency_key`.
- Convidado recebe apenas um dos 3 estados finais permitidos.
