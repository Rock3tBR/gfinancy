import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDashboardDate, type DashboardSummary } from "@/hooks/use-dashboard-summary";
import { CalendarClock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type Props = { summary: DashboardSummary };

export function UpcomingPayments({ summary }: Props) {
  const navigate = useNavigate();
  const items = summary.upcomingPayments;
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-5 w-5 text-primary" />Próximos vencimentos</CardTitle></CardHeader>
      <CardContent>{items.length === 0 ? <div className="rounded-3xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Nenhum vencimento próximo encontrado.</div> : <div className="space-y-3">{items.map((item) => <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 rounded-3xl border bg-background p-4"><div className="min-w-0"><p className="truncate font-semibold text-foreground">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatDashboardDate(item.date)}</p></div><div className="text-right"><p className="font-bold text-foreground">{formatCurrency(item.value)}</p><div className="mt-1 flex justify-end"><Badge variant="outline" className="rounded-full text-[10px]">{item.status}</Badge></div></div></div>)}<Button type="button" variant="outline" className="w-full rounded-2xl" onClick={() => navigate({ to: "/faturas" })}>Ver faturas</Button></div>}</CardContent>
    </Card>
  );
}
