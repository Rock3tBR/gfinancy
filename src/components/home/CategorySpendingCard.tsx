import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type DashboardSummary } from "@/hooks/use-dashboard-summary";
import { PieChart, Tags } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type Props = { summary: DashboardSummary };

export function CategorySpendingCard({ summary }: Props) {
  const navigate = useNavigate();
  const categories = summary.categorySpending;
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><PieChart className="h-5 w-5 text-primary" />Gastos por categoria</CardTitle></CardHeader>
      <CardContent>{categories.length === 0 ? <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border bg-muted/30 p-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Tags className="h-6 w-6" /></div><h3 className="mt-4 font-semibold text-foreground">Nenhum gasto categorizado ainda</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Categorize suas transações para visualizar seus principais gastos.</p><Button type="button" variant="outline" className="mt-5 rounded-2xl" onClick={() => navigate({ to: "/categorias" })}>Configurar categorias</Button></div> : <div className="space-y-4">{categories.map((c, i) => <div key={c.name} className="space-y-2"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">{i + 1}. {c.name}</p><p className="text-xs text-muted-foreground">{c.percentage}% do total</p></div><p className="text-sm font-bold text-foreground">{formatCurrency(c.value)}</p></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${c.percentage}%` }} /></div></div>)}</div>}</CardContent>
    </Card>
  );
}
