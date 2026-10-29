
-- =========================================================
-- 1) Admin Master = plano max fixo
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_override text;
  v_plan text;
BEGIN
  -- 1. Admin Master fixo em max
  SELECT EXISTS (
    SELECT 1 FROM public.global_admins
    WHERE user_id = p_user_id AND active = true
  ) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN 'max';
  END IF;

  -- 2. Override manual válido
  SELECT plan INTO v_override
  FROM public.plan_overrides
  WHERE user_id = p_user_id
    AND active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  ORDER BY updated_at DESC, created_at DESC
  LIMIT 1;
  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  -- 3. Assinatura Stripe
  SELECT plan::text INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_plan IS NULL OR v_plan NOT IN ('free','pro','premium','max') THEN
    RETURN 'free';
  END IF;
  RETURN v_plan;
END;
$function$;

-- =========================================================
-- 2) Tabela user_plan_addons
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_plan_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addon_key text NOT NULL,
  stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  stripe_subscription_item_id text NULL,
  stripe_price_id text NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz NULL,
  current_period_end timestamptz NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_upa_sub_item_uniq
  ON public.user_plan_addons(stripe_subscription_item_id)
  WHERE stripe_subscription_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upa_user ON public.user_plan_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_upa_addon_key ON public.user_plan_addons(addon_key);
CREATE INDEX IF NOT EXISTS idx_upa_status ON public.user_plan_addons(status);
CREATE INDEX IF NOT EXISTS idx_upa_sub ON public.user_plan_addons(stripe_subscription_id);

GRANT SELECT ON public.user_plan_addons TO authenticated;
GRANT ALL ON public.user_plan_addons TO service_role;

ALTER TABLE public.user_plan_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own addons" ON public.user_plan_addons;
CREATE POLICY "Users read own addons"
  ON public.user_plan_addons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_global_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_upa_updated_at ON public.user_plan_addons;
CREATE TRIGGER trg_upa_updated_at
  BEFORE UPDATE ON public.user_plan_addons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 3) Helper: quantidade ativa de slots extras
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_active_extra_entity_slots(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(quantity), 0)::int
  FROM public.user_plan_addons
  WHERE user_id = p_user_id
    AND addon_key = 'extra_entity_slot'
    AND status IN ('active', 'trialing');
$function$;

-- =========================================================
-- 4) can_create_financial_entity considerando add-ons
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_create_financial_entity(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limits jsonb;
  v_max jsonb;
  v_key text;
  v_current_type integer;
  v_max_int integer;
  v_extra_slots integer;
  v_used_cpf integer;
  v_used_cnpj integer;
  v_base_cpf integer;
  v_base_cnpj integer;
  v_used_extras integer;
BEGIN
  IF p_type NOT IN ('cpf','cnpj') THEN RETURN false; END IF;
  v_key := CASE p_type WHEN 'cpf' THEN 'max_cpf_entities' ELSE 'max_cnpj_entities' END;
  v_limits := public.get_user_plan_limits(p_user_id);
  v_max := v_limits -> v_key;

  -- Limite ilimitado
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;

  v_max_int := (v_max)::text::integer;
  v_current_type := public.count_user_entities_by_type(p_user_id, p_type);

  -- Ainda tem limite base para esse tipo
  IF v_current_type < v_max_int THEN RETURN true; END IF;

  -- Base atingida; verificar slots extras disponíveis
  v_extra_slots := public.get_active_extra_entity_slots(p_user_id);
  IF v_extra_slots <= 0 THEN RETURN false; END IF;

  v_used_cpf := public.count_user_entities_by_type(p_user_id, 'cpf');
  v_used_cnpj := public.count_user_entities_by_type(p_user_id, 'cnpj');
  v_base_cpf := COALESCE(((v_limits -> 'max_cpf_entities'))::text::integer, 0);
  v_base_cnpj := COALESCE(((v_limits -> 'max_cnpj_entities'))::text::integer, 0);

  v_used_extras := GREATEST(0, v_used_cpf - v_base_cpf) + GREATEST(0, v_used_cnpj - v_base_cnpj);

  RETURN v_used_extras < v_extra_slots;
END;
$function$;

-- =========================================================
-- 5) get_entity_limits_summary
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_entity_limits_summary(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  v_limits jsonb;
  v_used_cpf integer;
  v_used_cnpj integer;
  v_base_cpf_json jsonb;
  v_base_cnpj_json jsonb;
  v_base_cpf integer;
  v_base_cnpj integer;
  v_extras integer;
  v_used_extras integer;
  v_is_admin boolean;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;

  v_plan := public.get_user_plan(p_user_id);
  v_limits := public.get_plan_limits(v_plan);
  v_used_cpf := public.count_user_entities_by_type(p_user_id, 'cpf');
  v_used_cnpj := public.count_user_entities_by_type(p_user_id, 'cnpj');
  v_base_cpf_json := v_limits -> 'max_cpf_entities';
  v_base_cnpj_json := v_limits -> 'max_cnpj_entities';
  v_base_cpf := COALESCE((v_base_cpf_json)::text::integer, 0);
  v_base_cnpj := COALESCE((v_base_cnpj_json)::text::integer, 0);
  v_extras := public.get_active_extra_entity_slots(p_user_id);
  v_used_extras := GREATEST(0, v_used_cpf - v_base_cpf) + GREATEST(0, v_used_cnpj - v_base_cnpj);
  v_is_admin := public.is_global_admin(p_user_id);

  RETURN jsonb_build_object(
    'plan', v_plan,
    'is_admin', v_is_admin,
    'cpf_used', v_used_cpf,
    'cpf_limit', v_base_cpf_json,
    'cnpj_used', v_used_cnpj,
    'cnpj_limit', v_base_cnpj_json,
    'extra_entity_slots', v_extras,
    'extra_entity_slots_used', v_used_extras,
    'extra_entity_slots_available', GREATEST(0, v_extras - v_used_extras),
    'can_create_cpf', public.can_create_financial_entity(p_user_id, 'cpf'),
    'can_create_cnpj', public.can_create_financial_entity(p_user_id, 'cnpj'),
    'can_buy_extra_entity_addon', (v_plan IN ('pro','premium','max') AND NOT v_is_admin)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_entity_limits_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_extra_entity_slots(uuid) TO authenticated;
