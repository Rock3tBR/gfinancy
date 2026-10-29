import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type DashboardSummary } from "@/hooks/use-dashboard-summary";
import { BarChart3 } from "lucide-react";

type Props = { summary: DashboardSummary };

export function MainFinanceChart({ summary }: Props) {
  const data = summary.chartData;
  const maxValue = Math.max(1, ...data.flatMap((p) => [p.entradas, p.saidas, Math.abs(p.resultado), p.cartao]));
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><div className="flex items-center justify-between gap-4"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5 text-primary" />Comparativo financeiro</CardTitle><div className="hidden flex-wrap gap-3 text-xs text-muted-foreground md:flex"><Legend label="Entradas" className="bg-emerald-500" /><Legend label="Saídas" className="bg-red-500" /><Legend label="Cartão" className="bg-primary" /></div></div></CardHeader>
      <CardContent>{data.length === 0 ? <div className="flex min-h-[260px] items-center justify-center rounded-3xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Nenhum dado suficiente para montar o gráfico.</div> : <div className="space-y-5"><div className="flex h-[280px] items-end gap-4 overflow-x-auto rounded-3xl border bg-muted/20 p-5">{data.map((p) => <div key={p.label} className="flex min-w-[76px] flex-1 flex-col items-center gap-3"><div className="flex h-[210px] items-end gap-1.5"><Bar value={p.entradas} maxValue={maxValue} className="bg-emerald-500" title={`Entradas: ${formatCurrency(p.entradas)}`} /><Bar value={p.saidas} maxValue={maxValue} className="bg-red-500" title={`Saídas: ${formatCurrency(p.saidas)}`} /><Bar value={p.cartao} maxValue={maxValue} className="bg-primary" title={`Cartão: ${formatCurrency(p.cartao)}`} /></div><div className="text-center"><p className="text-xs font-medium capitalize text-muted-foreground">{p.label}</p><p className={`mt-1 text-xs font-semibold ${p.resultado >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(p.resultado)}</p></div></div>)}</div><div className="grid gap-3 md:grid-cols-3"><SummaryPill label="Entradas" value={summary.income} tone="positive" /><SummaryPill label="Saídas" value={summary.expenses} tone="negative" /><SummaryPill label="Resultado" value={summary.monthlyResult} tone={summary.monthlyResult >= 0 ? "positive" : "negative"} /></div></div>}</CardContent>
    </Card>
  );
}
function Bar({ value, maxValue, className, title }: { value: number; maxValue: number; className: string; title: string }) { const height = Math.max(4, Math.round((value / maxValue) * 200)); return <div title={title} className={`w-4 rounded-t-full opacity-90 transition hover:opacity-100 ${className}`} style={{ height }} />; }
function Legend({ label, className }: { label: string; className: string }) { return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${className}`} />{label}</span>; }
function SummaryPill({ label, value, tone }: { label: string; value: number; tone: "positive" | "negative" }) { return <div className="rounded-2xl border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={tone === "positive" ? "mt-1 font-bold text-emerald-600" : "mt-1 font-bold text-red-600"}>{formatCurrency(value)}</p></div>; }
