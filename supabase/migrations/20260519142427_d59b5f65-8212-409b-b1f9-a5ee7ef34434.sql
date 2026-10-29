
-- Set search_path on calc function
create or replace function public.calc_first_fatura_mes(p_data_compra date, p_dia_fechamento int)
returns date
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  base date;
begin
  base := date_trunc('month', p_data_compra)::date;
  if extract(day from p_data_compra)::int >= p_dia_fechamento then
    return (base + interval '1 month')::date;
  else
    return base;
  end if;
end;
$$;

-- Revogar execução pública das funções (a trigger ainda funciona pois roda como owner)
revoke execute on function public.generate_installments() from public, anon, authenticated;
revoke execute on function public.calc_first_fatura_mes(date, int) from public, anon, authenticated;
