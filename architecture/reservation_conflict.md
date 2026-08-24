# POP-05: Tratamento de Conflito de Reserva (Concorrência)

## Objetivo
Tratar de forma elegante, acolhedora e determinística o cenário em que dois convidados disputam o mesmo presente quase simultaneamente e um deles é rejeitado pela barreira do PostgreSQL (`ARQ-01`, `INV-05`, `INV-09`).

## Entradas
- Resposta HTTP 409 (`status: 'conflict'`) retornada pelo Route Handler `/api/reservations/reserve`.

## Saídas
- Atualização imediata do estado local da UI para `reserved` (`✓ Já escolhido`).
- Modal ou notificação contextual amigável: *"Ops! Este presente acabou de ser reservado por outro convidado."*.
- Sanitização absoluta: nenhum dado pessoal do vencedor é exposto (`ARQ-06`, `INV-09`).

## Sequência Lógica de Execução
1. Frontend recebe resposta HTTP 409 do Route Handler.
2. Estado do botão e do item transiciona para `reserved`.
3. Modal de confirmação fecha e abre notificação/modal de acolhimento:
   - Título: *"Presente já reservado"*
   - Mensagem: *"Outro convidado acabou de escolher este item alguns instantes atrás."*
   - Ação: Botão *"Explorar outros presentes"*.
4. Redirecionamento suave para a lista geral sem bloqueio da navegação.

## Critérios de Sucesso
- Usuário compreende o resultado sem frustração ou ambiguidade.
- Identidade de terceiros rigorosamente preservada.
