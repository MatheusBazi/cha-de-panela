# POP-03: Detalhes do Presente

## Objetivo
Apresentar as informações completas, imagens em alta definição, especificações/preferências e orientações de um presente específico (`/presentes/[slug]`), sem que a simples abertura da página altere o estado de disponibilidade (`INV-01`, `INV-03`).

## Entradas
- `slug` do presente vindo da URL.
- Contexto de autenticação do usuário.

## Saídas
- Dados completos do presente (`name`, `description`, `category`, `image_url`, `external_url`, `external_note`, `preferences`).
- Estado de disponibilidade (`available`, `reserved`, `reserved_by_me`).
- Se `reserved_by_me`: timestamp de reserva e tempo restante da janela de 10 minutos (`cancel_until`).

## Pré-condições
- Presente existe e está com `is_active = true`.

## Sequência Lógica de Execução
1. Frontend consulta o endpoint/RPC de detalhe do presente via `slug`.
2. Backend valida existência e disponibilidade.
3. Página renderiza os detalhes:
   - Galeria/Imagem principal.
   - Nome, categoria e descrição.
   - Preferências (ex: cor, voltagem).
   - Link de referência da loja (`external_url`) acompanhado de nota clara: *"Esta é apenas uma referência. Você pode comprar este presente onde preferir."*.
   - Botão de Ação condicional ao estado (`Quero presentear`, `✓ Já escolhido`, ou `✓ Reservado por você`).
4. Clicar no link externo abre nova aba (`target="_blank" rel="noopener noreferrer"`) sem disparar nenhuma mutação no backend.

## Ferramentas Futuras
- `tools/catalog/fetch_gift_by_slug.ts`

## Casos de Borda
- Slug inexistente ou presente inativo: exibir página 404 estilizada com link para voltar ao catálogo.
- Presente reservado enquanto o usuário lia os detalhes: ao clicar em presentear, o sistema tratará no fluxo atômico de reserva (POP-04 e POP-05).

## Critérios de Sucesso
- Abertura da página é 100% idempotente e somente leitura.
- Nenhuma reserva criada por visualização ou clique em loja externa.

## Critérios de Falha
- Disparo de qualquer alteração de estado no banco apenas pela navegação.
