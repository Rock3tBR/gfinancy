-- FIX (2026-07-13): a tela "Gastos fixos" (/transacoes, aba Gastos fixos)
-- sempre esteve quebrada: o front-end filtra e grava em
-- public.recurring_expenses usando a coluna `entity_id` (para separar
-- CPF/CNPJ, ver src/hooks/use-financial-entity.tsx), mas essa coluna nunca
-- existia na tabela — só foi adicionada a `cards`, `transactions`,
-- `installments`, `invoices` e `categories` na migration
-- 20260702175645_036a5c37-f527-4ac6-af25-827f1a30bdde.sql, ficando
-- `recurring_expenses` de fora sem querer.
--
-- Sem essa coluna, toda leitura (`.eq("entity_id", ...)`) e toda
-- gravação retornavam erro "column recurring_expenses.entity_id does not
-- exist" — o front-end engolia o erro da leitura e mostrava a tela vazia
-- (0 gastos fixos), e a gravação falhava silenciosamente porque o form
-- tenta 3 variantes de payload em sequência (ver buildFixedExpensePayloads
-- em src/routes/_authenticated/transacoes.tsx) e todas incluíam
-- `entity_id`, então todas falhavam do mesmo jeito.

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id);

-- Backfill: linhas antigas (criadas antes de existir multi-entidade) ficam
-- associadas à primeira entidade do próprio usuário, para não sumirem.
UPDATE public.recurring_expenses re
SET entity_id = fe.id
FROM (
  SELECT DISTINCT ON (user_id) user_id, id
  FROM public.financial_entities
  ORDER BY user_id, created_at ASC
) fe
WHERE re.entity_id IS NULL
  AND re.user_id = fe.user_id;

-- Propaga entity_id para as transações geradas automaticamente a partir de
-- gastos fixos (antes essas transações nasciam sem entity_id e ficavam
-- invisíveis nas telas que filtram por entidade). Mesma lógica de antes,
-- só passando re.entity_id adiante e incluindo entity_id no filtro de
-- "já existe" para não bloquear o mesmo texto em entidades diferentes.
CREATE OR REPLACE FUNCTION public.apply_scheduled_entries()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := current_date;
  yyyymm text := to_char(d, 'MM/YYYY');
  ps record;
  re record;
  desc_pag text;
  desc_vale text;
  desc_fixo text;
begin
  for ps in select * from public.payment_schedule where ativo loop
    if ps.dia_pagamento = extract(day from d)::int then
      desc_pag := '[Auto] Pagamento ' || yyyymm;
      if not exists (
        select 1 from public.transactions
        where user_id = ps.user_id and tipo = 'entrada' and descricao = desc_pag
      ) then
        insert into public.transactions(user_id, tipo, descricao, valor_total, data_compra, parcelas)
        values (ps.user_id, 'entrada', desc_pag, ps.valor_pagamento, d, 1);
      end if;
    end if;
    if ps.recebe_vale and ps.dia_vale is not null and ps.dia_vale = extract(day from d)::int then
      desc_vale := '[Auto] Vale ' || yyyymm;
      if not exists (
        select 1 from public.transactions
        where user_id = ps.user_id and tipo = 'entrada' and descricao = desc_vale
      ) then
        insert into public.transactions(user_id, tipo, descricao, valor_total, data_compra, parcelas)
        values (ps.user_id, 'entrada', desc_vale, coalesce(ps.valor_vale,0), d, 1);
      end if;
    end if;
  end loop;

  for re in select * from public.recurring_expenses where ativo loop
    if re.dia = extract(day from d)::int then
      desc_fixo := '[Fixo] ' || re.descricao || ' ' || yyyymm;
      if re.card_id is not null then
        if not exists (
          select 1 from public.transactions
          where user_id = re.user_id and tipo = 'credito' and descricao = desc_fixo
            and entity_id is not distinct from re.entity_id
        ) then
          insert into public.transactions(user_id, entity_id, tipo, descricao, categoria, valor_total, data_compra, parcelas, card_id)
          values (re.user_id, re.entity_id, 'credito', desc_fixo, re.categoria, re.valor, d, 1, re.card_id);
        end if;
      elsif re.auto_debit then
        if not exists (
          select 1 from public.transactions
          where user_id = re.user_id and tipo = 'debito' and descricao = desc_fixo
            and entity_id is not distinct from re.entity_id
        ) then
          insert into public.transactions(user_id, entity_id, tipo, descricao, categoria, valor_total, data_compra, parcelas)
          values (re.user_id, re.entity_id, 'debito', desc_fixo, re.categoria, re.valor, d, 1);
        end if;
      end if;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_my_scheduled_entries()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := current_date;
  yyyymm text := to_char(d, 'MM/YYYY');
  uid uuid := auth.uid();
  ps record;
  re record;
  desc_pag text;
  desc_vale text;
  desc_fixo text;
  day_int int := extract(day from d)::int;
  target_date date;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for ps in select * from public.payment_schedule where ativo and user_id = uid loop
    if ps.dia_pagamento <= day_int then
      desc_pag := '[Auto] Pagamento ' || yyyymm;
      if not exists (
        select 1 from public.transactions
        where user_id = uid and tipo = 'entrada' and descricao = desc_pag
      ) then
        insert into public.transactions(user_id, tipo, descricao, valor_total, data_compra, parcelas)
        values (uid, 'entrada', desc_pag, ps.valor_pagamento,
                make_date(extract(year from d)::int, extract(month from d)::int, ps.dia_pagamento), 1);
      end if;
    end if;
    if ps.recebe_vale and ps.dia_vale is not null and ps.dia_vale <= day_int then
      desc_vale := '[Auto] Vale ' || yyyymm;
      if not exists (
        select 1 from public.transactions
        where user_id = uid and tipo = 'entrada' and descricao = desc_vale
      ) then
        insert into public.transactions(user_id, tipo, descricao, valor_total, data_compra, parcelas)
        values (uid, 'entrada', desc_vale, coalesce(ps.valor_vale,0),
                make_date(extract(year from d)::int, extract(month from d)::int, ps.dia_vale), 1);
      end if;
    end if;
  end loop;

  for re in select * from public.recurring_expenses where ativo and user_id = uid loop
    if re.dia <= day_int then
      desc_fixo := '[Fixo] ' || re.descricao || ' ' || yyyymm;
      target_date := make_date(extract(year from d)::int, extract(month from d)::int, re.dia);
      if re.card_id is not null then
        if not exists (
          select 1 from public.transactions
          where user_id = uid and tipo = 'credito' and descricao = desc_fixo
            and entity_id is not distinct from re.entity_id
        ) then
          insert into public.transactions(user_id, entity_id, tipo, descricao, categoria, valor_total, data_compra, parcelas, card_id)
          values (uid, re.entity_id, 'credito', desc_fixo, re.categoria, re.valor, target_date, 1, re.card_id);
        end if;
      elsif re.auto_debit then
        if not exists (
          select 1 from public.transactions
          where user_id = uid and tipo = 'debito' and descricao = desc_fixo
            and entity_id is not distinct from re.entity_id
        ) then
          insert into public.transactions(user_id, entity_id, tipo, descricao, categoria, valor_total, data_compra, parcelas)
          values (uid, re.entity_id, 'debito', desc_fixo, re.categoria, re.valor, target_date, 1);
        end if;
      end if;
    end if;
  end loop;
end;
$function$;
