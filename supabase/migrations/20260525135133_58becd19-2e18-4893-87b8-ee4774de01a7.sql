
-- 1) Add card_id to recurring_expenses
ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS card_id uuid NULL;

-- 2) Replace apply_scheduled_entries to handle card-based recurring expenses
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
        ) then
          insert into public.transactions(user_id, tipo, descricao, categoria, valor_total, data_compra, parcelas, card_id)
          values (re.user_id, 'credito', desc_fixo, re.categoria, re.valor, d, 1, re.card_id);
        end if;
      elsif re.auto_debit then
        if not exists (
          select 1 from public.transactions
          where user_id = re.user_id and tipo = 'debito' and descricao = desc_fixo
        ) then
          insert into public.transactions(user_id, tipo, descricao, categoria, valor_total, data_compra, parcelas)
          values (re.user_id, 'debito', desc_fixo, re.categoria, re.valor, d, 1);
        end if;
      end if;
    end if;
  end loop;
end;
$function$;

-- 3) Replace run_my_scheduled_entries similarly (catch-up for the current month)
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
        ) then
          insert into public.transactions(user_id, tipo, descricao, categoria, valor_total, data_compra, parcelas, card_id)
          values (uid, 'credito', desc_fixo, re.categoria, re.valor, target_date, 1, re.card_id);
        end if;
      elsif re.auto_debit then
        if not exists (
          select 1 from public.transactions
          where user_id = uid and tipo = 'debito' and descricao = desc_fixo
        ) then
          insert into public.transactions(user_id, tipo, descricao, categoria, valor_total, data_compra, parcelas)
          values (uid, 'debito', desc_fixo, re.categoria, re.valor, target_date, 1);
        end if;
      end if;
    end if;
  end loop;
end;
$function$;

-- 4) Trigger to regenerate installments on UPDATE of credito transactions
CREATE OR REPLACE FUNCTION public.regenerate_installments_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dia_fechamento int;
  v_first_fatura date;
  v_valor_parcela numeric(12,2);
  i int;
begin
  -- Only act if it's (or became) a credito transaction
  if new.tipo <> 'credito' then
    -- If type changed away from credito, clear installments
    delete from public.installments where transaction_id = new.id;
    return new;
  end if;

  -- If relevant fields haven't changed, do nothing
  if old.tipo = 'credito'
    and old.valor_total = new.valor_total
    and old.parcelas = new.parcelas
    and old.data_compra = new.data_compra
    and old.card_id is not distinct from new.card_id then
    return new;
  end if;

  if new.card_id is null then
    raise exception 'card_id obrigatório para crédito';
  end if;

  delete from public.installments where transaction_id = new.id;

  select dia_fechamento into v_dia_fechamento from public.cards where id = new.card_id;
  v_first_fatura := public.calc_first_fatura_mes(new.data_compra, v_dia_fechamento);
  v_valor_parcela := round(new.valor_total / new.parcelas, 2);

  for i in 1..new.parcelas loop
    insert into public.installments (
      transaction_id, user_id, card_id, numero_parcela, total_parcelas,
      valor, fatura_mes, data_compra
    ) values (
      new.id, new.user_id, new.card_id, i, new.parcelas,
      v_valor_parcela,
      (v_first_fatura + ((i - 1) || ' month')::interval)::date,
      new.data_compra
    );
  end loop;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_regenerate_installments ON public.transactions;
CREATE TRIGGER trg_regenerate_installments
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.regenerate_installments_on_update();

-- Ensure INSERT trigger exists for generate_installments
DROP TRIGGER IF EXISTS trg_generate_installments ON public.transactions;
CREATE TRIGGER trg_generate_installments
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.generate_installments();
