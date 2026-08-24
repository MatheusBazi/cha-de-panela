-- =====================================================================
-- PROJETO: CHÁ DE COZINHA (DÉBORA & MATHEUS)
-- MIGRATION 01: SCHEMA PRINCIPAL, RLS, RPCS E 69 PRESENTES OFICIAIS
-- =====================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. FUNÇÃO CENTRALIZADA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TABELA: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- TRIGGER DE SINCRONIZAÇÃO AUTOMÁTICA DE PERFIL (AO CRIAR USUÁRIO NO AUTH.USERS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Convidado'),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.profiles.name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. TABELA: administrators
CREATE TABLE IF NOT EXISTS public.administrators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FUNÇÃO HELPER: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.administrators
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. TABELA: gifts
CREATE TABLE IF NOT EXISTS public.gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  image_url TEXT,
  external_url TEXT,
  external_note TEXT,
  preferences JSONB DEFAULT '{}'::JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_active_order ON public.gifts (is_active, display_order);

-- 6. TABELA: reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled_by_user', 'released_by_admin')),
  idempotency_key TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancel_until TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_gift_reservation 
ON public.reservations (gift_id) 
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_idempotency 
ON public.reservations (user_id, idempotency_key);

-- 7. VIEW: public_gifts_view
CREATE OR REPLACE VIEW public.public_gifts_view AS
SELECT
  g.id,
  g.slug,
  g.name,
  g.description,
  g.category,
  g.image_url,
  g.external_url,
  g.external_note,
  g.preferences,
  g.display_order,
  (EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.gift_id = g.id AND r.status = 'active'
  )) AS is_reserved
FROM public.gifts g
WHERE g.is_active = TRUE;

-- 8. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- POLICIES: profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- POLICIES: administrators
DROP POLICY IF EXISTS "administrators_select" ON public.administrators;
CREATE POLICY "administrators_select" ON public.administrators FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- POLICIES: gifts
DROP POLICY IF EXISTS "gifts_select_public" ON public.gifts;
CREATE POLICY "gifts_select_public" ON public.gifts FOR SELECT TO anon, authenticated USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "gifts_admin_all" ON public.gifts;
CREATE POLICY "gifts_admin_all" ON public.gifts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- POLICIES: reservations
DROP POLICY IF EXISTS "reservations_select_own_or_admin" ON public.reservations;
CREATE POLICY "reservations_select_own_or_admin" ON public.reservations FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- 9. RPC: reserve_gift_atomic
CREATE OR REPLACE FUNCTION public.reserve_gift_atomic(
  p_gift_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_reservation RECORD;
  v_gift_exists BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
  v_cancel_until TIMESTAMPTZ := v_now + INTERVAL '10 minutes';
  v_new_reservation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authentication_required',
      'message', 'É necessário estar autenticado para reservar um presente.'
    );
  END IF;

  -- 1. Idempotência: verificar se este usuário já enviou esta chave
  SELECT id, gift_id, status, cancel_until, reserved_at
  INTO v_existing_reservation
  FROM public.reservations
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_reservation.status = 'active' THEN
      RETURN jsonb_build_object(
        'status', 'reserved',
        'reservation_id', v_existing_reservation.id,
        'gift_id', v_existing_reservation.gift_id,
        'cancel_until', v_existing_reservation.cancel_until,
        'reserved_at', v_existing_reservation.reserved_at,
        'message', 'Presente já reservado por você anteriormente.'
      );
    ELSE
      RETURN jsonb_build_object(
        'status', 'conflict',
        'message', 'Esta tentativa de reserva já foi processada e encerrada.'
      );
    END IF;
  END IF;

  -- 2. Bloqueio pessimista do presente
  SELECT EXISTS(SELECT 1 FROM public.gifts WHERE id = p_gift_id AND is_active = TRUE)
  INTO v_gift_exists;

  IF NOT v_gift_exists THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Presente não encontrado ou não está mais ativo.'
    );
  END IF;

  -- 3. Verificar se já existe reserva ativa para este presente
  IF EXISTS (SELECT 1 FROM public.reservations WHERE gift_id = p_gift_id AND status = 'active') THEN
    RETURN jsonb_build_object(
      'status', 'already_reserved',
      'message', 'Este presente já foi reservado por outro convidado.'
    );
  END IF;

  -- 4. Inserir a nova reserva
  INSERT INTO public.reservations (
    gift_id,
    user_id,
    status,
    idempotency_key,
    reserved_at,
    cancel_until
  ) VALUES (
    p_gift_id,
    v_user_id,
    'active',
    p_idempotency_key,
    v_now,
    v_cancel_until
  )
  RETURNING id INTO v_new_reservation_id;

  RETURN jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_new_reservation_id,
    'gift_id', p_gift_id,
    'cancel_until', v_cancel_until,
    'reserved_at', v_now,
    'message', 'Presente reservado com sucesso! Muito obrigado pelo carinho.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'already_reserved',
      'message', 'Este presente acabou de ser reservado por outro convidado.'
    );
