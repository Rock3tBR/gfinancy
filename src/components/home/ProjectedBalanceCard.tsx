import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type DashboardSummary } from "@/hooks/use-dashboard-summary";
import { Calculator, Minus, Plus } from "lucide-react";

type Props = { summary: DashboardSummary };

export function ProjectedBalanceCard({ summary }: Props) {
  const p = summary.projectedBalance;
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-5 w-5 text-primary" />Saldo projetado</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ProjectionLine label="Saldo atual" value={p.currentBalance} type="neutral" />
        <ProjectionLine label="Receitas previstas" value={p.expectedIncome} type="positive" />
        <ProjectionLine label="Faturas abertas" value={p.openInvoices} type="negative" />
        <ProjectionLine label="Contas a pagar" value={p.billsToPay} type="negative" />
        <div className="mt-5 rounded-3xl border bg-muted/40 p-4"><p className="text-sm text-muted-foreground">Saldo projetado</p><p className={`mt-1 text-3xl font-bold ${p.projectedBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(p.projectedBalance)}</p></div>
      </CardContent>
    </Card>
  );
}

function ProjectionLine({ label, value, type }: { label: string; value: number; type: "positive" | "negative" | "neutral" }) {
  const Icon = type === "positive" ? Plus : type === "negative" ? Minus : Calculator;
  const tone = type === "positive" ? "bg-emerald-500/10 text-emerald-600" : type === "negative" ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary";
  return <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background px-4 py-3"><div className="flex items-center gap-2"><div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></div><span className="text-sm text-muted-foreground">{label}</span></div><span className="text-sm font-semibold text-foreground">{formatCurrency(value)}</span></div>;
}
