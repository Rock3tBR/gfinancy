import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDashboardDate, type DashboardSummary } from "@/hooks/use-dashboard-summary";
import { ArrowDownLeft, ArrowUpRight, ListChecks } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type Props = { summary: DashboardSummary };

export function RecentTransactions({ summary }: Props) {
  const navigate = useNavigate();
  const transactions = summary.recentTransactions;
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-5 w-5 text-primary" />Últimas transações</CardTitle><Button type="button" variant="outline" size="sm" className="rounded-2xl" onClick={() => navigate({ to: "/transacoes" })}>Ver todas</Button></div></CardHeader>
      <CardContent>{transactions.length === 0 ? <div className="rounded-3xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Nenhuma transação encontrada para o período.</div> : <div className="space-y-3">{transactions.map((t) => { const isIncome = t.type === "income"; const Icon = isIncome ? ArrowUpRight : ArrowDownLeft; return <div key={t.id} className="flex items-center gap-3 rounded-3xl border bg-background p-4"><div className={isIncome ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600"}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-foreground">{t.description}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{formatDashboardDate(t.date)}</span><span>•</span><span>{t.account}</span><Badge variant="outline" className="rounded-full text-[10px]">{t.category}</Badge></div></div><p className={isIncome ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{isIncome ? "+" : "-"}{formatCurrency(t.value)}</p></div>; })}</div>}</CardContent>
    </Card>
  );
}