END;
$$;

-- 10. RPC: cancel_user_reservation
CREATE OR REPLACE FUNCTION public.cancel_user_reservation(
  p_reservation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_res RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'message', 'Não autenticado.');
  END IF;

  SELECT * INTO v_res
  FROM public.reservations
  WHERE id = p_reservation_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Reserva não encontrada.');
  END IF;

  IF v_res.status != 'active' THEN
    RETURN jsonb_build_object('status', 'already_inactive', 'message', 'Esta reserva já não está ativa.');
  END IF;

  IF NOW() > v_res.cancel_until THEN
    RETURN jsonb_build_object('status', 'window_expired', 'message', 'A janela de cancelamento de 10 minutos expirou. Fale com os noivos.');
  END IF;

  UPDATE public.reservations
  SET status = 'cancelled_by_user',
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object('status', 'cancelled', 'message', 'Reserva cancelada com sucesso.');
END;
$$;

-- 11. RPC: admin_release_reservation
CREATE OR REPLACE FUNCTION public.admin_release_reservation(
  p_reservation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('status', 'forbidden', 'message', 'Acesso administrativo necessário.');
  END IF;

  UPDATE public.reservations
  SET status = 'released_by_admin',
      released_at = NOW(),
      updated_at = NOW()
  WHERE id = p_reservation_id AND status = 'active';

  RETURN jsonb_build_object('status', 'released', 'message', 'Reserva liberada administrativamente.');
END;
$$;

-- 12. INSERÇÃO DOS 69 PRESENTES OFICIAIS
INSERT INTO public.gifts (slug, name, description, category, image_url, external_url, external_note, preferences, display_order, is_active)
VALUES
  ('air-fryer', 'Air fryer', 'Fritadeira elétrica sem óleo para refeições práticas e saudáveis no nosso dia a dia.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80', NULL, '110V ou 220V (qualquer voltagem nos atende).', '{"voltagem": "110V ou 220V"}'::jsonb, 1, TRUE),
  ('liquidificador', 'Liquidificador', 'Liquidificador potente com jarra resistente para sucos, vitaminas e receitas.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"voltagem": "110V"}'::jsonb, 2, TRUE),
  ('mixer', 'Mixer', 'Mixer manual para preparar molhos, sopas e cremes diretamente na panela.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1594385208974-2e75f8d7bb48?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 3, TRUE),
  ('sanduicheira', 'Sanduicheira', 'Sanduicheira e grill antiaderente para lanches rápidos e tostados.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"voltagem": "110V"}'::jsonb, 4, TRUE),
  ('cafeteira', 'Cafeteira', 'Cafeteira elétrica para preparar o café do dia a dia com praticidade.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"voltagem": "110V"}'::jsonb, 5, TRUE),
  ('chaleira-eletrica', 'Chaleira elétrica', 'Chaleira para esquentar água rapidamente para chá, café e preparo de refeições.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"voltagem": "110V"}'::jsonb, 6, TRUE),
  ('processador-de-alimentos', 'Processador de alimentos', 'Processador compacto para picar, ralar e fatiar temperos e vegetais.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"voltagem": "110V"}'::jsonb, 7, TRUE),
  ('jogo-de-potes-de-vidro-com-tampa-hermetica', 'Jogo de potes de vidro com tampa hermética', 'Conjunto de potes herméticos para conservação de alimentos na geladeira e despensa.', 'Itens mais pedidos', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80', NULL, 'Preferência por vidro com tampa hermética.', '{"material": "Vidro"}'::jsonb, 8, TRUE),
  ('jogo-de-panelas', 'Jogo de panelas', 'Conjunto de panelas antiaderentes com tampas de vidro para preparar nossas refeições.', 'Cozinha', 'https://images.unsplash.com/photo-1584990347449-a2a537f7d1a2?auto=format&fit=crop&w=800&q=80', NULL, 'Cor neutra (preto, cinza, bege ou inox).', '{"cor": "Neutra"}'::jsonb, 9, TRUE),
  ('frigideira-antiaderente', 'Frigideira antiaderente', 'Frigideira funda antiaderente para grelhados, omeletes e refogados rápidos.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 10, TRUE),
  ('panela-de-pressao', 'Panela de pressão', 'Panela de pressão com trava de segurança para feijão, carnes e ensopados.', 'Cozinha', 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=800&q=80', NULL, '4,5 litros com válvula de segurança.', '{"capacidade": "4.5L"}'::jsonb, 11, TRUE),
  ('leiteira-fervedor', 'Leiteira / Fervedor', 'Fervedor antiaderente ou inox para aquecer leite, água e caldos.', 'Cozinha', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 12, TRUE),
  ('jogo-de-assadeiras-de-vidro', 'Jogo de assadeiras de vidro', 'Travessas refratárias de vidro para forno e servir à mesa.', 'Cozinha', 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"material": "Vidro refratário"}'::jsonb, 13, TRUE),
  ('assadeira-antiaderente', 'Assadeira antiaderente', 'Forma retangular antiaderente para bolos, tortas e assados.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 14, TRUE),
  ('forma-de-bolo-com-furo-no-meio', 'Forma de bolo com furo no meio', 'Forma de pudim e bolo clássico em alumínio ou antiaderente.', 'Cozinha', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 15, TRUE),
  ('escorredor-de-louca', 'Escorredor de louça', 'Escorredor de pratos e talheres com bandeja coletora de água.', 'Cozinha', 'https://images.unsplash.com/photo-1584990347449-a2a537f7d1a2?auto=format&fit=crop&w=800&q=80', NULL, 'Inox ou preto fosco.', '{"cor": "Inox ou Preto"}'::jsonb, 16, TRUE),
  ('escorredor-de-massa-arroz', 'Escorredor de massa / arroz', 'Escorredor em aço inox com furos finos para massas, saladas e grãos.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"material": "Inox"}'::jsonb, 17, TRUE),
  ('kit-de-peneiras', 'Kit de peneiras', 'Conjunto com 3 tamanhos de peneiras em aço inox.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, '{"material": "Inox"}'::jsonb, 18, TRUE),
  ('tabua-de-corte', 'Tábua de corte', 'Tábua de bambu ou polietileno resistente para corte de carnes e legumes.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, 'Preferência por bambu.', '{"material": "Bambu"}'::jsonb, 19, TRUE),
  ('jogo-de-facas-de-cozinha', 'Jogo de facas de cozinha', 'Kit de facas em aço inox com faca do chef, de pão e de legumes.', 'Cozinha', 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 20, TRUE),
  ('tesoura-culinaria', 'Tesoura culinária', 'Tesoura multiuso de cozinha com lâmina em inox para embalagens e ervas.', 'Cozinha', 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 21, TRUE),
  ('ralador-multiuso', 'Ralador multiuso', 'Ralador 4 faces em aço inox para queijos, legumes e frutas.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 22, TRUE),
  ('descascador-de-legumes', 'Descascador de legumes', 'Descascador anatômico em Y para frutas e vegetais.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 23, TRUE),
  ('espremedor-de-alho', 'Espremedor de alho', 'Espremedor resistente em metal fundido ou inox para temperos.', 'Cozinha', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 24, TRUE),
  ('aparelho-de-jantar', 'Aparelho de jantar', 'Conjunto com pratos rasos, fundos e de sobremesa em cerâmica ou porcelana.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80', NULL, 'Branco, off-white ou tons neutros.', '{"cor": "Tons Neutros"}'::jsonb, 25, TRUE),
  ('faqueiro-completo', 'Faqueiro completo', 'Jogo de talheres em aço inox com facas, garfos, colheres de sopa e sobremesa.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80', NULL, 'Aço inox tradicional.', '{"material": "Inox"}'::jsonb, 26, TRUE),
  ('jogo-de-copos', 'Jogo de copos', 'Conjunto com 6 copos de vidro para água e sucos.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', NULL, 'Vidro transparente.', NULL, 27, TRUE),
  ('jogo-de-tacas-de-agua-vinho', 'Jogo de taças de água / vinho', 'Conjunto com 6 taças de cristal ecológico ou vidro para receber visitas.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 28, TRUE),
  ('jogo-de-xicaras-de-cha-cafe', 'Jogo de xícaras de chá / café', 'Conjunto de xícaras com pires em cerâmica para receber os amigos.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80', NULL, 'Tons neutros ou sálvia.', NULL, 29, TRUE),
  ('jarra-de-suco-agua', 'Jarra de suco / água', 'Jarra de vidro com tampa de 1,5L para a mesa.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', NULL, 'Vidro.', NULL, 30, TRUE),
  ('travessas-para-servir', 'Travessas para servir', 'Travessas ovais ou retangulares em cerâmica branca.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 31, TRUE),
  ('saladeira', 'Saladeira', 'Bowl grande de vidro ou cerâmica para servir saladas e acompanhamentos.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 32, TRUE),
  ('petisqueira', 'Petisqueira', 'Petisqueira com divisórias em bambu ou cerâmica para momentos de confraternização.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80', NULL, 'Bambu ou cerâmica.', NULL, 33, TRUE),
  ('galheteiro-azeite-vinagre', 'Galheteiro (azeite e vinagre)', 'Conjunto com dosadores de azeite e vinagre em vidro.', 'Mesa e Servir', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 34, TRUE),
  ('garrafa-termica', 'Garrafa térmica', 'Garrafa térmica com ampola de vidro para manter o café quentinho por horas.', 'Café e Café da Manhã', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80', NULL, 'Cores neutras (bege, branco, verde sálvia ou preto).', '{"cor": "Neutra"}'::jsonb, 35, TRUE),
  ('acucareiro-e-meleira', 'Açucareiro e meleira', 'Conjunto charmoso em cerâmica ou vidro para a mesa de café da manhã.', 'Café e Café da Manhã', 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 36, TRUE),
  ('manteigueira', 'Manteigueira', 'Manteigueira francesa ou tradicional com tampa em cerâmica.', 'Café e Café da Manhã', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 37, TRUE),
  ('porta-frios', 'Porta-frios', 'Recipiente duplo hermético em acrílico/inox para queijo e presunto fatiados.', 'Café e Café da Manhã', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 38, TRUE),
  ('cesta-para-paes', 'Cesta para pães', 'Cesto de tecido com forro lavável ou fibra natural para servir pães.', 'Café e Café da Manhã', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 39, TRUE),
  ('balde-e-bacia', 'Balde e bacia', 'Conjunto com balde de 10L e bacia resistente para limpeza.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, 'Cores neutras (cinza, branco ou verde).', NULL, 40, TRUE),
  ('vassoura-e-rodo', 'Vassoura e rodo', 'Vassoura de cerdas macias para pisos internos e rodo de borracha dupla.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 41, TRUE),
  ('pa-de-lixo', 'Pá de lixo', 'Pá com cabo longo ergonômico para facilitar o recolhimento.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 42, TRUE),
  ('esfregao-mop', 'Esfregão / Mop', 'Mop giratório com balde centrífuga para facilitar a limpeza do chão.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 43, TRUE),
  ('panos-de-microfibra', 'Panos de microfibra', 'Kit com panos de microfibra multiuso para móveis, vidros e bancadas.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 44, TRUE),
  ('panos-de-prato', 'Panos de prato', 'Kit com panos de prato 100% algodão atoalhado de alta absorção.', 'Limpeza', 'https://images.unsplash.com/photo-1584990347449-a2a537f7d1a2?auto=format&fit=crop&w=800&q=80', NULL, 'Estampas discretas ou neutras.', NULL, 45, TRUE),
  ('lixeira-para-pia-de-cozinha', 'Lixeira para pia de cozinha', 'Lixeira compacta em inox ou plástico fosco com tampa para pia.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, 'Inox ou preto.', NULL, 46, TRUE),
  ('lixeira-para-banheiro-com-pedal', 'Lixeira para banheiro com pedal', 'Lixeira em aço inox com pedal e fechamento suave para o banheiro.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, 'Inox ou branco.', NULL, 47, TRUE),
  ('varal-de-chao', 'Varal de chão', 'Varal dobrável em alumínio com abas para estender roupas.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, 'Alumínio reforçado.', NULL, 48, TRUE),
  ('prendedores-de-roupa', 'Prendedores de roupa', 'Kit com prendedores de roupa resistentes com cesto organizador.', 'Limpeza', 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 49, TRUE),
  ('jogo-de-lencol-casal-queen', 'Jogo de lençol casal / queen', 'Jogo de lençol 100% algodão 200 fios macio e aconchegante.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80', NULL, 'Tamanho Queen. Cores neutras (branco, bege, cinza claro ou sálvia).', '{"tamanho": "Queen", "cor": "Neutra"}'::jsonb, 50, TRUE),
  ('travesseiros', 'Travesseiros', 'Par de travesseiros confortáveis de suporte médio para nossas noites de descanso.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 51, TRUE),
  ('protetor-de-colchao-queen', 'Protetor de colchão queen', 'Capa impermeável e acolchoada para proteger o colchão.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80', NULL, 'Tamanho Queen.', '{"tamanho": "Queen"}'::jsonb, 52, TRUE),
  ('jogo-de-toalhas-de-banho', 'Jogo de toalhas de banho', 'Conjunto com 2 toalhas de banho e 2 de rosto 100% algodão de alta gramatura.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=800&q=80', NULL, 'Cores neutras (areia, bege, sálvia ou cinza).', '{"cor": "Tons Terrosos / Neutros"}'::jsonb, 53, TRUE),
  ('tapetes-para-banheiro', 'Tapetes para banheiro', 'Tapete antiderrapante macio e de rápida secagem para a saída do banho.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 54, TRUE),
  ('cesto-para-roupa-suja', 'Cesto para roupa suja', 'Cesto dobrável em bambu ou tecido impermeável para organizar roupas.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 55, TRUE),
  ('kit-de-acessorios-para-banheiro', 'Kit de acessórios para banheiro', 'Porta-sabonete líquido, porta-escovas e bandeja em cerâmica.', 'Quarto e Banheiro', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 56, TRUE),
  ('cabides-para-roupas', 'Cabides para roupas', 'Kit com 30 cabides aveludados ultrafinos para organizar o guarda-roupa.', 'Organização', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80', NULL, 'Veludo bege ou preto.', '{"cor": "Bege ou Preto"}'::jsonb, 57, TRUE),
  ('organizadores-de-gaveta', 'Organizadores de gaveta', 'Divisórias moduláveis em acrílico para roupas íntimas, meias e acessórios.', 'Organização', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 58, TRUE),
  ('caixas-organizadoras', 'Caixas organizadoras', 'Caixas com tampa em tecido ou plástico fosco para despensa e armários.', 'Organização', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 59, TRUE),
  ('porta-temperos-giratorio', 'Porta-temperos giratório', 'Suporte giratório em inox ou bambu com potes de vidro para especiarias.', 'Organização', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 60, TRUE),
  ('suporte-para-papel-toalha-e-filme', 'Suporte para papel-toalha e filme', 'Organizador de parede ou bancada para rolos de papel-toalha e papel-alumínio.', 'Organização', 'https://images.unsplash.com/photo-1584990347449-a2a537f7d1a2?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 61, TRUE),
  ('ganchos-e-suportes-adesivos', 'Ganchos e suportes adesivos', 'Kit com ganchos adesivos de alta fixação para panos, toalhas e utensílios.', 'Organização', 'https://images.unsplash.com/photo-1584990347449-a2a537f7d1a2?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 62, TRUE),
  ('jogo-americano', 'Jogo americano', 'Conjunto com 6 lugares americanos de fibra natural ou tecido impermeável.', 'Itens Coringa', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 63, TRUE),
  ('toalha-de-mesa', 'Toalha de mesa', 'Toalha de mesa elegante em linho ou algodão para mesa de 6 lugares.', 'Itens Coringa', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80', NULL, 'Tons neutros.', NULL, 64, TRUE),
  ('abridor-de-vinho-e-garrafas', 'Abridor de vinho e garrafas', 'Saca-rolhas ergonômico de dois estágios e abridor multifunção.', 'Itens Coringa', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 65, TRUE),
  ('balanca-digital-de-cozinha', 'Balança digital de cozinha', 'Balança de precisão de até 5kg para dosar receitas.', 'Itens Coringa', 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 66, TRUE),
  ('porta-copos', 'Porta-copos', 'Conjunto com porta-copos em cortiça, madeira ou cerâmica.', 'Itens Coringa', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 67, TRUE),
  ('moringa-de-cabeceira', 'Moringa de cabeceira', 'Moringa de vidro com copo/tampa para a mesa de cabeceira.', 'Itens Coringa', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 68, TRUE),
  ('difusor-de-aromas-e-velas', 'Difusor de aromas e velas', 'Vela aromática e difusor de varetas com aroma aconchegante para a nossa casa.', 'Itens Coringa', 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80', NULL, NULL, NULL, 69, TRUE)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    image_url = EXCLUDED.image_url,
    external_url = EXCLUDED.external_url,
    external_note = EXCLUDED.external_note,
    preferences = EXCLUDED.preferences,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- FIM DA MIGRATION
