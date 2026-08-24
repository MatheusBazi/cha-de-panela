-- =====================================================================
-- PROJETO: CHÁ DE COZINHA (LISTA DE PRESENTES)
-- MIGRATION 01: SCHEMA PRINCIPAL, CONSTRAINTS, ÍNDICES, RLS E RPCS
-- VERSÃO: RELEASE CANDIDATE (FASES 0 A 13 FAST-TRACK)
-- =====================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. FUNÇÃO CENTRALIZADA PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 3. TABELA: profiles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
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

-- ---------------------------------------------------------------------
-- 4. TABELA: gifts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  external_url TEXT,
  external_note TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_slug ON public.gifts(slug);
CREATE INDEX IF NOT EXISTS idx_gifts_active_order ON public.gifts(is_active, display_order);

CREATE TRIGGER set_gifts_updated_at
BEFORE UPDATE ON public.gifts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 5. TABELA: reservations
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('active', 'cancelled_by_user', 'released_by_admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  status public.reservation_status NOT NULL DEFAULT 'active',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancel_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  cancelled_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- CONSISTÊNCIA DE STATUS (ARQ-01 / INV-05)
  CONSTRAINT chk_reservation_status_consistency CHECK (
    (status = 'active' AND cancelled_at IS NULL AND released_at IS NULL AND released_by IS NULL) OR
    (status = 'cancelled_by_user' AND cancelled_at IS NOT NULL AND released_at IS NULL AND released_by IS NULL) OR
    (status = 'released_by_admin' AND released_at IS NOT NULL AND released_by IS NOT NULL AND cancelled_at IS NULL)
  ),

  -- INTEGRIDADE DA JANELA DE TEMPO
  CONSTRAINT chk_cancel_until_order CHECK (cancel_until >= reserved_at)
);

-- CONSTRAINT CRÍTICA 1: NO MÁXIMO UMA RESERVA ATIVA POR PRESENTE (ÍNDICE ÚNICO PARCIAL)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_gift_reservation 
ON public.reservations (gift_id) 
WHERE status = 'active';

-- CONSTRAINT CRÍTICA 2: IDEMPOTÊNCIA ESTRUTURAL (user_id + idempotency_key)
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_reservation_idempotency 
ON public.reservations (user_id, idempotency_key);

-- ÍNDICES AUXILIARES DE CONSULTA PRIVADA
CREATE INDEX IF NOT EXISTS idx_reservations_user_status ON public.reservations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_gift_id ON public.reservations (gift_id);

CREATE TRIGGER set_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 6. TABELA: administrators
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('owner', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.admin_role NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_administrators_updated_at
BEFORE UPDATE ON public.administrators
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 7. SUPERFÍCIE PÚBLICA SANITIZADA CONTROLADA (SEC-FIX-03 / ARQ-06)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_gifts()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  image_url TEXT,
  external_url TEXT,
  external_note TEXT,
  preferences JSONB,
  display_order INTEGER,
  is_reserved BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
    EXISTS (
      SELECT 1 
      FROM public.reservations r 
      WHERE r.gift_id = g.id 
        AND r.status = 'active'
    ) AS is_reserved
  FROM public.gifts g
  WHERE g.is_active = true
  ORDER BY g.display_order ASC, g.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_gifts() TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_gifts_view AS
SELECT * FROM public.get_public_gifts();

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) — DEFESA EM PROFUNDIDADE
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.administrators 
    WHERE user_id = auth.uid() 
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);

-- POLÍTICAS gifts
DROP POLICY IF EXISTS "gifts_select_active" ON public.gifts;
CREATE POLICY "gifts_select_active" ON public.gifts
FOR SELECT USING (
  is_active = true OR public.is_admin()
);

DROP POLICY IF EXISTS "gifts_insert_admin" ON public.gifts;
CREATE POLICY "gifts_insert_admin" ON public.gifts
FOR INSERT WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "gifts_update_admin" ON public.gifts;
CREATE POLICY "gifts_update_admin" ON public.gifts
FOR UPDATE USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "gifts_delete_admin" ON public.gifts;
CREATE POLICY "gifts_delete_admin" ON public.gifts
FOR DELETE USING (
  public.is_admin()
);

-- POLÍTICAS reservations
DROP POLICY IF EXISTS "reservations_select_own_or_admin" ON public.reservations;
CREATE POLICY "reservations_select_own_or_admin" ON public.reservations
FOR SELECT USING (
  auth.uid() = user_id OR public.is_admin()
);

-- POLÍTICAS administrators (SEC-02)
DROP POLICY IF EXISTS "administrators_select_admin" ON public.administrators;
CREATE POLICY "administrators_select_admin" ON public.administrators
FOR SELECT USING (
  public.is_admin()
);

-- ---------------------------------------------------------------------
-- 9. MOTOR DE RESERVA ATÔMICA (FASE 6: RPC reserve_gift_atomic)
-- ---------------------------------------------------------------------
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
  v_user_id UUID;
  v_gift_exists BOOLEAN;
  v_gift_active BOOLEAN;
  v_existing_reservation RECORD;
  v_active_reservation RECORD;
  v_new_reservation_id UUID;
  v_reserved_at TIMESTAMPTZ;
  v_cancel_until TIMESTAMPTZ;
