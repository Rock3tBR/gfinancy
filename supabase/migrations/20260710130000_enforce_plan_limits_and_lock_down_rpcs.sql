
-- =========================================================================
-- SECURITY AUDIT FIX (2026-07-10)
--
-- This migration closes several gaps found during a security audit:
--
--   (a) INSERT RLS policies on cards / transactions / financial_entities /
--       entity_members had no WITH CHECK tying the insert to the plan
--       limit functions (can_create_card / can_create_transaction /
--       can_create_financial_entity / can_add_entity_member). Any
--       authenticated client could insert past their plan's limits by
--       calling the REST API directly (the UI enforced limits, but the
--       database did not).
--
--   (b) Plan/limit RPCs that take a `p_user_id` parameter (get_user_plan,
--       get_user_plan_limits, count_user_cards,
--       count_user_transactions_in_month, count_user_entities_by_type,
--       count_owner_members, can_create_card, can_create_transaction,
--       can_create_financial_entity, can_add_entity_member,
--       user_can_use_feature, user_has_reached_limit) are SECURITY DEFINER
--       and GRANTed to `authenticated`, but did not verify that the caller
--       was asking about themselves. Any authenticated user could pass an
--       arbitrary `p_user_id` and read another user's plan/usage data.
--       These are now hardened to force p_user_id := auth.uid() unless the
--       caller is a global admin (public.is_global_admin).
--
--   (c) subscriptions.plan (and status / stripe_customer_id / other
--       billing-sensitive columns) could be modified directly by an
--       authenticated client because the "own_subscription_update" RLS
--       policy only checks `auth.uid() = user_id`, with no column-level
--       restriction. A user could upgrade their own plan for free via a
--       direct PostgREST UPDATE. A BEFORE UPDATE trigger now blocks changes
--       to these columns unless the write comes from the service role
--       (server-side, e.g. the Stripe webhook handler which uses
--       `supabaseAdmin` / SUPABASE_SERVICE_ROLE_KEY and therefore runs as
--       the `service_role` Postgres role, bypassing RLS entirely and also
--       exempted here).
--
-- All statements below are written defensively (DROP POLICY IF EXISTS /
-- CREATE OR REPLACE FUNCTION / information_schema guards) so this migration
-- can be re-run safely and does not depend on assumptions about ordering.
-- =========================================================================


-- -------------------------------------------------------------------------
-- (a) WITH CHECK on INSERT policies: cards, transactions, financial_entities,
--     entity_members
-- -------------------------------------------------------------------------

-- cards: base policy was
--   create policy "cards_insert_own" on public.cards for insert with check (auth.uid() = user_id);
-- Add the plan-limit check on top of the ownership check.
DROP POLICY IF EXISTS "cards_insert_own" ON public.cards;
CREATE POLICY "cards_insert_own" ON public.cards
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_create_card(auth.uid())
  );

-- transactions: base policy was
--   create policy "tx_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
-- can_create_transaction(p_user_id, p_reference_date) defaults p_reference_date
-- to current_date; pass NEW.data_compra so the correct month is checked.
DROP POLICY IF EXISTS "tx_insert_own" ON public.transactions;
CREATE POLICY "tx_insert_own" ON public.transactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_create_transaction(auth.uid(), data_compra)
  );

-- financial_entities: base policy was
--   CREATE POLICY "fe_insert_owner" ON public.financial_entities
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
-- can_create_financial_entity(p_user_id, p_type) — type is either 'cpf' or 'cnpj'.
DROP POLICY IF EXISTS "fe_insert_owner" ON public.financial_entities;
CREATE POLICY "fe_insert_owner" ON public.financial_entities
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND public.can_create_financial_entity(auth.uid(), type)
  );

