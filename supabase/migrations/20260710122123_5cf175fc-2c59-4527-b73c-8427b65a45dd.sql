
-- 1) Add missing columns to categories (used by frontend, absent in schema)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS monthly_budget numeric(12,2),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) updated_at trigger
DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Backfill entity_id em categorias antigas (sem entidade) para a entidade default do dono
UPDATE public.categories c
SET entity_id = fe.id
FROM public.financial_entities fe
WHERE c.entity_id IS NULL
  AND fe.owner_user_id = c.user_id
  AND fe.is_default = true
  AND coalesce(fe.active, true) = true;
