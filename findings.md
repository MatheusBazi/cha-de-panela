# REGISTRO DE DESCOBERTAS E AUDITORIA (FINDINGS)

## 1. Comparação Formal: Design System Board HTML vs. Implementação Next.js

### 1.1. Tipografia e Fontes
* **HTML Original:** 
  - Títulos: `Cormorant Garamond` (pesos 300, 400, 500)
  - Interface/Corpo: `Karla` (pesos 300 a 600)
  - Assinatura/Afetivo: `Parisienne` (máx. 6 palavras, nunca essencial nem em botões)
* **Implementação Next.js:** Integradas via `next/font/google` com CSS variables (`--font-cormorant`, `--font-karla`, `--font-parisienne`) consumidas pelo Tailwind (`font-serif`, `font-sans`, `font-script`).

### 1.2. Paleta de Cores e Tokens
* **Fundo Principal:** `#F4EFE7` (Warm Off-White)
* **Fundo Secundário:** `#EDE6DA` (Warm Sand Wash)
* **Superfície dos Cards:** `#FBF8F3` (Paper White)
* **Superfície Elevada:** `#FFFDFA` (Modais e dropdowns)
* **Bloco de Destaque:** `#E8DED0` (Ivory / Cream)
* **Texto Principal:** `#493E33` (Warm Espresso - Contraste 9.4:1 AAA sobre off-white)
* **Texto Secundário:** `#6B5D4E` (Espresso 70 - Contraste 5.6:1 AA)
* **Texto Discreto:** `#8C8073` (Espresso 50)
* **Botão Primário:** `#6B7154` (Deep Olive com texto `#FBF8F3` 5.9:1 AA)
* **Hover do Primário:** `#565B43`
* **Botão Secundário:** Borda `#969E78`, hover background `#EDEFE4`
* **Madeira (Acento Pontual):** `#BA9568`
* **Divisores:** `#E2D8C9` (Border Soft) e `#C7BCAB` (Border Strong)

### 1.3. Formas, Bordas e Sombras
* **Border Radius:** `xs: 4px`, `sm: 8px` (inputs e badges), `md: 12px` (botões e cards), `lg: 20px` (modais), `xl: 32px`, `full: 999px` (apenas chips e avatares).
* **Sombras:** Em espresso translúcido (`rgba(73,62,51,...)`), nunca pretas ou cinzas duras de dashboard.
* **Folhagens Decorativas:** SVGs em ramos suaves nos cantos (opacidade 40-60%), sempre atrás do conteúdo e nunca sob texto corrido.

---

## 2. Conteúdo Real do CEO Parametrizado

* **Casal:** Débora e Matheus (Débora & Matheus)
* **Data:** 21 de novembro de 2026 (21/11/2026)
* **Horário:** 15:00
* **Local:** "Local em breve" (placeholder editorial elegante pronto para parametrização futura sem quebra de layout)
* **Catálogo Real:** 69 presentes oficiais distribuídos nas 8 categorias do CEO (Cozinha, Mesa e Servir, Café e Café da Manhã, Limpeza, Quarto e Banheiro, Organização, Itens Coringa, Itens mais pedidos).

---

## 3. Gestão de Administradores (Bootstrap Seguro)

* **Allowlist Aprovada:**
  - `deboragabrielepereira@gmail.com`
  - `matheusbazi01@gmail.com`
* **Estratégia:** No login Google (`/auth/callback`), o e-mail autenticado é verificado contra a allowlist e provisionado na tabela `administrators` com `user_id`, `role = 'owner'` e `is_active = true`. A partir desse momento, `user_id` é a autoridade primária e imutável para autorização no servidor.

---

## 4. Gestão de Catálogo no Admin (CRUD & Soft-Delete)

* **Segurança no Servidor:** O endpoint `/api/admin/gifts` valida `auth.getUser()` e status ativo em `administrators`.
* **Soft-Delete Seguro:** A remoção de presentes executa `is_active = false`, ocultando o item do catálogo público enquanto preserva a integridade de reservas ativas ou históricas.
* **Reativação:** O painel administrativo permite visualizar itens inativos e reativá-los com 1 clique (`PATCH /api/admin/gifts`).
