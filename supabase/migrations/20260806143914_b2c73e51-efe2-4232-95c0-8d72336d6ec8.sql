DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    'archive_financial_entity',
    'can_create_category',
    'count_user_categories',
    'create_financial_entity',
    'create_profile_for_new_user',
    'get_active_extra_entity_slots',
    'get_entity_limits_summary',
    'get_user_manual_plan_override',
    'is_global_admin',
    'list_my_financial_entities',
    'set_default_financial_entity',
    'update_financial_entity'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    IF r.proname <> 'create_profile_for_new_user' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;