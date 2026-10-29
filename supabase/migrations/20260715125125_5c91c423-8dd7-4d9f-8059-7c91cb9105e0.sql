ALTER TABLE public.invoice_analysis_items
  ADD COLUMN IF NOT EXISTS parcela_atual integer,
  ADD COLUMN IF NOT EXISTS total_parcelas integer;