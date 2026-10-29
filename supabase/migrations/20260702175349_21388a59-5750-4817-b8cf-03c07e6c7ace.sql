
-- ============================================================
-- Plan system helper functions
-- ============================================================

-- 2. get_user_plan
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
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

-- 3. get_plan_limits
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_plan,'free'))
    WHEN 'pro' THEN jsonb_build_object(
      'max_cards', 5,
      'max_transactions_per_month', NULL,
      'max_members', 1,
      'max_cpf_entities', 1,
      'max_cnpj_entities', 0,
      'invoice_import', true,
      'invoice_import_text', true,
      'invoice_import_csv', true,
      'invoice_import_pdf', false,
      'invoice_import_xlsx', false,
      'invoice_analysis', true,
      'reports', true,
      'pdf_export', false,
      'csv_export', true,
      'full_dashboard', true,
      'editable_dashboard', true,
      'smart_categorize', true,
      'forecast', false,
      'budgets', true,
      'heatmap', true,
      'mind_map', false,
      'multi_user', false,
      'multi_entity', false,
      'member_permissions', false
    )
    WHEN 'premium' THEN jsonb_build_object(
      'max_cards', NULL,
      'max_transactions_per_month', NULL,
      'max_members', 1,
      'max_cpf_entities', 1,
      'max_cnpj_entities', 1,
      'invoice_import', true,
      'invoice_import_text', true,
      'invoice_import_csv', true,
      'invoice_import_pdf', true,
      'invoice_import_xlsx', true,
      'invoice_analysis', true,
      'reports', true,
      'pdf_export', true,
      'csv_export', true,
      'full_dashboard', true,
      'editable_dashboard', true,
      'smart_categorize', true,
      'forecast', true,
      'budgets', true,
      'heatmap', true,
      'mind_map', true,
      'multi_user', false,
      'multi_entity', true,
      'member_permissions', false
    )
    WHEN 'max' THEN jsonb_build_object(
      'max_cards', NULL,
      'max_transactions_per_month', NULL,
      'max_members', 4,
      'max_cpf_entities', 1,
      'max_cnpj_entities', 2,
      'invoice_import', true,
      'invoice_import_text', true,
      'invoice_import_csv', true,
      'invoice_import_pdf', true,
      'invoice_import_xlsx', true,
      'invoice_analysis', true,
      'reports', true,
      'pdf_export', true,
      'csv_export', true,
      'full_dashboard', true,
      'editable_dashboard', true,
      'smart_categorize', true,
      'forecast', true,
      'budgets', true,
      'heatmap', true,
      'mind_map', true,
      'multi_user', true,
      'multi_entity', true,
      'member_permissions', true
    )
    ELSE jsonb_build_object(
      'max_cards', 1,
      'max_transactions_per_month', 30,
      'max_members', 1,
      'max_cpf_entities', 1,
      'max_cnpj_entities', 0,
      'invoice_import', false,
      'invoice_import_text', false,
      'invoice_import_csv', false,
      'invoice_import_pdf', false,
      'invoice_import_xlsx', false,
      'invoice_analysis', false,
      'reports', false,
      'pdf_export', false,
      'csv_export', false,
      'full_dashboard', false,
      'editable_dashboard', false,
      'smart_categorize', false,
      'forecast', false,
      'budgets', false,
      'heatmap', false,
      'mind_map', false,
      'multi_user', false,
      'multi_entity', false,
      'member_permissions', false
    )
  END;
$$;

-- 4. get_user_plan_limits
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_plan_limits(public.get_user_plan(p_user_id));
$$;

-- 5. user_can_use_feature
CREATE OR REPLACE FUNCTION public.user_can_use_feature(p_user_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits jsonb;
  v_val jsonb;
BEGIN
  IF p_feature IS NULL THEN RETURN false; END IF;
  v_limits := public.get_user_plan_limits(p_user_id);
  v_val := v_limits -> p_feature;
  IF v_val IS NULL OR jsonb_typeof(v_val) <> 'boolean' THEN
    RETURN false;
  END IF;
  RETURN (v_val)::text::boolean;
END;
$$;

-- 6. user_has_reached_limit
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
  v_limits jsonb;
  v_val jsonb;
  v_num integer;
BEGIN
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

-- 7. count_user_cards
CREATE OR REPLACE FUNCTION public.count_user_cards(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.cards WHERE user_id = p_user_id;
$$;

-- 8. count_user_transactions_in_month
CREATE OR REPLACE FUNCTION public.count_user_transactions_in_month(
  p_user_id uuid,
  p_reference_date date DEFAULT current_date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.transactions
  WHERE user_id = p_user_id
    AND date_trunc('month', data_compra) = date_trunc('month', p_reference_date);
$$;

-- 9. count_user_entities_by_type (guarded — financial_entities may not exist yet)
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
  v_count integer := 0;
BEGIN
  IF p_type NOT IN ('cpf','cnpj') THEN RETURN 0; END IF;
  IF to_regclass('public.financial_entities') IS NULL THEN
    RETURN 0;
  END IF;
  EXECUTE 'SELECT count(*)::int FROM public.financial_entities WHERE owner_user_id = $1 AND type = $2'
    INTO v_count USING p_user_id, p_type;
  RETURN v_count;
END;
$$;

-- 10. count_owner_members (guarded)
CREATE OR REPLACE FUNCTION public.count_owner_members(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
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

-- 11. can_create_card
CREATE OR REPLACE FUNCTION public.can_create_card(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
BEGIN
  v_limits := public.get_user_plan_limits(p_user_id);
  v_max := v_limits -> 'max_cards';
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_user_cards(p_user_id);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- 12. can_create_transaction
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
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
BEGIN
  v_limits := public.get_user_plan_limits(p_user_id);
  v_max := v_limits -> 'max_transactions_per_month';
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_user_transactions_in_month(p_user_id, p_reference_date);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- 13. can_create_financial_entity
CREATE OR REPLACE FUNCTION public.can_create_financial_entity(
  p_user_id uuid,
  p_type text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
  v_key text;
BEGIN
  IF p_type NOT IN ('cpf','cnpj') THEN RETURN false; END IF;
  v_key := CASE p_type WHEN 'cpf' THEN 'max_cpf_entities' ELSE 'max_cnpj_entities' END;
  v_limits := public.get_user_plan_limits(p_user_id);
  v_max := v_limits -> v_key;
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_user_entities_by_type(p_user_id, p_type);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- 14. can_add_entity_member
CREATE OR REPLACE FUNCTION public.can_add_entity_member(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits jsonb;
  v_max jsonb;
  v_current integer;
BEGIN
  v_limits := public.get_user_plan_limits(p_owner_user_id);
  v_max := v_limits -> 'max_members';
  IF v_max IS NULL OR jsonb_typeof(v_max) = 'null' THEN RETURN true; END IF;
  v_current := public.count_owner_members(p_owner_user_id);
  RETURN v_current < (v_max)::text::integer;
END;
$$;

-- 15. user_plan_summary — function form (safer than a view for auth.uid())
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
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  v_plan := public.get_user_plan(p_user_id);
  v_limits := public.get_plan_limits(v_plan);
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
    'can_add_member', public.can_add_entity_member(p_user_id)
  );
END;
$$;

-- Grants: allow authenticated users to call via RPC
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_limits(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_plan_limits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_use_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_reached_limit(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_cards(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_transactions_in_month(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_entities_by_type(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_owner_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_transaction(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_financial_entity(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_entity_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plan_summary(uuid) TO authenticated;
