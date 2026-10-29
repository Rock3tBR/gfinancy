
REVOKE EXECUTE ON FUNCTION public.apply_scheduled_entries() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.regenerate_installments_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_installments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_my_scheduled_entries() FROM PUBLIC, anon;
