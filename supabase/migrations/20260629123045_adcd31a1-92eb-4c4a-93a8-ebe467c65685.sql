
-- Plans enum
DO $$ BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free','pro','premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own_subscription_select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "own_subscription_insert" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "own_subscription_update" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "own_subscription_delete" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER subs_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create free subscription on signup
CREATE OR REPLACE FUNCTION public.create_free_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions(user_id, plan) VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sub ON auth.users;
CREATE TRIGGER on_auth_user_created_sub
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_free_subscription();

-- Backfill existing users
INSERT INTO public.subscriptions(user_id, plan)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Invoices: add valor_pago and status
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS valor_pago numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status text;

-- Invoice analyses
CREATE TABLE IF NOT EXISTS public.invoice_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  fatura_mes date,
  nome text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_analyses TO authenticated;
GRANT ALL ON public.invoice_analyses TO service_role;
ALTER TABLE public.invoice_analyses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own_inv_an_all" ON public.invoice_analyses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TRIGGER inv_an_touch BEFORE UPDATE ON public.invoice_analyses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.invoice_analysis_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.invoice_analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao_original text NOT NULL,
  valor numeric(12,2) NOT NULL,
  categoria text,
  finalidade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_analysis_items TO authenticated;
GRANT ALL ON public.invoice_analysis_items TO service_role;
ALTER TABLE public.invoice_analysis_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own_inv_an_items_all" ON public.invoice_analysis_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TRIGGER inv_an_items_touch BEFORE UPDATE ON public.invoice_analysis_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
