import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardPeriod, DashboardSummary } from "@/hooks/use-dashboard-summary";
import { BarChart3, CreditCard, FileUp, Plus, ReceiptText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";

type Props = { summary: DashboardSummary; period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void };

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "current_year", label: "Ano atual" },
];

export function DashboardHeader({ summary, period, onPeriodChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Fernando";
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Dashboard executivo
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Olá, {name} 👋</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Aqui está o resumo da sua vida financeira em <span className="font-semibold text-foreground">{summary.entityName}{summary.entityType ? ` · ${summary.entityType}` : ""}</span>.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          <Select value={period} onValueChange={(value) => onPeriodChange(value as DashboardPeriod)}>
            <SelectTrigger className="h-11 rounded-2xl sm:w-[190px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>{PERIOD_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate({ to: "/transacoes" })}><Plus className="mr-2 h-4 w-4" />Transação</Button>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate({ to: "/transacoes" })}><FileUp className="mr-2 h-4 w-4" />Fatura</Button>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate({ to: "/cartoes" })}><CreditCard className="mr-2 h-4 w-4" />Cartão</Button>
            <Button type="button" className="rounded-2xl" onClick={() => navigate({ to: "/relatorios" })}><ReceiptText className="mr-2 h-4 w-4" />Relatório</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