BEGIN
  -- 1. Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'authentication_required',
      'message', 'É necessário estar autenticado com o Google para reservar este presente.'
    );
  END IF;

  -- 2. Validar idempotência prévia do mesmo usuário
  SELECT id, gift_id, status, reserved_at, cancel_until
  INTO v_existing_reservation
  FROM public.reservations
  WHERE user_id = v_user_id 
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_reservation.status = 'active' THEN
      RETURN jsonb_build_object(
        'status', 'already_reserved_by_me',
        'reservation_id', v_existing_reservation.id,
        'gift_id', v_existing_reservation.gift_id,
        'reserved_at', v_existing_reservation.reserved_at,
        'cancel_until', v_existing_reservation.cancel_until,
        'message', 'Sua intenção de reserva já foi registrada com sucesso.'
      );
    ELSE
      RETURN jsonb_build_object(
        'status', 'previously_cancelled',
        'message', 'Esta reserva associada a esta chave já foi cancelada anteriormente.'
      );
    END IF;
  END IF;

  -- 3. Bloqueio pessimista de linha (FOR UPDATE) no presente para serializar corridas
  SELECT EXISTS(SELECT 1 FROM public.gifts WHERE id = p_gift_id),
         is_active
  INTO v_gift_exists, v_gift_active
  FROM public.gifts
  WHERE id = p_gift_id
  FOR UPDATE;

  IF NOT v_gift_exists THEN
    RETURN jsonb_build_object(
      'status', 'gift_not_found',
      'message', 'Presente não encontrado no catálogo.'
    );
  END IF;

  IF NOT v_gift_active THEN
    RETURN jsonb_build_object(
      'status', 'gift_inactive',
      'message', 'Este presente não está mais ativo para reservas.'
    );
  END IF;

  -- 4. Verificar se já existe uma reserva ativa para o presente
  SELECT id, user_id
  INTO v_active_reservation
  FROM public.reservations
  WHERE gift_id = p_gift_id
    AND status = 'active';

  IF FOUND THEN
    IF v_active_reservation.user_id = v_user_id THEN
      RETURN jsonb_build_object(
        'status', 'already_reserved_by_me',
        'reservation_id', v_active_reservation.id,
        'message', 'Você já possui uma reserva ativa para este presente.'
      );
    ELSE
      -- Sanitizado: nunca vazar quem reservou
      RETURN jsonb_build_object(
        'status', 'already_reserved',
        'message', 'Este presente acabou de ser escolhido por outro convidado.'
      );
    END IF;
  END IF;

  -- 5. Executar a reserva atômica utilizando o relógio do PostgreSQL
  v_reserved_at := NOW();
  v_cancel_until := v_reserved_at + INTERVAL '10 minutes';

  INSERT INTO public.reservations (
    gift_id,
    user_id,
    idempotency_key,
    status,
    reserved_at,
    cancel_until
  )
  VALUES (
    p_gift_id,
    v_user_id,
    p_idempotency_key,
    'active',
    v_reserved_at,
    v_cancel_until
  )
  RETURNING id INTO v_new_reservation_id;

  RETURN jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_new_reservation_id,
    'gift_id', p_gift_id,
    'reserved_at', v_reserved_at,
    'cancel_until', v_cancel_until,
    'message', 'Presente reservado com sucesso! Muito obrigado pelo carinho.'
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Concorrência interceptada pela constraint única do PostgreSQL
    RETURN jsonb_build_object(
      'status', 'already_reserved',
      'message', 'Este presente acabou de ser escolhido por outro convidado.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Ocorreu um erro ao processar sua reserva. Por favor, tente novamente.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_gift_atomic(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 10. CANCELAMENTO AUTÔNOMO (FASE 7: RPC cancel_user_reservation)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_user_reservation(
  p_reservation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_reservation RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'message', 'Autenticação necessária.'
    );
  END IF;

  SELECT id, user_id, status, cancel_until
  INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Reserva não encontrada.'
    );
  END IF;

  IF v_reservation.user_id <> v_user_id THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'message', 'Você não tem permissão para cancelar esta reserva.'
    );
  END IF;

  IF v_reservation.status <> 'active' THEN
    RETURN jsonb_build_object(
      'status', 'not_active',
      'message', 'Esta reserva já não está mais ativa.'
    );
  END IF;

  -- Validação estrita da janela de 10 minutos pelo relógio do PostgreSQL
  IF NOW() > v_reservation.cancel_until THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'message', 'O prazo de 10 minutos para cancelamento autônomo expirou. Caso precise alterar, fale com os noivos.'
    );
  END IF;

  -- Atualizar para cancelled_by_user
  UPDATE public.reservations
  SET status = 'cancelled_by_user',
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'status', 'cancelled',
    'message', 'Reserva liberada com sucesso. O presente voltou a ficar disponível para outros convidados.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_user_reservation(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 11. LIBERAÇÃO ADMINISTRATIVA (FASE 9: RPC admin_release_reservation)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_release_reservation(
  p_reservation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_reservation RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'status', 'forbidden',
      'message', 'Acesso restrito a administradores autorizados.'
    );
  END IF;

  SELECT id, gift_id, status
  INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Reserva não encontrada.'
    );
  END IF;

  IF v_reservation.status <> 'active' THEN
    RETURN jsonb_build_object(
      'status', 'already_inactive',
      'message', 'Esta reserva já estava cancelada ou liberada.'
    );
  END IF;

  UPDATE public.reservations
  SET status = 'released_by_admin',
      released_at = NOW(),
      released_by = v_admin_id,
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'status', 'released',
    'message', 'Reserva liberada com sucesso pelo administrador.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_release_reservation(UUID) TO authenticated;