-- entity_members: base policy was
--   CREATE POLICY "em_insert_owner" ON public.entity_members
--     FOR INSERT TO authenticated WITH CHECK (public.is_entity_owner(entity_id, auth.uid()));
-- can_add_entity_member(p_owner_user_id) expects the *owner's* user id, i.e.
-- the caller (who must already be the entity owner per is_entity_owner).
DROP POLICY IF EXISTS "em_insert_owner" ON public.entity_members;
CREATE POLICY "em_insert_owner" ON public.entity_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_entity_owner(entity_id, auth.uid())
    AND public.can_add_entity_member(auth.uid())
  );


-- -------------------------------------------------------------------------
-- (b) Harden RPCs taking p_user_id: force it to auth.uid() unless caller is
--     a global admin. CREATE OR REPLACE with the exact existing signatures
--     so nothing calling these functions breaks.
--
--     NOTE: get_user_plan(uuid) and can_create_financial_entity(uuid, text)
--     were already replaced by later migrations (20260706142024 and
--     20260710122123) to add Admin Master / add-on logic. We replace them
--     again here, preserving that later behavior and only adding the
--     ownership guard on top.
-- -------------------------------------------------------------------------

-- get_user_plan(p_user_id uuid) — latest version (20260706142024) already
-- special-cases Admin Master; we add the auth guard around that logic.
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_override text;
  v_plan text;
BEGIN
  -- SECURITY AUDIT FIX: only allow querying another user's plan if the
  -- caller is a global admin. Otherwise force the lookup to the caller.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

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
$$;

