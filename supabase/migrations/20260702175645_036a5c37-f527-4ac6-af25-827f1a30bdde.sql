
-- 1. financial_entities
CREATE TABLE IF NOT EXISTS public.financial_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('cpf','cnpj')),
  name text NOT NULL,
  document text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entities TO authenticated;
GRANT ALL ON public.financial_entities TO service_role;

ALTER TABLE public.financial_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fe_select_owner" ON public.financial_entities
  FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "fe_insert_owner" ON public.financial_entities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "fe_update_owner" ON public.financial_entities
  FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "fe_delete_owner" ON public.financial_entities
  FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

CREATE TRIGGER financial_entities_touch_updated_at
  BEFORE UPDATE ON public.financial_entities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. entity_members
CREATE TABLE IF NOT EXISTS public.entity_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.financial_entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_members TO authenticated;
GRANT ALL ON public.entity_members TO service_role;

ALTER TABLE public.entity_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helper: is a given user the owner of a given entity?
-- Avoids recursive policy references and keeps checks fast.
CREATE OR REPLACE FUNCTION public.is_entity_owner(_entity_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.financial_entities
    WHERE id = _entity_id AND owner_user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_entity_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_entity_owner(uuid, uuid) TO authenticated;

CREATE POLICY "em_select_self" ON public.entity_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "em_select_owner" ON public.entity_members
  FOR SELECT TO authenticated USING (public.is_entity_owner(entity_id, auth.uid()));
CREATE POLICY "em_insert_owner" ON public.entity_members
  FOR INSERT TO authenticated WITH CHECK (public.is_entity_owner(entity_id, auth.uid()));
CREATE POLICY "em_update_owner" ON public.entity_members
  FOR UPDATE TO authenticated USING (public.is_entity_owner(entity_id, auth.uid())) WITH CHECK (public.is_entity_owner(entity_id, auth.uid()));
CREATE POLICY "em_delete_owner" ON public.entity_members
  FOR DELETE TO authenticated USING (public.is_entity_owner(entity_id, auth.uid()));

-- 3. Add entity_id columns (nullable)
ALTER TABLE public.cards        ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id);
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id);
ALTER TABLE public.invoices     ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id);
ALTER TABLE public.categories   ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id);

-- 4. Create default "Pessoal" entity for existing users with data
INSERT INTO public.financial_entities (owner_user_id, type, name, is_default)
SELECT DISTINCT u.user_id, 'cpf', 'Pessoal', true
FROM (
  SELECT user_id FROM public.cards WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.transactions WHERE user_id IS NOT NULL
) u
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_entities fe
  WHERE fe.owner_user_id = u.user_id AND fe.is_default = true
);

-- 5. Ensure owner membership for every entity
INSERT INTO public.entity_members (entity_id, user_id, role)
SELECT fe.id, fe.owner_user_id, 'owner'
FROM public.financial_entities fe
WHERE NOT EXISTS (
  SELECT 1 FROM public.entity_members em
  WHERE em.entity_id = fe.id AND em.user_id = fe.owner_user_id
);

-- 6. Backfill entity_id on legacy rows using the user's default entity
WITH defaults AS (
  SELECT owner_user_id, id AS entity_id
  FROM public.financial_entities
  WHERE is_default = true
)
UPDATE public.cards c SET entity_id = d.entity_id
FROM defaults d WHERE c.entity_id IS NULL AND c.user_id = d.owner_user_id;

WITH defaults AS (
  SELECT owner_user_id, id AS entity_id
  FROM public.financial_entities
  WHERE is_default = true
)
UPDATE public.transactions t SET entity_id = d.entity_id
FROM defaults d WHERE t.entity_id IS NULL AND t.user_id = d.owner_user_id;

WITH defaults AS (
  SELECT owner_user_id, id AS entity_id
  FROM public.financial_entities
  WHERE is_default = true
)
UPDATE public.installments i SET entity_id = d.entity_id
FROM defaults d WHERE i.entity_id IS NULL AND i.user_id = d.owner_user_id;

WITH defaults AS (
  SELECT owner_user_id, id AS entity_id
  FROM public.financial_entities
  WHERE is_default = true
)
UPDATE public.invoices v SET entity_id = d.entity_id
FROM defaults d WHERE v.entity_id IS NULL AND v.user_id = d.owner_user_id;

WITH defaults AS (
  SELECT owner_user_id, id AS entity_id
  FROM public.financial_entities
  WHERE is_default = true
)
UPDATE public.categories k SET entity_id = d.entity_id
FROM defaults d WHERE k.entity_id IS NULL AND k.user_id = d.owner_user_id;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS financial_entities_owner_user_id_idx ON public.financial_entities(owner_user_id);
CREATE INDEX IF NOT EXISTS financial_entities_owner_type_idx ON public.financial_entities(owner_user_id, type);
CREATE INDEX IF NOT EXISTS financial_entities_owner_default_idx ON public.financial_entities(owner_user_id, is_default);
CREATE INDEX IF NOT EXISTS entity_members_entity_id_idx ON public.entity_members(entity_id);
CREATE INDEX IF NOT EXISTS entity_members_user_id_idx ON public.entity_members(user_id);

CREATE INDEX IF NOT EXISTS cards_entity_id_idx        ON public.cards(entity_id);
CREATE INDEX IF NOT EXISTS transactions_entity_id_idx ON public.transactions(entity_id);
CREATE INDEX IF NOT EXISTS installments_entity_id_idx ON public.installments(entity_id);
CREATE INDEX IF NOT EXISTS invoices_entity_id_idx     ON public.invoices(entity_id);
CREATE INDEX IF NOT EXISTS categories_entity_id_idx   ON public.categories(entity_id);
