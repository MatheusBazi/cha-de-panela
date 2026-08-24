# CONSTITUIÇÃO DO PROJETO — CHÁ DE COZINHA (LISTA DE PRESENTES)

## 1. Identidade e Princípio Fundamental
- **Produto:** Plataforma editorial de Lista de Presentes para Chá de Cozinha (Inspirada na estética e-commerce premium, sem transações financeiras).
- **Ação Central:** Registro explícito de *Intenção de Presentear* (**Reserva do Presente**).
- **Estrela Guia:** O convidado deve navegar, entender o evento, escolher um presente, autenticar-se via Google se necessário, confirmar sua reserva com total clareza e receber feedback inequívoco (*"Deu certo"* ou *"Não deu certo"*).
- **Princípio de UX:** **Clareza acima de velocidade.** Prevenção total a falsos positivos. Nenhum sucesso é exibido antes da confirmação inequívoca e definitiva do backend/Fonte da Verdade.

---

## 2. Stack Tecnológica
- **Frontend / Aplicação:** Next.js (App Router) + TypeScript
- **Backend / Database / Auth:** Supabase (PostgreSQL + Supabase Auth com Google OAuth + Row Level Security - RLS)
- **Hospedagem:** Vercel
- **Fonte da Verdade:** PostgreSQL no Supabase (`BANCO > ESTADO DO FRONTEND`).

---

## 3. Invariantes do Produto (Regras Inegociáveis)

| Código | Invariante |
| :--- | :--- |
| **INV-01** | Abrir um presente nunca cria reserva. |
| **INV-02** | Login nunca cria reserva (`LOGIN ≠ RESERVA`). |
| **INV-03** | Abrir um link externo da loja parceira/sugerida nunca cria reserva. |
| **INV-04** | Reserva exige obrigatoriamente uma confirmação explícita do usuário em modal/etapa dedicada. |
| **INV-05** | Um presente pode possuir **no máximo uma reserva ativa** em qualquer instante de tempo. |
| **INV-06** | O backend/banco de dados é a autoridade absoluta e única sobre disponibilidade. |
| **INV-07** | A interface jamais presume sucesso (proibido estado otimista para reservas). |
| **INV-08** | Feedback de sucesso só aparece após confirmação registrada e retornada pelo backend. |
| **INV-09** | A identidade (nome/e-mail/foto) de quem reservou **nunca** aparece publicamente para outros convidados. |
| **INV-10** | Preço dos presentes não é exibido em nenhuma parte pública do sistema. |
| **INV-11** | O link externo de loja é meramente indicativo; o convidado compra onde preferir. |
| **INV-12** | Um usuário autenticado pode reservar múltiplos presentes distintos. |
| **INV-13** | O usuário tem uma janela de arrependimento de **10 minutos** (`cancel_until = reserved_at + 10 min`) para desfazer sozinho sua reserva. |
| **INV-14** | Após os 10 minutos, somente um administrador autorizado pode liberar a reserva. |
| **INV-15** | Toda ação destrutiva (cancelar/liberar) exige confirmação explícita em dois passos. |
| **INV-16** | Clique duplo, cliques múltiplos ou requisições concorrentes não produzem estados duplicados ou inconsistentes. |
| **INV-17** | Refresh (F5) não repete uma reserva nem gera efeitos colaterais. |
| **INV-18** | Ação de voltar no navegador (Histórico/Back) não repete reservas. |
| **INV-19** | Falha de rede/timeout não pode ser interpretada cegamente como falha ou sucesso. O sistema deve consultar a Fonte da Verdade antes de emitir veredito. |
| **INV-20** | Responsividade e usabilidade Mobile são requisitos de primeira classe. |
| **INV-21** | **Mobile-First é Invariante de Produto:** Jornada de ponta a ponta utilizável com uma mão, touch targets >= 44x44px, safe area respeitada, sticky CTA no produto, inputs com 16px (zero auto-zoom iOS), tolerância estrita de 320px a 430px e zero dependência de hover. |

---

## 4. Esquema de Dados Formal (JSON Data Schema)

