
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  fatura_mes date not null,
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, fatura_mes)
);

alter table public.invoices enable row level security;

create policy inv_select_own on public.invoices for select using (auth.uid() = user_id);
create policy inv_insert_own on public.invoices for insert with check (auth.uid() = user_id);
create policy inv_update_own on public.invoices for update using (auth.uid() = user_id);
create policy inv_delete_own on public.invoices for delete using (auth.uid() = user_id);

create trigger trg_invoices_updated_at before update on public.invoices
for each row execute function public.touch_updated_at();

-- Manual trigger for scheduled entries (scoped to current user)
create or replace function public.run_my_scheduled_entries()
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  for re in select * from public.recurring_expenses where ativo and auto_debit and user_id = uid loop
    if re.dia <= day_int then
      desc_fixo := '[Fixo] ' || re.descricao || ' ' || yyyymm;
      if not exists (
        select 1 from public.transactions
        where user_id = uid and tipo = 'debito' and descricao = desc_fixo
      ) then
        insert into public.transactions(user_id, tipo, descricao, categoria, valor_total, data_compra, parcelas)
        values (uid, 'debito', desc_fixo, re.categoria, re.valor,
                make_date(extract(year from d)::int, extract(month from d)::int, re.dia), 1);
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.run_my_scheduled_entries() from public;
grant execute on function public.run_my_scheduled_entries() to authenticated;
