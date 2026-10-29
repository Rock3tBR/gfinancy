
-- =========================================================
-- 1. TABLE global_admins
-- =========================================================
CREATE TABLE IF NOT EXISTS public.global_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS global_admins_user_id_idx ON public.global_admins(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_admins TO authenticated;
GRANT ALL ON public.global_admins TO service_role;
ALTER TABLE public.global_admins ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. TABLE plan_overrides
-- =========================================================
CREATE TABLE IF NOT EXISTS public.plan_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free','pro','premium','max')),
  active boolean NOT NULL DEFAULT true,
  reason text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS plan_overrides_user_id_idx ON public.plan_overrides(user_id);
CREATE INDEX IF NOT EXISTS plan_overrides_active_idx ON public.plan_overrides(active);
CREATE INDEX IF NOT EXISTS plan_overrides_validity_idx ON public.plan_overrides(starts_at, ends_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_overrides TO authenticated;
GRANT ALL ON public.plan_overrides TO service_role;
ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 3. TABLE admin_audit_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx ON public.admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_user_id_idx ON public.admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON public.admin_audit_logs(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 4. FUNCTION is_global_admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_global_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.global_admins
    WHERE user_id = check_user_id AND active = true
  );
$$;

-- =========================================================
-- 5. RLS POLICIES
-- =========================================================
DROP POLICY IF EXISTS "global_admins select" ON public.global_admins;
DROP POLICY IF EXISTS "global_admins insert" ON public.global_admins;
DROP POLICY IF EXISTS "global_admins update" ON public.global_admins;

CREATE POLICY "global_admins select" ON public.global_admins
  FOR SELECT TO authenticated USING (public.is_global_admin(auth.uid()));
CREATE POLICY "global_admins insert" ON public.global_admins
  FOR INSERT TO authenticated WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "global_admins update" ON public.global_admins
  FOR UPDATE TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "plan_overrides select" ON public.plan_overrides;
DROP POLICY IF EXISTS "plan_overrides insert" ON public.plan_overrides;
DROP POLICY IF EXISTS "plan_overrides update" ON public.plan_overrides;
DROP POLICY IF EXISTS "plan_overrides delete" ON public.plan_overrides;

CREATE POLICY "plan_overrides select" ON public.plan_overrides
  FOR SELECT TO authenticated USING (public.is_global_admin(auth.uid()));
CREATE POLICY "plan_overrides insert" ON public.plan_overrides
  FOR INSERT TO authenticated WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "plan_overrides update" ON public.plan_overrides
  FOR UPDATE TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "plan_overrides delete" ON public.plan_overrides
  FOR DELETE TO authenticated USING (public.is_global_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_audit_logs select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_audit_logs insert" ON public.admin_audit_logs;

CREATE POLICY "admin_audit_logs select" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.is_global_admin(auth.uid()));
CREATE POLICY "admin_audit_logs insert" ON public.admin_audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_global_admin(auth.uid()));

-- =========================================================
-- 6. FUNCTION get_user_manual_plan_override
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_manual_plan_override(target_user_id uuid)
RETURNS TABLE (
  plan text,
  reason text,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.plan, po.reason, po.starts_at, po.ends_at
  FROM public.plan_overrides po
  WHERE po.user_id = target_user_id
    AND po.active = true
    AND po.starts_at <= now()
    AND (po.ends_at IS NULL OR po.ends_at > now())
  ORDER BY po.updated_at DESC, po.created_at DESC
  LIMIT 1;
$$;

-- =========================================================
-- 7. UPDATE get_user_plan to consider manual override
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override text;
  v_plan text;
BEGIN
  -- 1. Check for valid manual override
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

  -- 2. Fall back to subscription plan
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

-- Extend get_user_plan_summary with override info
CREATE OR REPLACE FUNCTION public.get_user_plan_summary(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limits jsonb;
  v_override record;
  v_is_override boolean := false;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
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

-- =========================================================
-- 14. TRIGGER updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_overrides_set_updated_at ON public.plan_overrides;
CREATE TRIGGER plan_overrides_set_updated_at
  BEFORE UPDATE ON public.plan_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 8. RPC admin_list_users
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  current_plan text,
  is_manual_override boolean,
  manual_override_plan text,
  manual_override_reason text,
  manual_override_starts_at timestamptz,
  manual_override_ends_at timestamptz,
  manual_override_active boolean,
  entities_count bigint,
  cards_count bigint,
  transactions_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    public.get_user_plan(u.id) AS current_plan,
    (po.id IS NOT NULL
      AND po.active
      AND po.starts_at <= now()
      AND (po.ends_at IS NULL OR po.ends_at > now())) AS is_manual_override,
    po.plan AS manual_override_plan,
    po.reason AS manual_override_reason,
    po.starts_at AS manual_override_starts_at,
    po.ends_at AS manual_override_ends_at,
    COALESCE(po.active, false) AS manual_override_active,
    COALESCE((SELECT count(*) FROM public.financial_entities fe WHERE fe.owner_user_id = u.id), 0) AS entities_count,
    COALESCE((SELECT count(*) FROM public.cards c WHERE c.user_id = u.id), 0) AS cards_count,
    COALESCE((SELECT count(*) FROM public.transactions t WHERE t.user_id = u.id), 0) AS transactions_count
  FROM auth.users u
  LEFT JOIN public.plan_overrides po ON po.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- =========================================================
-- 9. RPC admin_dashboard_summary
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
RETURNS TABLE (
  total_users bigint,
  total_entities bigint,
  total_cards bigint,
  total_transactions bigint,
  active_manual_overrides bigint,
  users_free bigint,
  users_pro bigint,
  users_premium bigint,
  users_max bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  WITH user_plans AS (
    SELECT u.id, public.get_user_plan(u.id) AS plan FROM auth.users u
  )
  SELECT
    (SELECT count(*) FROM auth.users)::bigint,
    (SELECT count(*) FROM public.financial_entities)::bigint,
    (SELECT count(*) FROM public.cards)::bigint,
    (SELECT count(*) FROM public.transactions)::bigint,
    (SELECT count(*) FROM public.plan_overrides
      WHERE active = true AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now()))::bigint,
    (SELECT count(*) FROM user_plans WHERE plan = 'free')::bigint,
    (SELECT count(*) FROM user_plans WHERE plan = 'pro')::bigint,
    (SELECT count(*) FROM user_plans WHERE plan = 'premium')::bigint,
    (SELECT count(*) FROM user_plans WHERE plan = 'max')::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary() TO authenticated;

-- =========================================================
-- 10. RPC admin_upsert_plan_override
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_plan_override(
  target_user_id uuid,
  target_plan text,
  override_reason text,
  override_starts_at timestamptz DEFAULT now(),
  override_ends_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF target_plan NOT IN ('free','pro','premium','max') THEN
    RAISE EXCEPTION 'Plano inválido: %', target_plan;
  END IF;

  INSERT INTO public.plan_overrides (user_id, plan, active, reason, starts_at, ends_at, created_by, updated_at)
  VALUES (target_user_id, target_plan, true, override_reason, override_starts_at, override_ends_at, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        active = true,
        reason = EXCLUDED.reason,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        created_by = auth.uid(),
        updated_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, target_user_id, action, metadata)
  VALUES (auth.uid(), target_user_id, 'plan_override_upsert',
    jsonb_build_object(
      'plan', target_plan,
      'reason', override_reason,
      'starts_at', override_starts_at,
      'ends_at', override_ends_at
    ));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_plan_override(uuid, text, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_plan_override(uuid, text, text, timestamptz, timestamptz) TO authenticated;

-- =========================================================
-- 11. RPC admin_disable_plan_override
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_disable_plan_override(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  UPDATE public.plan_overrides
    SET active = false, updated_at = now()
  WHERE user_id = target_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, target_user_id, action, metadata)
  VALUES (auth.uid(), target_user_id, 'plan_override_disabled',
    jsonb_build_object('disabled_at', now()));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_disable_plan_override(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_disable_plan_override(uuid) TO authenticated;

-- =========================================================
-- 12. RPC admin_list_plan_overrides
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_plan_overrides()
RETURNS TABLE (
  override_id uuid,
  user_id uuid,
  email text,
  plan text,
  active boolean,
  reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_currently_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    po.id,
    po.user_id,
    u.email::text,
    po.plan,
    po.active,
    po.reason,
    po.starts_at,
    po.ends_at,
    po.created_by,
    po.created_at,
    po.updated_at,
    (po.active AND po.starts_at <= now() AND (po.ends_at IS NULL OR po.ends_at > now())) AS is_currently_valid
  FROM public.plan_overrides po
  LEFT JOIN auth.users u ON u.id = po.user_id
  ORDER BY po.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_plan_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_plan_overrides() TO authenticated;

-- =========================================================
-- 13. RPC admin_list_audit_logs
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(limit_count integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  admin_user_id uuid,
  admin_email text,
  target_user_id uuid,
  target_email text,
  action text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.admin_user_id,
    au.email::text,
    l.target_user_id,
    tu.email::text,
    l.action,
    l.metadata,
    l.created_at
  FROM public.admin_audit_logs l
  LEFT JOIN auth.users au ON au.id = l.admin_user_id
  LEFT JOIN auth.users tu ON tu.id = l.target_user_id
  ORDER BY l.created_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit_logs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(integer) TO authenticated;

-- =========================================================
-- 15. FIRST ADMIN MASTER
-- =========================================================
INSERT INTO public.global_admins (user_id, active)
SELECT id, true
FROM auth.users
WHERE email = 'enriquealves_72@hotmail.com'
ON CONFLICT (user_id) DO UPDATE SET active = true;

-- Exemplo para adicionar novos admins:
-- INSERT INTO public.global_admins (user_id, active)
-- SELECT id, true FROM auth.users WHERE email = 'SEU_EMAIL_AQUI'
-- ON CONFLICT (user_id) DO UPDATE SET active = true;