### 4.1. Entidade: `profiles` (Perfis de Usuários)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Profile",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid", "description": "ID do usuário mapeado a partir do auth.users (Supabase Auth)" },
    "email": { "type": "string", "format": "email", "description": "E-mail obtido pelo Google OAuth" },
    "name": { "type": "string", "description": "Nome completo obtido pelo Google OAuth" },
    "avatar_url": { "type": ["string", "null"], "format": "uri", "description": "URL da foto de perfil Google" },
    "created_at": { "type": "string", "format": "date-time", "description": "Timestamp de criação do perfil" },
    "updated_at": { "type": "string", "format": "date-time", "description": "Timestamp da última atualização" }
  },
  "required": ["id", "email", "name", "created_at"]
}
```

### 4.2. Entidade: `gifts` (Presentes)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Gift",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid", "description": "Identificador único do presente" },
    "slug": { "type": "string", "description": "Slug legível e único para rota URL (/presentes/[slug])" },
    "name": { "type": "string", "description": "Nome do presente" },
    "description": { "type": "string", "description": "Descrição detalhada do item" },
    "category": { "type": "string", "description": "Categoria do presente (ex: Eletrodomésticos, Mesa Posta, Utensílios)" },
    "image_url": { "type": "string", "format": "uri", "description": "URL da imagem principal do presente" },
    "external_url": { "type": ["string", "null"], "format": "uri", "description": "Link de sugestão de loja externa" },
    "external_note": { "type": ["string", "null"], "description": "Nota sobre o link externo (ex: 'Referência apenas; compre onde preferir')" },
    "preferences": { 
      "type": "object", 
      "description": "Especificações opcionais (cor preferida, voltagem 110v/220v, tamanho)",
      "properties": {
        "color": { "type": "string" },
        "voltage": { "type": "string", "enum": ["110v", "220v", "bivolt", "N/A"] },
        "notes": { "type": "string" }
      }
    },
    "display_order": { "type": "integer", "default": 0, "description": "Ordem de exibição na listagem" },
    "is_active": { "type": "boolean", "default": true, "description": "Indica se o presente está ativo e visível" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "slug", "name", "category", "image_url", "is_active", "created_at"]
}
```

### 4.3. Entidade: `reservations` (Reservas)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Reservation",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid", "description": "Identificador único da reserva" },
    "gift_id": { "type": "string", "format": "uuid", "description": "Referência FK ao presente (gifts.id)" },
    "user_id": { "type": "string", "format": "uuid", "description": "Referência FK ao usuário (profiles.id / auth.users.id)" },
    "idempotency_key": { "type": "string", "description": "Chave de idempotência (UUID v4) vinculada ao usuário" },
    "status": { 
      "type": "string", 
      "enum": ["active", "cancelled_by_user", "released_by_admin"],
      "description": "Estado atual da reserva"
    },
    "reserved_at": { "type": "string", "format": "date-time", "description": "Timestamp em que a reserva foi efetivada" },
    "cancel_until": { "type": "string", "format": "date-time", "description": "Limite máximo para cancelamento autônomo (reserved_at + 10 minutos)" },
    "cancelled_at": { "type": ["string", "null"], "format": "date-time", "description": "Timestamp do cancelamento pelo convidado" },
    "released_at": { "type": ["string", "null"], "format": "date-time", "description": "Timestamp da liberação pelo administrador" },
    "released_by": { "type": ["string", "null"], "format": "uuid", "description": "ID do administrador que liberou a reserva" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "gift_id", "user_id", "idempotency_key", "status", "reserved_at", "cancel_until", "created_at"]
}
```

### 4.4. Entidade: `administrators` (Administradores Autorizados)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Administrator",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid", "description": "Identificador único" },
    "user_id": { "type": "string", "format": "uuid", "description": "Autoridade primária de autorização: FK para auth.users.id (ARQ-07)" },
    "email": { "type": "string", "format": "email", "description": "E-mail para auditoria e identificação administrativa secundária" },
    "role": { "type": "string", "enum": ["owner", "admin"], "default": "admin" },
    "is_active": { "type": "boolean", "default": true },
    "created_at": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "user_id", "is_active", "created_at"]
}
```

---

## 5. Estados Obrigatórios da Interface (UI State Machine)

