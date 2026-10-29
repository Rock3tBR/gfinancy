
-- Tipos
create type public.transaction_type as enum ('entrada', 'debito', 'credito');

-- Tabela cards
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  bandeira text not null default 'Outro',
  limite numeric(12,2) not null default 0,
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  cor text not null default '#6366f1',
  created_at timestamptz not null default now()
);
alter table public.cards enable row level security;
create policy "cards_select_own" on public.cards for select using (auth.uid() = user_id);
create policy "cards_insert_own" on public.cards for insert with check (auth.uid() = user_id);
create policy "cards_update_own" on public.cards for update using (auth.uid() = user_id);
create policy "cards_delete_own" on public.cards for delete using (auth.uid() = user_id);

-- Tabela transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo public.transaction_type not null,
  descricao text not null,
  categoria text,
  valor_total numeric(12,2) not null check (valor_total >= 0),
  data_compra date not null,
  parcelas int not null default 1 check (parcelas between 1 and 24),
  card_id uuid references public.cards(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "tx_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "tx_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "tx_update_own" on public.transactions for update using (auth.uid() = user_id);
create policy "tx_delete_own" on public.transactions for delete using (auth.uid() = user_id);

-- Tabela installments
create table public.installments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null,
  card_id uuid not null references public.cards(id) on delete cascade,
  numero_parcela int not null,
  total_parcelas int not null,
  valor numeric(12,2) not null,
  fatura_mes date not null, -- sempre dia 01 do mês da fatura
  data_compra date not null,
  paga boolean not null default false,
  created_at timestamptz not null default now()
);
create index installments_user_fatura_idx on public.installments(user_id, fatura_mes);
alter table public.installments enable row level security;
create policy "inst_select_own" on public.installments for select using (auth.uid() = user_id);
create policy "inst_insert_own" on public.installments for insert with check (auth.uid() = user_id);
create policy "inst_update_own" on public.installments for update using (auth.uid() = user_id);
create policy "inst_delete_own" on public.installments for delete using (auth.uid() = user_id);

-- Função para calcular mês da primeira fatura
create or replace function public.calc_first_fatura_mes(p_data_compra date, p_dia_fechamento int)
returns date
language plpgsql
immutable
as $$
declare
  base date;
begin
  -- Se dia da compra >= dia fechamento => fatura do mês seguinte
  -- Caso contrário => fatura do mês atual
  base := date_trunc('month', p_data_compra)::date;
  if extract(day from p_data_compra)::int >= p_dia_fechamento then
    return (base + interval '1 month')::date;
  else
    return base;
  end if;
end;
$$;

-- Trigger para gerar installments em compras de crédito
create or replace function public.generate_installments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia_fechamento int;
  v_first_fatura date;
  v_valor_parcela numeric(12,2);
  i int;
begin
  if new.tipo <> 'credito' then
    return new;
  end if;
  if new.card_id is null then
    raise exception 'card_id obrigatório para crédito';
  end if;

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
$$;

create trigger trg_generate_installments
after insert on public.transactions
for each row execute function public.generate_installments();
