
REVOKE EXECUTE ON FUNCTION public.get_user_plan(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_plan_limits(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_plan_limits(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_use_feature(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_reached_limit(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_user_cards(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_user_transactions_in_month(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_user_entities_by_type(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_owner_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_create_card(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_create_transaction(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_create_financial_entity(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_add_entity_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_plan_summary(uuid) FROM PUBLIC;
