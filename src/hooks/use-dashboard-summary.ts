import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";

export type DashboardPeriod = "current_month" | "last_3_months" | "last_6_months" | "current_year";
export type DashboardTone = "positive" | "negative" | "neutral" | "warning";
export type DashboardTrend = { value: number; label: string; direction: "up" | "down" | "neutral" };
export type DashboardKpi = { key: string; title: string; value: number; formattedValue: string; description: string; trend: DashboardTrend; tone: DashboardTone };
export type ChartPoint = { label: string; entradas: number; saidas: number; resultado: number; cartao: number; saldoProjetado: number };
export type CategorySpending = { name: string; value: number; percentage: number };
export type CardUsage = { id: string; name: string; brand: string | null; lastDigits: string | null; limit: number; used: number; available: number; invoiceAmount: number; usagePercentage: number; dueDate: string | null; status: string };
export type SmartAlert = { id: string; level: "info" | "success" | "warning" | "critical"; title: string; description: string; actionLabel?: string };
export type UpcomingPayment = { id: string; name: string; date: string | null; value: number; status: string; type: "invoice" | "transaction" | "recurring" | "payment" };
export type RecentTransaction = { id: string; date: string | null; description: string; category: string; account: string; value: number; type: "income" | "expense"; status: string };
export type ProjectedBalance = { currentBalance: number; expectedIncome: number; openInvoices: number; billsToPay: number; projectedBalance: number };
export type FinancialHealth = { score: number; label: string; insights: string[] };
export type DashboardSummary = {
  entityId: string | null;
  entityName: string;
  entityType: string;
  period: DashboardPeriod;
  periodLabel: string;
  kpis: DashboardKpi[];
  currentBalance: number;
  income: number;
  expenses: number;
  monthlyResult: number;
  openInvoices: number;
  projectedBalance: ProjectedBalance;
  financialHealth: FinancialHealth;
  chartData: ChartPoint[];
  categorySpending: CategorySpending[];
  cardsUsage: CardUsage[];
  alerts: SmartAlert[];
  upcomingPayments: UpcomingPayment[];
  recentTransactions: RecentTransaction[];
  hasAnyData: boolean;
};

type Row = Record<string, any>;
type Range = { start: Date; end: Date; previousStart: Date; previousEnd: Date; months: number };

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  current_month: "Mês atual",
  last_3_months: "Últimos 3 meses",
  last_6_months: "Últimos 6 meses",
  current_year: "Ano atual",
};

export function useDashboardSummary() {
  const { user } = useAuth();
  const { selectedEntityId, selectedEntity, isLoading: entityLoading } = useFinancialEntity();
  const [period, setPeriod] = useState<DashboardPeriod>("current_month");
  const range = useMemo(() => getPeriodRange(period), [period]);

  const query = useQuery({
    queryKey: ["dashboard-summary", user?.id, selectedEntityId, period],
    enabled: Boolean(user?.id) && Boolean(selectedEntityId) && !entityLoading,
    queryFn: async () => {
      if (!selectedEntityId) return emptySummary(period, selectedEntity);
      const [transactions, cards, invoices, categories, recurringExpenses, paymentSchedule] = await Promise.all([
        safeSelect("transactions", selectedEntityId, range.previousStart, range.end),
        safeSelect("cards", selectedEntityId),
        safeSelect("invoices", selectedEntityId),
        safeSelect("categories", selectedEntityId),
        safeSelect("recurring_expenses", selectedEntityId),
        safePaymentSchedule(),
      ]);
      return buildSummary({ period, range, selectedEntityId, selectedEntity, transactions, cards, invoices, categories, recurringExpenses, paymentSchedule });
    },
  });

  const fallback = useMemo(() => emptySummary(period, selectedEntity), [period, selectedEntity]);

  return {
    data: query.data ?? fallback,
    isLoading: entityLoading || query.isLoading,
    error: query.error,
    period,
    setPeriod,
    hasAnyData: Boolean(query.data?.hasAnyData),
    refetch: query.refetch,
  };
}

