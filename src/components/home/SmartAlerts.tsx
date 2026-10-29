import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary, SmartAlert } from "@/hooks/use-dashboard-summary";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, XCircle } from "lucide-react";

type Props = { summary: DashboardSummary };

export function SmartAlerts({ summary }: Props) {
  const alerts = summary.alerts;
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-5 w-5 text-primary" />Alertas e insights</CardTitle></CardHeader>
      <CardContent>{alerts.length === 0 ? <div className="rounded-3xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Nenhum alerta relevante no momento. Conforme você adiciona dados, os insights aparecem aqui.</div> : <div className="space-y-3">{alerts.map((alert) => <AlertItem key={alert.id} alert={alert} />)}</div>}</CardContent>
    </Card>
  );
}
function AlertItem({ alert }: { alert: SmartAlert }) {
  const Icon = alert.level === "success" ? CheckCircle2 : alert.level === "warning" ? AlertTriangle : alert.level === "critical" ? XCircle : Info;
  const toneClass = alert.level === "success" ? "bg-emerald-500/10 text-emerald-600" : alert.level === "warning" ? "bg-amber-500/10 text-amber-600" : alert.level === "critical" ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary";
  return <div className="flex gap-3 rounded-3xl border bg-background p-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{alert.title}</p><Badge variant="outline" className="rounded-full text-[10px]">{alert.level}</Badge></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.description}</p>{alert.actionLabel && <p className="mt-2 text-xs font-medium text-primary">{alert.actionLabel}</p>}</div></div>;
}