-- get_user_plan_limits(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  RETURN public.get_plan_limits(public.get_user_plan(p_user_id));
END;
$$;

-- count_user_cards(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.count_user_cards(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  SELECT count(*)::int INTO v_count FROM public.cards WHERE user_id = p_user_id;
  RETURN v_count;
END;
$$;

-- count_user_transactions_in_month(p_user_id uuid, p_reference_date date)
CREATE OR REPLACE FUNCTION public.count_user_transactions_in_month(
  p_user_id uuid,
  p_reference_date date DEFAULT current_date
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  SELECT count(*)::int INTO v_count FROM public.transactions
  WHERE user_id = p_user_id
    AND date_trunc('month', data_compra) = date_trunc('month', p_reference_date);
  RETURN v_count;
END;
$$;

-- count_user_entities_by_type(p_user_id uuid, p_type text)
CREATE OR REPLACE FUNCTION public.count_user_entities_by_type(
  p_user_id uuid,
  p_type text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count integer := 0;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  IF p_type NOT IN ('cpf','cnpj') THEN RETURN 0; END IF;
  IF to_regclass('public.financial_entities') IS NULL THEN
    RETURN 0;
  END IF;
  EXECUTE 'SELECT count(*)::int FROM public.financial_entities WHERE owner_user_id = $1 AND type = $2'
    INTO v_count USING p_user_id, p_type;
  RETURN v_count;
END;
$$;

-- count_owner_members(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.count_owner_members(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count integer := 0;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  IF to_regclass('public.financial_entities') IS NULL
     OR to_regclass('public.entity_members') IS NULL THEN
    RETURN 1;
  END IF;
  EXECUTE $q$
    SELECT count(DISTINCT em.user_id)::int
    FROM public.entity_members em
    JOIN public.financial_entities fe ON fe.id = em.entity_id
    WHERE fe.owner_user_id = $1
  $q$ INTO v_count USING p_user_id;
  IF v_count < 1 THEN v_count := 1; END IF;
  RETURN v_count;
END;
$$;

-- can_create_card(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.can_create_card(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  v_limits := public.get_user_plan_limits(p_user_id);
  v_max := v_limits -> 'max_cards';
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_user_cards(p_user_id);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- can_create_transaction(p_user_id uuid, p_reference_date date)
CREATE OR REPLACE FUNCTION public.can_create_transaction(
  p_user_id uuid,
  p_reference_date date DEFAULT current_date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  v_limits := public.get_user_plan_limits(p_user_id);
  v_max := v_limits -> 'max_transactions_per_month';
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_user_transactions_in_month(p_user_id, p_reference_date);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- can_create_financial_entity(p_user_id uuid, p_type text) — latest version
-- (20260706142024) already accounts for extra_entity_slot add-ons; we
-- preserve that logic and add the ownership guard around it.
CREATE OR REPLACE FUNCTION public.can_create_financial_entity(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
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
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

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
$$;

-- can_add_entity_member(p_owner_user_id uuid)
CREATE OR REPLACE FUNCTION public.can_add_entity_member(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_owner_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_owner_user_id := v_caller;
  END IF;

  v_limits := public.get_user_plan_limits(p_owner_user_id);
  v_max := v_limits -> 'max_members';
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_owner_members(p_owner_user_id);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- user_can_use_feature(p_user_id uuid, p_feature text)
CREATE OR REPLACE FUNCTION public.user_can_use_feature(p_user_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_limits jsonb;
  v_val jsonb;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  IF p_feature IS NULL THEN RETURN false; END IF;
  v_limits := public.get_user_plan_limits(p_user_id);
  v_val := v_limits -> p_feature;
  IF v_val IS NULL OR jsonb_typeof(v_val) <> 'boolean' THEN
    RETURN false;
  END IF;
  RETURN (v_val)::text::boolean;
END;
$$;

-- user_has_reached_limit(p_user_id uuid, p_limit_key text, p_current_value integer)
CREATE OR REPLACE FUNCTION public.user_has_reached_limit(
  p_user_id uuid,
  p_limit_key text,
  p_current_value integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_limits jsonb;
  v_val jsonb;
  v_num integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  IF p_limit_key IS NULL THEN RETURN true; END IF;
  v_limits := public.get_user_plan_limits(p_user_id);
  v_val := v_limits -> p_limit_key;
  IF v_val IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(v_val) = 'null' THEN RETURN false; END IF;
  IF jsonb_typeof(v_val) <> 'number' THEN RETURN true; END IF;
  v_num := (v_val)::text::integer;
  RETURN coalesce(p_current_value,0) >= v_num;
END;
$$;


-- -------------------------------------------------------------------------
-- (c) Lock down subscriptions.plan / status / stripe_customer_id from
--     direct client UPDATEs. Server-side writes (Stripe webhook handler)
--     use `supabaseAdmin`, a client built with SUPABASE_SERVICE_ROLE_KEY
--     (src/routes/api/public/payments/webhook.ts), which connects to
--     Postgres as the `service_role` role and therefore bypasses RLS
--     entirely. `current_setting('role', true)` reflects the actual
--     Postgres role for the current session, so checking it against
--     'service_role' is the correct way to exempt that legitimate path
--     without depending on RLS (which service_role bypasses anyway, but
--     a BEFORE UPDATE trigger fires regardless of RLS bypass, so it needs
--     its own guard).
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_subscription_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow the service role (server-side writes: Stripe webhook via
  -- supabaseAdmin / SUPABASE_SERVICE_ROLE_KEY) to bypass this check.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- SECURITY AUDIT FIX: block client-side tampering with billing-sensitive
  -- columns. These must only ever be changed by the Stripe webhook handler.
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Alteração de plano não permitida diretamente. Use o checkout/portal de pagamentos.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Alteração de status da assinatura não permitida diretamente.';
  END IF;

  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Alteração de stripe_customer_id não permitida diretamente.';
  END IF;

  -- stripe_subscription_id is also billing-sensitive and only ever written
  -- by the webhook alongside plan/status; protect it the same way. (Column
  -- added in migration 20260702143600, guaranteed to exist by this point.)
  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'Alteração de stripe_subscription_id não permitida diretamente.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_subscription_billing_columns ON public.subscriptions;
CREATE TRIGGER trg_protect_subscription_billing_columns
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscription_billing_columns();


-- -------------------------------------------------------------------------
-- (b, continued) A few more RPCs also take a target-user parameter and were
-- missed by the list above; harden them the same way for consistency.
-- -------------------------------------------------------------------------

-- get_active_extra_entity_slots(p_user_id uuid) — introduced in
-- 20260706142024, used internally by can_create_financial_entity.
CREATE OR REPLACE FUNCTION public.get_active_extra_entity_slots(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_total integer;
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  SELECT COALESCE(SUM(quantity), 0)::int INTO v_total
  FROM public.user_plan_addons
  WHERE user_id = p_user_id
    AND addon_key = 'extra_entity_slot'
    AND status IN ('active', 'trialing');
  RETURN v_total;
END;
$$;

-- get_user_plan_summary(p_user_id uuid DEFAULT auth.uid()) — already defaults
-- to auth.uid(), but nothing stopped a caller from explicitly passing
-- someone else's id. Add the same ownership guard.
CREATE OR REPLACE FUNCTION public.get_user_plan_summary(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_plan text;
  v_limits jsonb;
  v_override record;
  v_is_override boolean := false;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;

  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

  v_plan := public.get_user_plan(p_user_id);
  v_limits := public.get_plan_limits(v_plan);

  SELECT * INTO v_override FROM public.get_user_manual_plan_override(p_user_id);
  IF v_override.plan IS NOT NULL THEN
    v_is_override := true;
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'plan', v_plan,
    'limits', v_limits,
    'cards_count', public.count_user_cards(p_user_id),
    'transactions_this_month_count', public.count_user_transactions_in_month(p_user_id, current_date),
    'cpf_entities_count', public.count_user_entities_by_type(p_user_id, 'cpf'),
    'cnpj_entities_count', public.count_user_entities_by_type(p_user_id, 'cnpj'),
    'members_count', public.count_owner_members(p_user_id),
    'can_create_card', public.can_create_card(p_user_id),
    'can_create_transaction', public.can_create_transaction(p_user_id, current_date),
    'can_create_cpf_entity', public.can_create_financial_entity(p_user_id, 'cpf'),
    'can_create_cnpj_entity', public.can_create_financial_entity(p_user_id, 'cnpj'),
    'can_add_member', public.can_add_entity_member(p_user_id),
    'is_manual_override', v_is_override,
    'manual_override_plan', v_override.plan,
    'manual_override_reason', v_override.reason,
    'manual_override_starts_at', v_override.starts_at,
    'manual_override_ends_at', v_override.ends_at
  );
END;
$$;

-- get_entity_limits_summary(p_user_id uuid DEFAULT auth.uid()) — introduced
-- in 20260706142024, same defaulting gap as get_user_plan_summary.
CREATE OR REPLACE FUNCTION public.get_entity_limits_summary(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
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

  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    p_user_id := v_caller;
  END IF;

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
$$;

-- get_user_manual_plan_override(target_user_id uuid) — not explicitly
-- REVOKEd from PUBLIC in its defining migration (20260702192155), so by
-- default Postgres EXECUTE privileges leave it callable via PostgREST RPC
-- by any authenticated user with an arbitrary target_user_id. Harden it
-- the same way even though it uses a differently-named parameter.
CREATE OR REPLACE FUNCTION public.get_user_manual_plan_override(target_user_id uuid)
RETURNS TABLE (
  plan text,
  reason text,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- SECURITY AUDIT FIX: restrict to caller's own data unless global admin.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF target_user_id IS DISTINCT FROM v_caller AND NOT public.is_global_admin(v_caller) THEN
    target_user_id := v_caller;
  END IF;

  RETURN QUERY
  SELECT po.plan, po.reason, po.starts_at, po.ends_at
  FROM public.plan_overrides po
  WHERE po.user_id = target_user_id
    AND po.active = true
    AND po.starts_at <= now()
    AND (po.ends_at IS NULL OR po.ends_at > now())
  ORDER BY po.updated_at DESC, po.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_manual_plan_override(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_manual_plan_override(uuid) TO authenticated;
