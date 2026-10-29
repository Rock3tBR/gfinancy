
Escopo grande — vou dividir em 6 frentes mantendo o visual atual (cards escuros, bordas arredondadas, nav superior).

## 1. Sistema de planos (Grátis / Pro / Premium)

### Schema
- Nova tabela `subscriptions` (user_id, plan ∈ 'free'|'pro'|'premium', status, started_at, expires_at).
- Default: todo usuário novo recebe `free` via trigger em `auth.users`.
- Função SQL `get_user_plan(uid)` retornando enum.

### Frontend
- Novo arquivo `src/lib/plans.ts` definindo capabilities por plano:
  - `free`: maxCards=1, maxTxPerMonth=30, invoiceImport=false, analytics=false, reports=false, smartFeatures=false
  - `pro`: cards ilimitados, importação, análise, relatórios, PDF/CSV, alertas
  - `premium`: tudo + IA categorização, previsão, orçamento, multi-usuário
- Hook `usePlan()` em `src/hooks/use-plan.tsx` lendo subscription.
- Componente `<UpgradeModal>` em `src/components/UpgradeModal.tsx` — modal escuro com 3 planos lado a lado e botão "Fazer upgrade".
- Componente `<FeatureGate feature="invoiceImport">` que renderiza children ou dispara o modal.
- Nova rota `/planos` (`src/routes/_authenticated/planos.tsx`) com os 3 cards de planos, destaque do plano atual e CTA upgrade.

### Bloqueios aplicados
- `/cartoes`: se `free` e já tem 1 cartão → botão "Adicionar" abre UpgradeModal.
- `/transacoes`: contador mensal; se `free` e ≥30 no mês → bloquear nova transação.
- Importação de fatura, página `/analise-fatura`, `/relatorios`: gated por Pro.
- Recursos premium (orçamento, previsão, sugestão IA): gated por Premium.

## 2. Análise de Fatura (`/analise-fatura`)

Nova rota gated Pro. Reusa `InvoiceImportDialog` existente para extrair linhas.

Nova tabela `invoice_analyses`:
- id, user_id, card_id, fatura_mes, imported_at, raw_text
Nova tabela `invoice_analysis_items`:
- id, analysis_id, user_id, data, descricao_original, valor, categoria, finalidade (text, editável)

Página mostra tabela editável (Data / Descrição / Valor / Categoria select / Finalidade input inline). Salva on-blur via update. Botão "Vincular à fatura do cartão" cria as transações reais.

## 3. Lógica bancária de faturas

Status já existe parcialmente. Estender:
- `invoices.status` enum: 'aberta' | 'fechada' | 'vencida' | 'paga' | 'parcial'
- `invoices.valor_pago` numeric default 0
- Função `compute_invoice_status(invoice_id)` que decide status com base em hoje vs dia_fechamento, dia_vencimento, valor_pago vs total.
- Atualizar página `/faturas`: badge multi-status, botão "Pagamento parcial" pedindo valor.

## 4. Relatórios (`/relatorios`)

Nova rota gated Pro. Filtros (período, categoria, min/máx, cartão, finalidade, status fatura). Tabela + totais agregados. Botões exportar:
- CSV: gerado client-side (Blob).
- PDF: usar `jspdf` + `jspdf-autotable` (instalar via bun).

## 5. Dashboard avançado

Atualizar `src/routes/_authenticated/index.tsx`:
- Linha 1 de cards: Saldo atual / Entrada mês / Gasto mês / Lucro mês
- Linha 2: Gasto previsto mês / Total gasto ano / Próximo vencimento / Alertas
- Gráficos (recharts já instalado):
  - Bar comparativo Entradas vs Gastos (últimos 6m)
  - Line evolução mensal saldo
  - Pie por categoria (mês)
  - Bar horizontal gastos por cartão
- Card "Próximas faturas" (próximos 30 dias) com status.
- Card "Alertas": faturas vencidas, plano free próximo do limite, etc.

## 6. Nav

Adicionar em `src/routes/_authenticated.tsx`: links `Análise`, `Relatórios`, `Planos` (com FeatureGate quando aplicável — links visíveis mas clicam → upgrade modal se sem permissão).

## Observações
- Pagamento real (Stripe/Paddle) NÃO incluído nesta etapa — botão "Fazer upgrade" apenas troca o plano no banco (mock) para podermos validar a lógica. Posso enable Stripe/Paddle depois, é melhor confirmar primeiro.
- Recursos Premium "IA de categorização" e "previsão" entram como UI + função stub usando Lovable AI Gateway (`google/gemini-2.5-flash`) quando aprovado.
- Mantenho RLS em todas as tabelas novas, com GRANT explícito.

## Arquivos principais
- supabase/migrations/<nova>.sql (subscriptions, invoice_analyses, invoice_analysis_items, invoices.status enum + valor_pago, compute_invoice_status, trigger user→free)
- src/lib/plans.ts, src/hooks/use-plan.tsx, src/components/UpgradeModal.tsx, src/components/FeatureGate.tsx
- src/routes/_authenticated/planos.tsx
- src/routes/_authenticated/analise-fatura.tsx
- src/routes/_authenticated/relatorios.tsx
- src/routes/_authenticated/index.tsx (dashboard expandido)
- src/routes/_authenticated/faturas.tsx (status estendido + parcial)
- src/routes/_authenticated/cartoes.tsx, transacoes.tsx (gates)
- src/routes/_authenticated.tsx (nav)

Confirma para eu começar? Se quiser que eu já integre pagamento real (Stripe seamless) em vez de mock, me diga.
