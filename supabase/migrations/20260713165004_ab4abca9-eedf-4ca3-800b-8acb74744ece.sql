
-- 1) Fix create_financial_entity to read JSONB from get_entity_limits_summary
CREATE OR REPLACE FUNCTION public.create_financial_entity(
  entity_type text,
  entity_document text,
  entity_nickname text,
  entity_trade_name text DEFAULT NULL::text,
  entity_legal_name text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid;
  new_entity_id uuid;
  clean_document text;
  limits_summary jsonb;
  can_create_cpf_value boolean;
  can_create_cnpj_value boolean;
  has_any_entity boolean;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  entity_type := lower(trim(entity_type));
  clean_document := regexp_replace(coalesce(entity_document, ''), '\D', '', 'g');

  if entity_type not in ('cpf', 'cnpj') then
    raise exception 'Tipo de entidade inválido.';
  end if;

  if trim(coalesce(entity_nickname, '')) = '' then
    raise exception 'Informe o apelido da entidade.';
  end if;

  if entity_type = 'cpf' and length(clean_document) <> 11 then
    raise exception 'CPF inválido. Informe 11 dígitos.';
  end if;

  if entity_type = 'cnpj' and length(clean_document) <> 14 then
    raise exception 'CNPJ inválido. Informe 14 dígitos.';
  end if;

  if entity_type = 'cnpj' and trim(coalesce(entity_trade_name, '')) = '' then
    raise exception 'Informe o nome fantasia.';
  end if;

  if entity_type = 'cnpj' and trim(coalesce(entity_legal_name, '')) = '' then
    raise exception 'Informe a razão social.';
  end if;

  limits_summary := public.get_entity_limits_summary(current_user_id);
  can_create_cpf_value := coalesce((limits_summary ->> 'can_create_cpf')::boolean, false);
  can_create_cnpj_value := coalesce((limits_summary ->> 'can_create_cnpj')::boolean, false);

  if entity_type = 'cpf' and can_create_cpf_value = false then
    raise exception 'Seu plano atual não permite criar mais CPFs.';
  end if;

  if entity_type = 'cnpj' and can_create_cnpj_value = false then
    raise exception 'Seu plano atual não permite criar mais CNPJs.';
  end if;

  select exists(
    select 1 from public.financial_entities where owner_user_id = current_user_id
  ) into has_any_entity;

  insert into public.financial_entities (
    owner_user_id,
    type,
    name,
    nickname,
    document,
    legal_name,
    trade_name,
    is_default,
    active
  ) values (
    current_user_id,
    entity_type,
    coalesce(nullif(trim(entity_trade_name), ''), nullif(trim(entity_nickname), '')),
    trim(entity_nickname),
    clean_document,
    nullif(trim(coalesce(entity_legal_name, '')), ''),
    nullif(trim(coalesce(entity_trade_name, '')), ''),
    not has_any_entity,
    true
  )
  returning id into new_entity_id;

  return new_entity_id;
end;
$function$;

-- 2) Create gastos_fixos table
CREATE TABLE IF NOT EXISTS public.gastos_fixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  dia integer NOT NULL CHECK (dia >= 1 AND dia <= 31),
  valor numeric(12,2) NOT NULL,
  categoria text,
  forma_pagamento text NOT NULL DEFAULT 'conta' CHECK (forma_pagamento IN ('conta','cartao')),
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  auto_debit boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos_fixos TO authenticated;
GRANT ALL ON public.gastos_fixos TO service_role;

ALTER TABLE public.gastos_fixos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gf_select_own" ON public.gastos_fixos FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "gf_insert_own" ON public.gastos_fixos FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gf_update_own" ON public.gastos_fixos FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gf_delete_own" ON public.gastos_fixos FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS gastos_fixos_user_id_idx ON public.gastos_fixos(user_id);
CREATE INDEX IF NOT EXISTS gastos_fixos_entity_id_idx ON public.gastos_fixos(entity_id);

CREATE TRIGGER gastos_fixos_set_updated_at
  BEFORE UPDATE ON public.gastos_fixos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
