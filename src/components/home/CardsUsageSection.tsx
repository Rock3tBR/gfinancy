import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDashboardDate, type DashboardSummary } from "@/hooks/use-dashboard-summary";
import { CreditCard, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

type Props = { summary: DashboardSummary };

export function CardsUsageSection({ summary }: Props) {
  const navigate = useNavigate();
  const cards = summary.cardsUsage;
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5 text-primary" />Uso por cartão</CardTitle><Button type="button" variant="outline" size="sm" className="rounded-2xl" onClick={() => navigate({ to: "/cartoes" })}><Plus className="mr-2 h-4 w-4" />Cartão</Button></div></CardHeader>
      <CardContent>{cards.length === 0 ? <div className="rounded-3xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Nenhum cartão cadastrado. Adicione um cartão para acompanhar limite, fatura e vencimentos.</div> : <div className="grid gap-4 md:grid-cols-2">{cards.map((card) => <div key={card.id} className="rounded-3xl border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-foreground">{card.name}{card.lastDigits ? ` • final ${card.lastDigits}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{card.brand || "Cartão"} · vence {formatDashboardDate(card.dueDate)}</p></div><Badge variant="outline" className="rounded-full">{card.status}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniMetric label="Fatura atual" value={formatCurrency(card.invoiceAmount)} /><MiniMetric label="Disponível" value={formatCurrency(card.available)} /><MiniMetric label="Limite" value={formatCurrency(card.limit)} /></div><div className="mt-4"><div className="flex justify-between text-xs text-muted-foreground"><span>Limite usado</span><span>{card.usagePercentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={card.usagePercentage >= 85 ? "h-full rounded-full bg-red-500" : card.usagePercentage >= 65 ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-primary"} style={{ width: `${card.usagePercentage}%` }} /></div></div></div>)}</div>}</CardContent>
    </Card>
  );
}
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-card px-3 py-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold text-foreground">{value}</p></div>; }
