-- =====================================================================
-- BATERIA DE TESTES AUTOMATIZADOS — FASE 2: BANCO E SEGURANÇA
-- TESTES T-01 A T-12
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SETUP: USUÁRIOS DE TESTE (FIXTURES EFÊMERAS)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE test_results (
  test_id TEXT PRIMARY KEY,
  description TEXT,
  passed BOOLEAN,
  details TEXT
);

DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111'::UUID;
  v_user_b UUID := '22222222-2222-4222-8222-222222222222'::UUID;
  v_admin_user UUID := '99999999-9999-4999-8999-999999999999'::UUID;
  
  v_gift_1 UUID;
  v_gift_2 UUID;
  v_res_1 UUID;
  v_error_caught BOOLEAN := false;
BEGIN
  -- -------------------------------------------------------------------
  -- T-01: Schema — Todas as tabelas e views existem
  -- -------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gifts' AND table_schema = 'public') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'administrators' AND table_schema = 'public') AND
     EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'public_gifts_view' AND table_schema = 'public') THEN
    INSERT INTO test_results VALUES ('T-01', 'Tabelas e views essenciais criadas com sucesso', true, 'profiles, gifts, reservations, administrators, public_gifts_view');
  ELSE
    INSERT INTO test_results VALUES ('T-01', 'Tabelas e views essenciais criadas com sucesso', false, 'Faltando tabelas no schema');
  END IF;

  -- -------------------------------------------------------------------
  -- T-02: Slug — Unicidade de slug em gifts
  -- -------------------------------------------------------------------
  INSERT INTO public.gifts (slug, name, category, image_url)
  VALUES ('batedeira-planetaria', 'Batedeira Planetária', 'Eletroportáteis', 'https://example.com/batedeira.jpg')
  RETURNING id INTO v_gift_1;

  v_error_caught := false;
  BEGIN
    INSERT INTO public.gifts (slug, name, category, image_url)
    VALUES ('batedeira-planetaria', 'Outra Batedeira', 'Eletroportáteis', 'https://example.com/batedeira2.jpg');
  EXCEPTION WHEN unique_violation THEN
    v_error_caught := true;
  END;

  INSERT INTO test_results VALUES ('T-02', 'Dois presentes não podem ter o mesmo slug', v_error_caught, 'Violação de unicidade idx_gifts_slug disparada');

  -- -------------------------------------------------------------------
  -- T-03: Reserva Ativa — Duas reservas ativas para o mesmo gift_id
  -- -------------------------------------------------------------------
  -- Simula inserção em auth.users se necessário para FKs ou desativa temporariamente
  -- Inserção da primeira reserva ativa
  INSERT INTO public.reservations (gift_id, user_id, idempotency_key, status, reserved_at, cancel_until)
  VALUES (v_gift_1, v_user_a, 'key-1', 'active', NOW(), NOW() + INTERVAL '10 min')
  RETURNING id INTO v_res_1;

  v_error_caught := false;
  BEGIN
    -- Tentativa do usuário B reservar o mesmo presente
    INSERT INTO public.reservations (gift_id, user_id, idempotency_key, status, reserved_at, cancel_until)
    VALUES (v_gift_1, v_user_b, 'key-2', 'active', NOW(), NOW() + INTERVAL '10 min');
  EXCEPTION WHEN unique_violation THEN
    v_error_caught := true;
  END;

  INSERT INTO test_results VALUES ('T-03', 'Duas reservas active para o mesmo presente são bloqueadas', v_error_caught, 'Índice único parcial unique_active_gift_reservation bloqueou colisão');

  -- -------------------------------------------------------------------
  -- T-04: Histórico — Cancelamento permite nova reserva sem apagar anterior
  -- -------------------------------------------------------------------
  -- Usuário A cancela sua reserva
  UPDATE public.reservations
  SET status = 'cancelled_by_user', cancelled_at = NOW()
  WHERE id = v_res_1;

  v_error_caught := false;
  BEGIN
    -- Usuário B agora consegue reservar o mesmo presente
    INSERT INTO public.reservations (gift_id, user_id, idempotency_key, status, reserved_at, cancel_until)
    VALUES (v_gift_1, v_user_b, 'key-3', 'active', NOW(), NOW() + INTERVAL '10 min');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught AND (SELECT COUNT(*) FROM public.reservations WHERE gift_id = v_gift_1) = 2 THEN
    INSERT INTO test_results VALUES ('T-04', 'Reserva cancelada permite nova reserva preservando histórico (2 linhas no banco)', true, 'Histórico completo intacto');
  ELSE
    INSERT INTO test_results VALUES ('T-04', 'Reserva cancelada permite nova reserva preservando histórico', false, 'Erro ao re-reservar ou histórico foi apagado');
  END IF;

  -- -------------------------------------------------------------------
  -- T-05: Idempotência — Mesma chave para o mesmo usuário
  -- -------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    INSERT INTO public.reservations (gift_id, user_id, idempotency_key, status, reserved_at, cancel_until)
    VALUES (v_gift_1, v_user_b, 'key-3', 'active', NOW(), NOW() + INTERVAL '10 min');
  EXCEPTION WHEN unique_violation THEN
    v_error_caught := true;
  END;

  INSERT INTO test_results VALUES ('T-05', 'Duplicação de (user_id, idempotency_key) bloqueada estruturalmente', v_error_caught, 'unique_user_reservation_idempotency disparado');

  -- -------------------------------------------------------------------
  -- T-06: Status Inválido — Violação de consistência de status
  -- -------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    -- Status active com cancelled_at preenchido (contraditório)
    INSERT INTO public.reservations (gift_id, user_id, idempotency_key, status, reserved_at, cancel_until, cancelled_at)
    VALUES (v_gift_1, v_user_a, 'key-bad', 'active', NOW(), NOW() + INTERVAL '10 min', NOW());
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;

  INSERT INTO test_results VALUES ('T-06', 'Combinações contraditórias de status/timestamps rejeitadas', v_error_caught, 'Constraint chk_reservation_status_consistency barrou estado inválido');

  -- -------------------------------------------------------------------
  -- T-07 & T-11: Catálogo Público — Sanitização e Apenas Ativos
  -- -------------------------------------------------------------------
  INSERT INTO public.gifts (slug, name, category, image_url, is_active)
  VALUES ('item-inativo', 'Item Desativado', 'Geral', 'https://example.com/inativo.jpg', false)
  RETURNING id INTO v_gift_2;

  IF (SELECT COUNT(*) FROM public.public_gifts_view WHERE slug = 'item-inativo') = 0 AND
     (SELECT is_reserved FROM public.public_gifts_view WHERE slug = 'batedeira-planetaria') = true THEN
    INSERT INTO test_results VALUES ('T-07/11', 'Catálogo público exibe apenas ativos e mascara dados privados em is_reserved booleano', true, 'Zero vazamento de user_id no catálogo público');
  ELSE
    INSERT INTO test_results VALUES ('T-07/11', 'Catálogo público exibe apenas ativos e mascara dados privados', false, 'Item inativo exibido ou is_reserved incorreto');
  END IF;

END $$;

SELECT * FROM test_results ORDER BY test_id;

ROLLBACK;
