# PLANO DE TAREFAS (TASK PLAN)

## Status Geral: RELEASE CANDIDATE FINAL PRONTA (FASES 0 A 13)

---

### Fase 0 — Inicialização V.L.A.E.G.
- **Objetivo:** Estabelecer a constituição documental do projeto, invariantes, schemas JSON das 4 entidades e POPs de arquitetura.
- **Status:** [x] CONCLUÍDA

---

### Fase 1 — Link & Infraestrutura Mínima
- **Objetivo:** Configurar o ambiente Next.js + TypeScript, integração com Supabase e variáveis de ambiente.
- **Status:** [x] CONCLUÍDA

---

### Fase 2 — Banco de Dados, Constraints e Segurança (RLS)
- **Objetivo:** Criar o schema relacional no PostgreSQL com RLS, índices parciais únicos e funções de integridade.
- **Status:** [x] CONCLUÍDA (com SEC-01 e SEC-02)

---

### Fase 3 — Autenticação Google OAuth (Prova 1)
- **Objetivo:** Configurar Google OAuth no Supabase Auth e provar o fluxo completo de autenticação (`LOGIN ≠ RESERVA`).
- **Status:** [x] CONCLUÍDA

---

### Fase 4 — Catálogo Público de Presentes
- **Objetivo:** Interface `/presentes` pública, rápida, com filtros por categoria e disponibilidade sanitizada.
- **Status:** [x] CONCLUÍDA

---

### Fase 5 — Página Detalhada do Presente
- **Objetivo:** Interface `/presentes/[slug]` com imagem, preferências, link externo opcional de referência e estado de disponibilidade.
- **Status:** [x] CONCLUÍDA

---

### Fase 6 — Motor de Reserva Atômica
- **Objetivo:** RPC `reserve_gift_atomic` no PostgreSQL e Route Handler `POST /api/reservations/reserve` com serialização e idempotência.
- **Status:** [x] CONCLUÍDA

---

### Fase 7 — Cancelamento Autônomo em 10 Minutos
- **Objetivo:** RPC `cancel_user_reservation` no PostgreSQL e Route Handler `POST /api/reservations/cancel` com janela estrita de 10 min.
- **Status:** [x] CONCLUÍDA

---

### Fase 8 — Meus Presentes
- **Objetivo:** Interface `/meus-presentes` restrita ao usuário autenticado, com histórico e ação de desfazer reserva dentro do prazo.
- **Status:** [x] CONCLUÍDA

---

### Fase 9 — Painel Administrativo & CRUD de Catálogo
- **Objetivo:** Interface `/admin` com métricas, auditoria completa de reservas, liberação em dois passos e CRUD de presentes (Criar, Editar, Soft-Delete e Reativação).
- **Status:** [x] CONCLUÍDA

---

### Fase 10 — Recuperação de Falhas e Reconciliação
- **Objetivo:** Tratamento do estado `network_uncertain` com retry idempotente preservando a mesma chave até veredito final.
- **Status:** [x] CONCLUÍDA

---

### Fase 11 — Design System Oficial & Conteúdo Real do CEO
- **Objetivo:** Fidelidade integral ao Design System Board HTML (`Cormorant Garamond`, `Karla`, `Parisienne`, paleta oficial), parametrização de Débora & Matheus (21/11/2026 15:00) e importação dos 69 presentes reais.
- **Status:** [x] CONCLUÍDA

---

### Fase 12 — Testes Integrados, Concorrência e Regressão
- **Objetivo:** Baterias automatizadas E2E, disputa simultânea, idempotência, segurança, RLS e CRUD admin validadas.
- **Status:** [x] CONCLUÍDA (61/61 Testes Aprovados)

---

### Fase 13 — Refinamento, Acessibilidade, Performance e SEO
- **Objetivo:** Metadados, responsividade mobile-first (320px+), semântica HTML5 e zero dependência de cor para estados.
- **Status:** [x] CONCLUÍDA

---

### Fase 14 — Deploy Definitivo em Produção
- **Objetivo:** Publicação em domínio de produção (Vercel) e abertura oficial aos convidados.
- **Status:** [x] CONCLUÍDA — Deploy acionado com push na branch `main` do repositório GitHub.
