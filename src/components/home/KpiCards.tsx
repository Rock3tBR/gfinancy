import { Card, CardContent } from "@/components/ui/card";
import type { DashboardKpi, DashboardSummary } from "@/hooks/use-dashboard-summary";
import { ArrowDown, ArrowUp, CalendarClock, CreditCard, DollarSign, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";

type Props = { summary: DashboardSummary };
const ICONS: Record<string, any> = { currentBalance: Wallet, income: ArrowUp, expenses: ArrowDown, monthlyResult: TrendingUp, openInvoices: Receipt, projectedBalance: DollarSign, nextDue: CalendarClock, cardSpending: CreditCard };

export function KpiCards({ summary }: Props) {
  if (summary.kpis.length === 0) {
    return <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="rounded-3xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-5"><div className="h-4 w-24 rounded-full bg-muted" /><div className="mt-5 h-8 w-32 rounded-full bg-muted" /><div className="mt-4 h-3 w-full rounded-full bg-muted" /></CardContent></Card>)}</div>;
  }
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">{summary.kpis.slice(0, 8).map((item) => <KpiCard key={item.key} item={item} />)}</div>;
}

function KpiCard({ item }: { item: DashboardKpi }) {
  const Icon = ICONS[item.key] ?? DollarSign;
  const toneClass = item.tone === "positive" ? "text-emerald-600 bg-emerald-500/10" : item.tone === "negative" ? "text-red-600 bg-red-500/10" : item.tone === "warning" ? "text-amber-600 bg-amber-500/10" : "text-primary bg-primary/10";
  const TrendIcon = item.trend.direction === "up" ? TrendingUp : item.trend.direction === "down" ? TrendingDown : DollarSign;
  return (
    <Card className="group rounded-3xl border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0"><p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{item.title}</p><p className="mt-2 truncate text-lg font-bold tracking-tight text-foreground sm:mt-3 sm:text-2xl">{item.formattedValue}</p></div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11 ${toneClass}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs sm:mt-4"><TrendIcon className={item.trend.direction === "up" ? "h-3.5 w-3.5 shrink-0 text-emerald-500" : item.trend.direction === "down" ? "h-3.5 w-3.5 shrink-0 text-red-500" : "h-3.5 w-3.5 shrink-0 text-muted-foreground"} /><span className="truncate text-muted-foreground">{item.trend.label}</span></div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-3">{item.description}</p>
      </CardContent>
    </Card>
  );
}