| Estado | Descrição | O que a interface exibe | Ações possíveis |
| :--- | :--- | :--- | :--- |
| `loading` | Carregamento inicial de catálogo ou detalhes | Skeletons sutis no design system | Nenhuma (bloqueio de interação) |
| `empty` | Catálogo ou filtros sem resultados | Mensagem acolhedora editorial | Limpar filtros |
| `available` | Presente livre para reserva | Botão de ação editorial: *"Quero presentear"* | Clicar em *"Quero presentear"* |
| `reserving` | Processando a confirmação da reserva no backend | Estado intermediário: *"Confirmando sua reserva..."* + spinner discreto | Nenhuma (botão desabilitado, prevenção de duplo clique) |
| `reserved` | Presente já reservado por outro convidado | Badge sutil: *"✓ Já escolhido"* (projeção sanitizada sem expor `user_id`, ARQ-06) | Navegar para outros presentes |
| `reserved_by_me` | Presente reservado pelo usuário logado | Badge de destaque: *"✓ Reservado por você"* + (se `< 10 min`: botão *"Reservei por engano"* / se `> 10 min`: *"Reserva confirmada"*) | Desfazer reserva (se `< 10 min`) |
| `authentication_required` | Usuário clicou em presentear mas não está logado | Modal convidativo: *"Para continuar, entre com sua conta Google"* | *"Continuar com Google"* ou *"Voltar"* |
| `success` | Backend confirmou a gravação da reserva | Feedback claro e inequívoco de confirmação | Ir para */meus-presentes* ou Explorar mais |
| `conflict` | Outro usuário concluiu a reserva milissegundos antes | Aviso educado: *"Este presente acabou de ser reservado por outro convidado."* | Escolher outro presente |
| `error` | Erro definitivo tratado no backend (ex: item inativo) | Mensagem clara: *"Não conseguimos realizar sua reserva. A reserva NÃO foi realizada."* | Tentar novamente ou escolher outro |
| `network_uncertain` | Falha de rede / timeout antes da resposta | Modal de recuperação: *"Verificando o status real da sua reserva..."* com polling e preservação da mesma `idempotency_key` (ARQ-02, ARQ-03) | Aguardar sincronização ou *"Verificar agora"* |
| `unauthorized` | Tentativa de acesso à área restrita (/admin) | Tela silenciosa 404 Not Found (ARQ-07) | Voltar para a Home |

---

## 6. Rotas e Arquitetura de Páginas

- `/` — Home (Boas-vindas, história, informações do evento, atalhos).
- `/presentes` — Catálogo completo com busca, categorias e projeção sanitizada de status (`available` / `reserved`).
- `/presentes/[slug]` — Detalhe do presente, orientações, especificações e modal de confirmação.
- `/meus-presentes` — Área privada do convidado autenticado (listagem das suas reservas e botão de desfazer dentro dos 10 min).
- `/admin` — Painel restrito de noivos/administradores (autorizado exclusivamente por `user_id` em `administrators`).
- `/auth/callback` — Rota de callback OAuth do Supabase.
- `/api/reservations/*` — Route Handlers dedicados para mutações seguras e reconciliação (ARQ-05, ARQ-08).

---

## 7. Decisões Arquiteturais Formais (ARQ-01 a ARQ-09)

1. **ARQ-01 — Idempotência Estrutural no PostgreSQL:**
   - Garantia estrutural por constraint única de par:
     ```sql
     CREATE UNIQUE INDEX unique_user_reservation_idempotency 
     ON reservations (user_id, idempotency_key);
     ```
   - A RPC trata colisões deterministicamente, retornando a reserva já existente sem gerar segunda reserva e sem alterar timestamps.
2. **ARQ-02 & ARQ-03 — Reconciliação Rigorosa de Rede e Preservação de Intenção:**
   - `network_uncertain` nunca assume `available = falha` enquanto houver processamento em trânsito.
   - Preservação estrita da mesma `idempotency_key` em retries da mesma intenção.
   - Únicos 3 vereditos finais permitidos: `reserved_by_me`, `reserved_by_other / conflict` ou `available / operação não ocorreu`.
3. **ARQ-04 — Autenticação no Momento da Mutação:**
   - Toda operação crítica revalida o token JWT e o `auth.uid()` no servidor / PostgreSQL no exato momento da execução.
4. **ARQ-05 & ARQ-08 — Fronteira Oficial de Mutações (Route Handlers + RPCs):**
   - Fluxo obrigatório: `Browser → Next.js Route Handler → RPC PostgreSQL`.
   - Proibida escrita direta do navegador em `reservations` ou `administrators`.
5. **ARQ-06 — Sanitização e Privacidade Pública:**
   - O catálogo público consome apenas projeções sanitizadas (`available` ou `reserved`), sem dados de `user_id` ou de perfil de terceiros.
6. **ARQ-07 — Autorização Administrativa Baseada em `user_id`:**
   - Autoridade primária é o `user_id` registrado na tabela `administrators`. O e-mail é apenas metadado e auditoria. Separação formal: `autenticação ≠ autorização`.
7. **ARQ-09 — Estratégia de Estilização:**
   - CSS Custom Properties (`:root`) = Fonte da Verdade dos Design Tokens.
   - Tailwind CSS = Mecanismo principal de composição, espaçamento e responsividade consumindo os tokens CSS.
   - CSS Modules = Exceção restrita a componentes editoriais complexos.
