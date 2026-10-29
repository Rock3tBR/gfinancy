
-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  cor text not null default '#6366f1',
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy cat_select_own on public.categories for select using (auth.uid() = user_id);
create policy cat_insert_own on public.categories for insert with check (auth.uid() = user_id);
create policy cat_update_own on public.categories for update using (auth.uid() = user_id);
create policy cat_delete_own on public.categories for delete using (auth.uid() = user_id);

-- payment_schedule (1 por usuário)
create table public.payment_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  recebe_vale boolean not null default false,
  dia_pagamento integer not null check (dia_pagamento between 1 and 31),
  valor_pagamento numeric(12,2) not null default 0,
  dia_vale integer check (dia_vale between 1 and 31),
  valor_vale numeric(12,2) default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_schedule enable row level security;
create policy ps_select_own on public.payment_schedule for select using (auth.uid() = user_id);
create policy ps_insert_own on public.payment_schedule for insert with check (auth.uid() = user_id);
create policy ps_update_own on public.payment_schedule for update using (auth.uid() = user_id);
create policy ps_delete_own on public.payment_schedule for delete using (auth.uid() = user_id);

-- recurring_expenses
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  descricao text not null,
  dia integer not null check (dia between 1 and 31),
  valor numeric(12,2) not null,
  categoria text,
  auto_debit boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recurring_expenses enable row level security;
create policy re_select_own on public.recurring_expenses for select using (auth.uid() = user_id);
create policy re_insert_own on public.recurring_expenses for insert with check (auth.uid() = user_id);
create policy re_update_own on public.recurring_expenses for update using (auth.uid() = user_id);
create policy re_delete_own on public.recurring_expenses for delete using (auth.uid() = user_id);

-- Função que aplica pagamentos e gastos fixos do dia, idempotente
create or replace function public.apply_scheduled_entries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := current_date;
  yyyymm text := to_char(d, 'MM/YYYY');
  ps record;
  re record;
  desc_pag text;
  desc_vale text;
  desc_fixo text;
begin
  -- Pagamentos / vales
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

  -- Gastos fixos com auto_debit
  for re in select * from public.recurring_expenses where ativo and auto_debit loop
    if re.dia = extract(day from d)::int then
      desc_fixo := '[Fixo] ' || re.descricao || ' ' || yyyymm;
      if not exists (
        select 1 from public.transactions
        where user_id = re.user_id and tipo = 'debito' and descricao = desc_fixo
      ) then
        insert into public.transactions(user_id, tipo, descricao, categoria, valor_total, data_compra, parcelas)
        values (re.user_id, 'debito', desc_fixo, re.categoria, re.valor, d, 1);
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_scheduled_entries() from public, anon, authenticated;

-- Agenda diária
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'apply-scheduled-entries-daily') then
    perform cron.unschedule('apply-scheduled-entries-daily');
  end if;
end $$;
select cron.schedule('apply-scheduled-entries-daily', '5 0 * * *', $$select public.apply_scheduled_entries();$$);

-- updated_at trigger para payment_schedule
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_ps_touch before update on public.payment_schedule
for each row execute function public.touch_updated_at();