async function safeSelect(table: string, entityId: string, start?: Date, end?: Date): Promise<Row[]> {
  try {
    let query = (supabase as any).from(table).select("*").eq("entity_id", entityId);
    if (table === "transactions" && start && end) {
      query = query.gte("data_compra", toISODate(start)).lte("data_compra", toISODate(end)).order("data_compra", { ascending: false });
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`Erro ao buscar ${table}:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (error) {
    console.warn(`Erro ao buscar ${table}:`, error);
    return [];
  }
}

// payment_schedule é 1 registro por usuário (não por entidade, ver
// src/routes/_authenticated/configuracoes.tsx), então não filtra por
// entity_id — a leitura já é restrita ao próprio usuário pela RLS.
async function safePaymentSchedule(): Promise<Row | null> {
  try {
    const { data, error } = await (supabase as any).from("payment_schedule").select("*").maybeSingle();
    if (error) {
      console.warn("Erro ao buscar payment_schedule:", error.message);
      return null;
    }
    return data ?? null;
  } catch (error) {
    console.warn("Erro ao buscar payment_schedule:", error);
    return null;
  }
}

function buildSummary({ period, range, selectedEntityId, selectedEntity, transactions, cards, invoices, categories, recurringExpenses, paymentSchedule }: { period: DashboardPeriod; range: Range; selectedEntityId: string; selectedEntity: any; transactions: Row[]; cards: Row[]; invoices: Row[]; categories: Row[]; recurringExpenses: Row[]; paymentSchedule: Row | null }): DashboardSummary {
  const current = transactions.filter((t) => inRange(getTransactionDate(t), range.start, range.end));
  const previous = transactions.filter((t) => inRange(getTransactionDate(t), range.previousStart, range.previousEnd));
  const income = sumTransactions(current, "income");

  // Todas as despesas do período, incluindo compras no cartão de crédito.
  // Esse valor continua sendo usado em "Saídas", categorias e resultado.
  const expenses = sumTransactions(current, "expense");

  // O saldo atual representa somente o dinheiro que já saiu da conta.
  // Compras no crédito não reduzem o saldo imediatamente: elas entram na
  // fatura e só impactam o caixa quando a fatura for paga.
  const cashExpenses = current
    .filter((transaction) =>
      getTransactionKind(transaction) === "expense" &&
      !isCreditExpense(transaction)
    )
    .reduce((sum, transaction) => sum + getAmount(transaction), 0);

  const previousIncome = sumTransactions(previous, "income");
  const previousExpenses = sumTransactions(previous, "expense");
  const previousCashExpenses = previous
    .filter((transaction) =>
      getTransactionKind(transaction) === "expense" &&
      !isCreditExpense(transaction)
    )
    .reduce((sum, transaction) => sum + getAmount(transaction), 0);

  const currentBalance = income - cashExpenses;
  const previousBalance = previousIncome - previousCashExpenses;

  // Resultado financeiro do período considera todas as despesas,
  // inclusive compras no crédito.
  const monthlyResult = income - expenses;
  const previousResult = previousIncome - previousExpenses;
  const openInvoices = invoices.filter((i) => !isPaidStatus(i.status ?? i.situacao)).reduce((s, i) => s + getAmount(i), 0);
  const forecast = buildForecast(transactions, recurringExpenses, paymentSchedule);
  const expectedIncome = forecast.incomeTotal;
  const billsToPay = forecast.expenseTotal;
  const projected = currentBalance + expectedIncome - openInvoices - billsToPay;
  const cardSpending = current.filter(isCreditExpense).reduce((s, t) => s + getAmount(t), 0);
  const categorySpending = buildCategorySpending(current, categories);
  const cardsUsage = buildCardsUsage(cards, invoices, current);
  const chartData = buildChartData(transactions, invoices, range);
  const upcomingPayments = buildUpcomingPayments(invoices, current, forecast.items);
  const recentTransactions = buildRecentTransactions(current, cards);
  const alerts = buildAlerts({ monthlyResult, previousExpenses, expenses, openInvoices, categorySpending, upcomingPayments, recentTransactions, projectedBalance: projected });
  const financialHealth = buildFinancialHealth({ currentBalance, projectedBalance: projected, openInvoices, expenses, income, upcomingPayments, alerts });

  const kpis: DashboardKpi[] = [
    kpi(
      "currentBalance",
      "Saldo atual",
      currentBalance,
      "Entradas menos despesas já pagas. Compras no crédito entram somente na fatura.",
      buildTrend(currentBalance, previousBalance),
      currentBalance >= 0 ? "positive" : "negative",
    ),
    kpi("income", "Entradas", income, "Receitas registradas no período selecionado.", buildTrend(income, previousIncome), "positive"),
    kpi("expenses", "Saídas", expenses, "Despesas e compras registradas no período.", buildTrend(expenses, previousExpenses, true), expenses > previousExpenses ? "warning" : "neutral"),
    kpi("monthlyResult", "Resultado", monthlyResult, "Saldo do período depois das movimentações.", buildTrend(monthlyResult, previousResult), monthlyResult >= 0 ? "positive" : "negative"),
    kpi("openInvoices", "Faturas abertas", openInvoices, "Total em faturas ainda não marcadas como pagas.", { value: 0, label: "Acompanhe vencimentos", direction: "neutral" }, openInvoices > 0 ? "warning" : "neutral"),
    kpi("projectedBalance", "Saldo projetado", projected, "Saldo estimado considerando faturas e contas previstas.", { value: 0, label: projected >= 0 ? "Projeção positiva" : "Atenção ao caixa", direction: projected >= 0 ? "up" : "down" }, projected >= 0 ? "positive" : "negative"),
    kpi("nextDue", "Próximo vencimento", upcomingPayments[0]?.value ?? 0, upcomingPayments[0]?.date ? `${upcomingPayments[0].name} em ${formatDate(upcomingPayments[0].date)}` : "Nenhum vencimento próximo.", { value: 0, label: "Agenda financeira", direction: "neutral" }, upcomingPayments.length ? "warning" : "neutral"),
    kpi("cardSpending", "Gastos no cartão", cardSpending, "Compras no crédito dentro do período.", { value: 0, label: "Uso consolidado", direction: "neutral" }, cardSpending ? "neutral" : "positive"),
  ];

  return {
    entityId: selectedEntityId,
    entityName: selectedEntity?.nickname || selectedEntity?.name || "Entidade",
    entityType: selectedEntity?.type?.toUpperCase?.() || "",
    period,
    periodLabel: PERIOD_LABELS[period],
    kpis,
    currentBalance,
    income,
    expenses,
    monthlyResult,
    openInvoices,
    projectedBalance: { currentBalance, expectedIncome, openInvoices, billsToPay, projectedBalance: projected },
    financialHealth,
    chartData,
    categorySpending,
    cardsUsage,
    alerts,
    upcomingPayments,
    recentTransactions,
    hasAnyData: transactions.length > 0 || cards.length > 0 || invoices.length > 0 || categories.length > 0,
  };
}

function emptySummary(period: DashboardPeriod, selectedEntity: any): DashboardSummary {
  return {
    entityId: selectedEntity?.id ?? null,
    entityName: selectedEntity?.nickname || selectedEntity?.name || "Nenhuma entidade",
    entityType: selectedEntity?.type?.toUpperCase?.() || "",
    period,
    periodLabel: PERIOD_LABELS[period],
    kpis: [],
    currentBalance: 0,
    income: 0,
    expenses: 0,
    monthlyResult: 0,
    openInvoices: 0,
    projectedBalance: { currentBalance: 0, expectedIncome: 0, openInvoices: 0, billsToPay: 0, projectedBalance: 0 },
    financialHealth: { score: 0, label: "Sem dados", insights: ["Cadastre cartões, transações ou faturas para gerar sua análise."] },
    chartData: [],
    categorySpending: [],
    cardsUsage: [],
    alerts: [],
    upcomingPayments: [],
    recentTransactions: [],
    hasAnyData: false,
  };
}

function kpi(key: string, title: string, value: number, description: string, trend: DashboardTrend, tone: DashboardTone): DashboardKpi {
  return { key, title, value, formattedValue: brl(value), description, trend, tone };
}

function getPeriodRange(period: DashboardPeriod): Range {
  const now = new Date();
  const end = endOfDay(now);
  if (period === "current_year") {
    return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end, previousStart: startOfDay(new Date(now.getFullYear() - 1, 0, 1)), previousEnd: endOfDay(new Date(now.getFullYear() - 1, 11, 31)), months: now.getMonth() + 1 };
  }
  const months = period === "last_6_months" ? 6 : period === "last_3_months" ? 3 : 1;
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return { start: startOfDay(start), end, previousStart: startOfDay(new Date(start.getFullYear(), start.getMonth() - months, 1)), previousEnd: endOfDay(new Date(start.getFullYear(), start.getMonth(), 0)), months };
}

function buildChartData(transactions: Row[], invoices: Row[], range: Range): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let index = range.months - 1; index >= 0; index--) {
    const date = new Date(range.end.getFullYear(), range.end.getMonth() - index, 1);
    const label = date.toLocaleDateString("pt-BR", { month: "short" });
    const start = startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
    const end = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
    const monthTx = transactions.filter((t) => inRange(getTransactionDate(t), start, end));
    const entradas = sumTransactions(monthTx, "income");
    const saidas = sumTransactions(monthTx, "expense");
    const cartao = monthTx.filter(isCreditExpense).reduce((s, t) => s + getAmount(t), 0);
    const monthInvoices = invoices.filter((i) => inRange(getInvoiceDueDate(i), start, end)).filter((i) => !isPaidStatus(i.status ?? i.situacao)).reduce((s, i) => s + getAmount(i), 0);
    points.push({ label, entradas, saidas, resultado: entradas - saidas, cartao, saldoProjetado: entradas - saidas - monthInvoices });
  }
  return points;
}

function buildCategorySpending(transactions: Row[], categories: Row[]): CategorySpending[] {
  const categoryNameById = new Map<string, string>();
  categories.forEach((c) => categoryNameById.set(String(c.id), String(c.nome ?? c.name ?? c.titulo ?? "")));
  const grouped = new Map<string, number>();
  transactions.filter((t) => getTransactionKind(t) === "expense").forEach((t) => {
    const raw = t.categoria ?? t.category ?? t.category_id ?? "Sem categoria";
    const name = categoryNameById.get(String(raw)) || String(raw || "Sem categoria");
    grouped.set(name, (grouped.get(name) ?? 0) + getAmount(t));
  });
  const total = Array.from(grouped.values()).reduce((s, v) => s + v, 0);
  return Array.from(grouped.entries()).map(([name, value]) => ({ name, value, percentage: total ? Math.round((value / total) * 100) : 0 })).sort((a, b) => b.value - a.value).slice(0, 5);
}

function buildCardsUsage(cards: Row[], invoices: Row[], transactions: Row[]): CardUsage[] {
  return cards.map((card) => {
    const id = String(card.id);
    const limit = Number(card.limite ?? card.limit ?? card.limite_total ?? 0);
    const invoiceAmount = invoices.filter((i) => String(i.card_id ?? i.cartao_id ?? "") === id).filter((i) => !isPaidStatus(i.status ?? i.situacao)).reduce((s, i) => s + getAmount(i), 0);
    const txAmount = transactions.filter((t) => String(t.card_id ?? t.cartao_id ?? "") === id).filter((t) => getTransactionKind(t) === "expense").reduce((s, t) => s + getAmount(t), 0);
    const used = invoiceAmount || txAmount;
    const available = Math.max(0, limit - used);
    const usagePercentage = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const nextInvoice = invoices.filter((i) => String(i.card_id ?? i.cartao_id ?? "") === id).sort((a, b) => Number(getInvoiceDueDate(a)) - Number(getInvoiceDueDate(b)))[0];
    return { id, name: String(card.nome ?? card.name ?? "Cartão"), brand: card.bandeira ?? card.brand ?? null, lastDigits: card.final_cartao ?? card.last_digits ?? card.ultimos_digitos ?? card.final ?? null, limit, used, available, invoiceAmount, usagePercentage, dueDate: getInvoiceDueDate(nextInvoice)?.toISOString() ?? null, status: String(nextInvoice?.status ?? "Aberta") };
  });
}

function buildUpcomingPayments(invoices: Row[], transactions: Row[], forecastItems: UpcomingPayment[] = []): UpcomingPayment[] {
  const invoicePayments = invoices.filter((i) => !isPaidStatus(i.status ?? i.situacao)).map((i) => ({ id: String(i.id), name: String(i.nome ?? i.descricao ?? "Fatura"), date: getInvoiceDueDate(i)?.toISOString() ?? null, value: getAmount(i), status: String(i.status ?? "Aberta"), type: "invoice" as const }));
  const scheduled = transactions.filter((t) => {
    const status = String(t.status ?? "").toLowerCase();
    const date = getTransactionDate(t);
    return date && date > new Date() && !["paid", "pago", "paga"].includes(status);
  }).map((t) => ({ id: String(t.id), name: String(t.descricao ?? "Pagamento"), date: getTransactionDate(t)?.toISOString() ?? null, value: getAmount(t), status: String(t.status ?? "Pendente"), type: "transaction" as const }));
  return [...invoicePayments, ...scheduled, ...forecastItems].sort((a, b) => Number(new Date(a.date ?? 0)) - Number(new Date(b.date ?? 0))).slice(0, 6);
}

// Projeta, a partir dos gastos fixos (recurring_expenses) e da agenda de
// pagamento (payment_schedule) ativos, o que ainda falta acontecer no mês
// atual e ainda não virou uma transação real (gerada pelo cron
// apply_scheduled_entries/run_my_scheduled_entries no banco). Antes disso,
// "Receitas previstas"/"Contas a pagar" no card "Saldo projetado" sempre
// davam R$ 0,00, porque filtravam transactions por uma coluna `status`
// ("previsto"/"pending") que nunca existiu na tabela.
function buildForecast(allTransactions: Row[], recurringExpenses: Row[], paymentSchedule: Row | null): { incomeTotal: number; expenseTotal: number; items: UpcomingPayment[] } {
  const now = new Date();
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyymm = `${mm}/${now.getFullYear()}`;
  const thisMonthDescriptions = new Set(
    allTransactions
      .filter((t) => inRange(getTransactionDate(t), monthStart, monthEnd))
      .map((t) => String(t.descricao ?? "").trim())
  );

  const items: UpcomingPayment[] = [];
  let expenseTotal = 0;
  recurringExpenses
    .filter((re) => re.ativo)
    .forEach((re) => {
      const dia = Number(re.dia);
      if (!dia) return;
      const label = `[Fixo] ${re.descricao} ${yyyymm}`;
      if (thisMonthDescriptions.has(label)) return; // já foi gerada como transação real este mês
      const value = Number(re.valor ?? 0);
      if (!value) return;
      const dueDay = Math.min(dia, monthEnd.getDate());
      const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
      expenseTotal += value;
      items.push({ id: `recurring-${re.id}`, name: `${re.descricao} (previsto)`, date: dueDate.toISOString(), value, status: "Previsto", type: "recurring" });
    });

  let incomeTotal = 0;
  if (paymentSchedule?.ativo) {
    const diaPagamento = Number(paymentSchedule.dia_pagamento);
    const valorPagamento = Number(paymentSchedule.valor_pagamento ?? 0);
    if (diaPagamento && valorPagamento) {
      const label = `[Auto] Pagamento ${yyyymm}`;
      if (!thisMonthDescriptions.has(label)) {
        const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(diaPagamento, monthEnd.getDate()));
        incomeTotal += valorPagamento;
        items.push({ id: "payment-schedule-pagamento", name: "Pagamento (previsto)", date: dueDate.toISOString(), value: valorPagamento, status: "Previsto", type: "payment" });
      }
    }
    if (paymentSchedule.recebe_vale) {
      const diaVale = Number(paymentSchedule.dia_vale);
      const valorVale = Number(paymentSchedule.valor_vale ?? 0);
      if (diaVale && valorVale) {
        const label = `[Auto] Vale ${yyyymm}`;
        if (!thisMonthDescriptions.has(label)) {
          const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(diaVale, monthEnd.getDate()));
          incomeTotal += valorVale;
          items.push({ id: "payment-schedule-vale", name: "Vale (previsto)", date: dueDate.toISOString(), value: valorVale, status: "Previsto", type: "payment" });
        }
      }
    }
  }

  return { incomeTotal, expenseTotal, items };
}

function buildRecentTransactions(transactions: Row[], cards: Row[]): RecentTransaction[] {
  const cardNameById = new Map<string, string>();
  cards.forEach((card) => cardNameById.set(String(card.id), String(card.nome ?? card.name ?? "Cartão")));
  return [...transactions].sort((a, b) => Number(getTransactionDate(b)) - Number(getTransactionDate(a))).slice(0, 8).map((t) => {
    const type = getTransactionKind(t);
    const cardId = String(t.card_id ?? t.cartao_id ?? "");
    return { id: String(t.id), date: getTransactionDate(t)?.toISOString() ?? null, description: String(t.descricao ?? t.description ?? "Transação"), category: String(t.categoria ?? t.category ?? "Sem categoria"), account: cardNameById.get(cardId) ?? "Conta", value: getAmount(t), type, status: String(t.status ?? "Confirmada") };
  });
}

function buildAlerts({ monthlyResult, previousExpenses, expenses, openInvoices, categorySpending, upcomingPayments, recentTransactions, projectedBalance }: { monthlyResult: number; previousExpenses: number; expenses: number; openInvoices: number; categorySpending: CategorySpending[]; upcomingPayments: UpcomingPayment[]; recentTransactions: RecentTransaction[]; projectedBalance: number }): SmartAlert[] {
  const alerts: SmartAlert[] = [{ id: projectedBalance >= 0 ? "positive-projection" : "negative-projection", level: projectedBalance >= 0 ? "success" : "critical", title: projectedBalance >= 0 ? "Saldo projetado positivo" : "Saldo projetado negativo", description: projectedBalance >= 0 ? "Mesmo considerando faturas abertas, sua projeção segue positiva." : "Revise gastos e vencimentos para evitar fechar o período no vermelho." }];
  const nextPayment = upcomingPayments[0];
  if (nextPayment?.date) {
    const days = daysUntil(nextPayment.date);
    alerts.push({ id: "next-payment", level: days <= 5 ? "warning" : "info", title: "Próximo vencimento", description: days >= 0 ? `${nextPayment.name} vence em ${days} dia(s).` : `${nextPayment.name} está vencido há ${Math.abs(days)} dia(s).`, actionLabel: "Ver vencimentos" });
  }
  if (previousExpenses > 0 && expenses > previousExpenses * 1.2) alerts.push({ id: "spending-increase", level: "warning", title: "Gastos acima do período anterior", description: `Suas saídas cresceram ${Math.round(((expenses - previousExpenses) / previousExpenses) * 100)}%.` });
  if (categorySpending[0]) alerts.push({ id: "top-category", level: "info", title: "Categoria com maior gasto", description: `${categorySpending[0].name} representa ${categorySpending[0].percentage}% das despesas.` });
  const uncategorized = recentTransactions.filter((t) => t.category.toLowerCase() === "sem categoria").length;
  if (uncategorized > 0) alerts.push({ id: "uncategorized", level: "info", title: "Transações sem categoria", description: `${uncategorized} transação(ões) recente(s) precisam de categoria.`, actionLabel: "Categorizar" });
  if (monthlyResult < 0 && openInvoices > 0) alerts.push({ id: "negative-result-open-invoices", level: "critical", title: "Resultado negativo com faturas abertas", description: "O período está negativo e ainda existem faturas em aberto." });
  return alerts.slice(0, 6);
}

function buildFinancialHealth({ currentBalance, projectedBalance, openInvoices, expenses, income, upcomingPayments, alerts }: { currentBalance: number; projectedBalance: number; openInvoices: number; expenses: number; income: number; upcomingPayments: UpcomingPayment[]; alerts: SmartAlert[] }): FinancialHealth {
  let score = 70;
  const insights: string[] = [];
  if (currentBalance >= 0) { score += 10; insights.push("Saldo atual positivo."); } else { score -= 20; insights.push("Saldo atual negativo."); }
  if (projectedBalance >= 0) { score += 10; insights.push("Saldo projetado positivo após compromissos."); } else { score -= 20; insights.push("Saldo projetado exige atenção."); }
  if (income > 0 && expenses <= income * 0.75) { score += 10; insights.push("Gastos abaixo de 75% das entradas."); }
  if (openInvoices > 0) { score -= 5; insights.push("Existem faturas abertas para acompanhar."); }
  if (upcomingPayments.some((p) => p.date && daysUntil(p.date) <= 5)) { score -= 5; insights.push("Há vencimentos próximos."); }
  if (alerts.some((a) => a.level === "critical")) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const label = score >= 85 ? "Excelente" : score >= 70 ? "Boa" : score >= 50 ? "Atenção" : "Crítica";
  return { score, label, insights: insights.slice(0, 4) };
}

function sumTransactions(transactions: Row[], kind: "income" | "expense") { return transactions.filter((t) => getTransactionKind(t) === kind).reduce((s, t) => s + getAmount(t), 0); }
function getTransactionKind(t: Row): "income" | "expense" { const type = String(t.tipo ?? t.type ?? "").toLowerCase(); const amount = Number(t.valor_total ?? t.valor ?? t.amount ?? 0); if (["entrada", "receita", "income", "credit"].includes(type)) return "income"; if (["saida", "saída", "despesa", "expense", "debito", "débito", "credito", "crédito"].includes(type)) return "expense"; return amount < 0 ? "expense" : "expense"; }
function isCreditExpense(t: Row) { const type = String(t.tipo ?? t.type ?? "").toLowerCase(); return ["credito", "crédito", "credit_card"].includes(type) || Boolean(t.card_id); }
function getAmount(row: Row | undefined | null) { if (!row) return 0; const value = row.valor_total ?? row.valor ?? row.amount ?? row.total ?? row.total_amount ?? row.valor_fatura ?? 0; const parsed = typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : Number(value); return Number.isFinite(parsed) ? Math.abs(parsed) : 0; }
function getTransactionDate(row: Row | undefined | null) { const value = row?.data_compra ?? row?.data ?? row?.date ?? row?.created_at ?? row?.paid_at ?? row?.due_date; if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function getInvoiceDueDate(row: Row | undefined | null) { const value = row?.vencimento ?? row?.data_vencimento ?? row?.due_date ?? row?.closed_at ?? row?.created_at; if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function inRange(date: Date | null, start: Date, end: Date) { return Boolean(date && date >= start && date <= end); }
function isPaidStatus(status: unknown) { return ["pago", "paga", "paid", "liquidado", "fechada_paga"].includes(String(status ?? "").toLowerCase()); }
function buildTrend(current: number, previous: number, inverse = false): DashboardTrend { if (!previous) return { value: 0, label: "Sem comparação anterior", direction: "neutral" }; const variation = ((current - previous) / Math.abs(previous)) * 100; const direction = Math.abs(variation) < 1 ? "neutral" : inverse ? (variation > 0 ? "down" : "up") : variation > 0 ? "up" : "down"; return { value: variation, label: `${variation > 0 ? "+" : ""}${variation.toFixed(1)}% vs período anterior`, direction }; }
function startOfDay(date: Date) { const clone = new Date(date); clone.setHours(0, 0, 0, 0); return clone; }
function endOfDay(date: Date) { const clone = new Date(date); clone.setHours(23, 59, 59, 999); return clone; }
function toISODate(date: Date) { return date.toISOString().slice(0, 10); }
function daysUntil(value: string) { const target = startOfDay(new Date(value)); const today = startOfDay(new Date()); return Math.ceil((target.getTime() - today.getTime()) / 86_400_000); }
function formatDate(value: string) { return new Date(value).toLocaleDateString("pt-BR"); }
function brl(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0); }
export function formatCurrency(value: number) { return brl(value); }
export function formatDashboardDate(value: string | null) { if (!value) return "Sem data"; return formatDate(value); }
