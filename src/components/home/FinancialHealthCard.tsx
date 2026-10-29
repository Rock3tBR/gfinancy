import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/hooks/use-dashboard-summary";
import { CheckCircle2, HeartPulse } from "lucide-react";

type Props = { summary: DashboardSummary };

export function FinancialHealthCard({ summary }: Props) {
  const health = summary.financialHealth;
  const score = Math.max(0, Math.min(100, health.score));
  const colorClass = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-primary" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="h-5 w-5 text-primary" />Saúde financeira</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-end justify-between gap-4"><div><p className="text-4xl font-bold tracking-tight text-foreground">{score}/100</p><p className="mt-1 text-sm font-medium text-muted-foreground">{health.label}</p></div><div className="rounded-2xl border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">Análise do período</div></div>
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${score}%` }} /></div>
        <div className="space-y-3">{health.insights.length === 0 ? <p className="text-sm text-muted-foreground">Adicione dados financeiros para gerar insights de saúde.</p> : health.insights.map((insight, index) => <div key={index} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{insight}</span></div>)}</div>
      </CardContent>
    </Card>
  );
}
