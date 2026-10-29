import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { usePlan } from "@/hooks/use-plan";
import { formatLimit } from "@/lib/plans";
import { FinancialEntitySelector } from "@/components/FinancialEntitySelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl } from "@/lib/format";
import { ymd, firstDayOfMonth, lastDayOfMonth } from "@/lib/fatura";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Filter,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/categorias")({
  component: CategoriasPage,
});

type Category = {
  id: string;
  user_id: string;
  entity_id: string | null;
  nome: string;
  cor: string;
  keywords: string[];
  monthly_budget?: number | null;
};

type Tx = {
  entity_id: string | null;
  tipo: string;
  categoria: string | null;
  valor_total: number;
  data_compra: string;
};

type PeriodFilter = "current_month" | "last_month" | "year";

type CategoryStatus = "saudavel" | "atencao" | "excedido" | "sem_orcamento";

const CORES = [
  "#D9FF66",
  "#A88BFF",
  "#2ECC71",
  "#3BA3FF",
  "#FF4D5E",
  "#F59E0B",
  "#EC4899",
  "#111827",
];

function parseMoney(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized || 0);

  if (!Number.isFinite(parsed)) return 0;

  return parsed;
}

function getPeriodRange(period: PeriodFilter) {
  const today = new Date();

  if (period === "last_month") {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    return {
      from: ymd(firstDayOfMonth(lastMonth)),
      to: ymd(lastDayOfMonth(lastMonth)),
      label: "Mês anterior",
    };
  }

  if (period === "year") {
    return {
      from: `${today.getFullYear()}-01-01`,
      to: `${today.getFullYear()}-12-31`,
      label: "Ano atual",
    };
  }

  return {
    from: ymd(firstDayOfMonth(today)),
    to: ymd(lastDayOfMonth(today)),
    label: "Mês atual",
  };
}

function getStatus(spent: number, budget: number): CategoryStatus {
  if (budget <= 0) return "sem_orcamento";
  if (spent > budget) return "excedido";

  const percent = (spent / budget) * 100;

  if (percent >= 80) return "atencao";

  return "saudavel";
}

function getStatusBadge(status: CategoryStatus) {
  const config: Record<
    CategoryStatus,
    {
      label: string;
      className: string;
      icon?: typeof CheckCircle2;
    }
  > = {
    saudavel: {
      label: "Saudável",
      className:
        "border border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#2ECC71] hover:bg-[#2ECC71]/10",
      icon: CheckCircle2,
    },
    atencao: {
      label: "Atenção",
      className:
        "border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/10",
      icon: AlertTriangle,
    },
    excedido: {
      label: "Excedido",
      className:
        "border border-[#FF4D5E]/20 bg-[#FF4D5E]/10 text-[#FF4D5E] hover:bg-[#FF4D5E]/10",
      icon: AlertTriangle,
    },
    sem_orcamento: {
      label: "Sem orçamento",
      className: "border border-white/10 bg-white/[0.045] text-white/55",
    },
  };

  const item = config[status];
  const Icon = item.icon;

  return (
    <Badge className={`gap-1 rounded-full ${item.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {item.label}
    </Badge>
  );
}

function getRiskLabel(status: CategoryStatus) {
  if (status === "excedido") return "Alto";
  if (status === "atencao") return "Médio";
  if (status === "sem_orcamento") return "N/A";

  return "Baixo";
}

function getRiskClass(status: CategoryStatus) {
  if (status === "excedido") return "text-[#FF4D5E]";
  if (status === "atencao") return "text-amber-400";
  if (status === "sem_orcamento") return "text-white/55";

  return "text-[#2ECC71]";
}

function sanitizeCsvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""').replace(/;/g, ",")}"`;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 120;
  const height = 46;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const points = values.map((value, index) => {
    const x =
      values.length === 1 ? width : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;

    return `${x},${y}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-28"
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategoriasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getLimit, reachedLimit, canUse, openUpgrade } = usePlan();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("current_month");

  const periodRange = useMemo(() => getPeriodRange(period), [period]);
  const maxCategories = getLimit("maxCategories");

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as Category[];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["txs-cat", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("entity_id,tipo,categoria,valor_total,data_compra")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Tx[];
    },
  });

  const categoryStats = useMemo(() => {
    return categories.map((category) => {
      const allExpenses = txs.filter(
        (transaction) =>
          transaction.tipo !== "entrada" &&
          (transaction.categoria ?? "") === category.nome
      );

      const periodExpenses = allExpenses.filter(
        (transaction) =>
          transaction.data_compra >= periodRange.from &&
          transaction.data_compra <= periodRange.to
      );

      const spentTotal = allExpenses.reduce(
        (sum, transaction) => sum + Number(transaction.valor_total),
        0
      );

      const spentPeriod = periodExpenses.reduce(
        (sum, transaction) => sum + Number(transaction.valor_total),
        0
      );

      const budget = Number(category.monthly_budget ?? 0);
      const percent =
        budget > 0 ? Math.min(100, (spentPeriod / budget) * 100) : 0;
      const remaining = budget - spentPeriod;
      const status = getStatus(spentPeriod, budget);

      const monthlyTrend = Array.from({ length: 6 }).map((_, index) => {
        const base = new Date();
        const current = new Date(
          base.getFullYear(),
          base.getMonth() - (5 - index),
          1
        );
        const from = ymd(firstDayOfMonth(current));
        const to = ymd(lastDayOfMonth(current));

        return allExpenses
          .filter(
            (transaction) =>
              transaction.data_compra >= from && transaction.data_compra <= to
          )
          .reduce(
            (sum, transaction) => sum + Number(transaction.valor_total),
            0
          );
      });

      return {
        category,
        spentTotal,
        spentPeriod,
        budget,
        percent,
        remaining,
        status,
        monthlyTrend,
        transactionsCount: periodExpenses.length,
      };
    });
  }, [categories, txs, periodRange]);

  const filteredStats = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) return categoryStats;

    return categoryStats.filter(({ category }) => {
      return (
        category.nome.toLowerCase().includes(normalized) ||
        category.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(normalized)
        )
      );
    });
  }, [categoryStats, search]);

  const totals = useMemo(() => {
    const budgetTotal = categoryStats.reduce(
      (sum, item) => sum + item.budget,
      0
    );

    const spentTotal = categoryStats.reduce(
      (sum, item) => sum + item.spentPeriod,
      0
    );

    const alertCategories = categoryStats.filter(
      (item) => item.status === "atencao" || item.status === "excedido"
    ).length;

    return {
      categories: categories.length,
      budgetTotal,
      spentTotal,
      alertCategories,
      percentUsed:
        budgetTotal > 0 ? Math.min(100, (spentTotal / budgetTotal) * 100) : 0,
    };
  }, [categories.length, categoryStats]);

  const deleteCategory = useMutation({
    mutationFn: async (category: Category) => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      const confirmed = window.confirm(
        `Deseja excluir a categoria "${category.nome}"?`
      );

      if (!confirmed) return;

      const { error } = await (supabase as any)
        .from("categories")
        .delete()
        .eq("id", category.id)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Categoria removida");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["txs-cat"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleCreateCategory() {
    if (reachedLimit("maxCategories", categories.length)) {
      openUpgrade(
        `Seu plano permite até ${formatLimit(maxCategories)} categorias. Faça upgrade para cadastrar mais.`
      );
      return;
    }

    setCreating(true);
  }

  function exportCSV() {
    if (!canUse("csvExport")) {
      openUpgrade(undefined, "csvExport");
      return;
    }
    const entityName = selectedEntity?.name ?? "entidade";

    const header = [
      "Entidade",
      "Categoria",
      "Status",
      "Orçamento",
      "Gasto no período",
      "Disponível",
      "% utilizado",
      "Risco",
      "Palavras-chave",
    ];

    const csv = [
      header.map(sanitizeCsvCell).join(";"),
      ...categoryStats.map((item) =>
        [
          entityName,
          item.category.nome,
          item.status,
          item.budget.toFixed(2).replace(".", ","),
          item.spentPeriod.toFixed(2).replace(".", ","),
          item.remaining.toFixed(2).replace(".", ","),
          `${item.percent.toFixed(1)}%`,
          getRiskLabel(item.status),
          item.category.keywords?.join(", ") ?? "",
        ]
          .map(sanitizeCsvCell)
          .join(";")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `categorias_${entityName}_${periodRange.from}_${periodRange.to}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  if (entityLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1A]/88 px-4 py-3 text-sm text-white/60 shadow-sm">
          Carregando entidade financeira...
        </div>
      </div>
    );
  }

  if (!selectedEntityId || !selectedEntity) {
    return (
      <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

            <div>
              <h2 className="font-semibold text-white">
                Nenhuma entidade financeira selecionada
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/60">
                Selecione uma entidade para visualizar e cadastrar categorias.
              </p>
            </div>
          </div>

          <div className="w-full sm:min-w-[260px] sm:w-auto">
            <FinancialEntitySelector />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="ge-mobile-toolbar flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="ge-mobile-toolbar-entity w-full sm:w-[260px]">
          <FinancialEntitySelector />
        </div>

        <Button
          type="button"
          variant="outline"
          className={[
            "h-10 rounded-full px-5 font-bold transition",
            filtersOpen
              ? "border-[#D9FF66]/35 bg-[#D9FF66]/15 text-[#D9FF66]"
              : "border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
          ].join(" ")}
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>

        <Button
          type="button"
          className="h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
          onClick={handleCreateCategory}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova categoria
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
          onClick={exportCSV}
          disabled={categoryStats.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </section>

      {filtersOpen && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
            <div>
              <Label className="text-xs text-white/55">Buscar categoria</Label>

              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/38" />

                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome ou palavra-chave..."
                  className="h-10 rounded-full border-white/10 bg-white/[0.045] pl-9 text-white placeholder:text-white/35"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-white/55">Período</Label>

              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as PeriodFilter)}
              >
                <SelectTrigger className="mt-1 h-10 rounded-full border-white/10 bg-white/[0.045] text-white">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="current_month">Mês atual</SelectItem>
                  <SelectItem value="last_month">Mês anterior</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Total de categorias</p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-3xl font-black text-white">
                {totals.categories}
              </p>

              <span className="text-xs font-bold text-[#2ECC71]">
                {categories.length > 0 ? "+ ativo" : "sem dados"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Orçamento total</p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-black text-white">
                {brl(totals.budgetTotal)}
              </p>

              <span className="text-xs font-bold text-[#D9FF66]">
                {totals.percentUsed.toFixed(0)}% usado
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Gasto no período</p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-black text-white">
                {brl(totals.spentTotal)}
              </p>

              <TrendingUp className="h-5 w-5 text-[#2ECC71]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Categorias em alerta</p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p
                className={[
                  "text-3xl font-black",
                  totals.alertCategories > 0
                    ? "text-[#FF4D5E]"
                    : "text-[#2ECC71]",
                ].join(" ")}
              >
                {totals.alertCategories}
              </p>

              <AlertTriangle className="h-5 w-5 text-[#FF4D5E]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {categoriesLoading ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-14 text-center text-sm text-white/60">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Carregando categorias...
          </CardContent>
        </Card>
      ) : filteredStats.length === 0 ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.045]">
              <Tag className="h-7 w-7 text-white/50" />
            </div>

            <h3 className="mt-4 font-semibold text-white">
              Nenhuma categoria encontrada em {selectedEntity.name}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
              Crie categorias para organizar gastos, definir orçamentos e
              melhorar a análise das faturas.
            </p>

            <Button
              type="button"
              onClick={handleCreateCategory}
              className="mt-5 rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStats.map((item) => {
            const statusColor =
              item.status === "excedido"
                ? "#FF4D5E"
                : item.status === "atencao"
                  ? "#F59E0B"
                  : item.status === "saudavel"
                    ? "#2ECC71"
                    : "#D9FF66";

            return (
              <Card
                key={item.category.id}
                className="group overflow-hidden border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 hover:border-[#D9FF66]/30 hover:shadow-[0_24px_90px_rgba(0,0,0,0.34)]"
              >
                <CardContent className="p-0">
                  <div className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                          style={{
                            backgroundColor: `${item.category.cor}22`,
                            color: item.category.cor,
                            boxShadow: `0 0 24px ${item.category.cor}22`,
                          }}
                        >
                          <Tag className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-black text-white">
                            {item.category.nome}
                          </h3>

                          <div className="mt-1">{getStatusBadge(item.status)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-white/45 hover:bg-white/[0.06] hover:text-[#D9FF66]"
                          onClick={() => setEditing(item.category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-white/45 hover:bg-[#FF4D5E]/10 hover:text-[#FF4D5E]"
                          disabled={deleteCategory.isPending}
                          onClick={() => deleteCategory.mutate(item.category)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <MoreVertical className="h-4 w-4 text-white/30" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/45">Orçamento</span>

                        <span className="font-bold text-white">
                          {item.budget > 0 ? brl(item.budget) : "Não definido"}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: statusColor,
                            boxShadow: `0 0 18px ${statusColor}55`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-white/45">
                        <span>{item.percent.toFixed(0)}% utilizado</span>

                        <span
                          className={
                            item.remaining < 0
                              ? "text-[#FF4D5E]"
                              : "text-[#2ECC71]"
                          }
                        >
                          {item.budget > 0
                            ? item.remaining >= 0
                              ? `Sobra ${brl(item.remaining)}`
                              : `Excesso ${brl(Math.abs(item.remaining))}`
                            : "Sem meta"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between border-t border-white/10 pt-4">
                      <div>
                        <p className="text-xs font-semibold text-white/45">
                          Gasto no período
                        </p>

                        <p className="mt-1 text-2xl font-black text-white">
                          {brl(item.spentPeriod)}
                        </p>

                        <p className="text-xs text-white/42">
                          {item.transactionsCount} transação(ões)
                        </p>
                      </div>

                      <Sparkline
                        values={item.monthlyTrend}
                        color={item.category.cor}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.025] px-5 py-3">
                    <span className="text-xs font-medium text-white/42">
                      Total histórico: {brl(item.spentTotal)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setEditing(item.category)}
                      className="text-xs font-bold text-[#D9FF66] hover:underline"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <Card className="overflow-hidden border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.20)]">
        <CardContent className="p-0">
          <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black text-white">
                Histórico de alocação por categoria
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Comparativo de orçamento, gasto, disponibilidade e risco de{" "}
                {selectedEntity.name}.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="rounded-full border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
              onClick={exportCSV}
              disabled={categoryStats.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="whitespace-nowrap p-4 text-left font-semibold">
                    Categoria
                  </th>
                  <th className="hidden whitespace-nowrap p-4 text-left font-semibold sm:table-cell">
                    Status
                  </th>
                  <th className="hidden whitespace-nowrap p-4 text-left font-semibold md:table-cell">
                    Orçamento
                  </th>
                  <th className="whitespace-nowrap p-4 text-left font-semibold">
                    Gasto atual
                  </th>
                  <th className="hidden whitespace-nowrap p-4 text-left font-semibold md:table-cell">
                    Disponível
                  </th>
                  <th className="hidden whitespace-nowrap p-4 text-left font-semibold md:table-cell">
                    Risco
                  </th>
                  <th className="whitespace-nowrap p-4 text-right font-semibold">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {categoryStats.map((item) => (
                  <tr
                    key={item.category.id}
                    className="transition-colors hover:bg-white/[0.035]"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.category.cor }}
                        />

                        <span className="font-semibold text-white">
                          {item.category.nome}
                        </span>
                      </div>
                    </td>

                    <td className="hidden p-4 sm:table-cell">{getStatusBadge(item.status)}</td>

                    <td className="hidden p-4 font-medium text-white md:table-cell">
                      {item.budget > 0 ? brl(item.budget) : "—"}
                    </td>

                    <td className="p-4 font-medium text-white">
                      {brl(item.spentPeriod)}
                    </td>

                    <td
                      className={[
                        "hidden p-4 font-semibold md:table-cell",
                        item.remaining < 0
                          ? "text-[#FF4D5E]"
                          : "text-[#2ECC71]",
                      ].join(" ")}
                    >
                      {item.budget > 0 ? brl(item.remaining) : "—"}
                    </td>

                    <td className="hidden p-4 md:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${getRiskClass(
                          item.status
                        )}`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {getRiskLabel(item.status)}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-white/45 hover:bg-white/[0.06] hover:text-[#D9FF66]"
                        onClick={() => setEditing(item.category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {categoryStats.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-10 text-center text-sm text-white/50"
                    >
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 bg-white/[0.025] p-4 text-center">
            <p className="text-xs font-semibold text-white/45">
              Período analisado: {periodRange.label}
            </p>
          </div>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <CategoryDialog
          category={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  category,
  onClose,
}: {
  category: Category | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedEntityId, selectedEntity } = useFinancialEntity();

  const [nome, setNome] = useState(category?.nome ?? "");
  const [cor, setCor] = useState(category?.cor ?? CORES[0]);
  const [budget, setBudget] = useState(
    category?.monthly_budget ? String(category.monthly_budget) : ""
  );
  const [keywords, setKeywords] = useState<string[]>(category?.keywords ?? []);
  const [kwInput, setKwInput] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      if (!nome.trim()) throw new Error("Nome obrigatório.");

      const payload = {
        user_id: user.id,
        entity_id: selectedEntityId,
        nome: nome.trim(),
        cor,
        monthly_budget: parseMoney(budget),
        keywords: keywords.map((keyword) => keyword.trim()).filter(Boolean),
      };

      if (category) {
        const { error } = await (supabase as any)
          .from("categories")
          .update(payload)
          .eq("id", category.id)
          .eq("user_id", user.id)
          .eq("entity_id", selectedEntityId);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("categories")
          .insert(payload);

        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast.success(category ? "Categoria atualizada" : "Categoria criada");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["txs-cat"] });
      onClose();
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function addKeyword() {
    const value = kwInput.trim();

    if (!value) return;

    const alreadyExists = keywords.some(
      (keyword) => keyword.toLowerCase() === value.toLowerCase()
    );

    if (!alreadyExists) {
      setKeywords([...keywords, value]);
    }

    setKwInput("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-md overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#1A1A1A] text-white">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {selectedEntity && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="text-xs text-white/55">
                Categoria será vinculada em
              </div>

              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                {selectedEntity.type === "cnpj" ? (
                  <Building2 className="h-4 w-4 text-white/55" />
                ) : (
                  <UserRound className="h-4 w-4 text-white/55" />
                )}

                {selectedEntity.name} · {selectedEntity.type.toUpperCase()}
              </div>
            </div>
          )}

          <div>
            <Label>Nome</Label>

            <Input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex: Alimentação, Moradia, Transporte..."
              required
            />
          </div>

          <div>
            <Label>Orçamento mensal</Label>

            <Input
              type="number"
              step="0.01"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="Ex: 1200"
            />
          </div>

          <div>
            <Label>Cor</Label>

            <div className="mt-2 flex flex-wrap gap-2">
              {CORES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Selecionar cor ${color}`}
                  onClick={() => setCor(color)}
                  className={[
                    "h-8 w-8 rounded-full transition-all",
                    cor === color
                      ? "ring-2 ring-[#D9FF66] ring-offset-2 ring-offset-[#1A1A1A]"
                      : "",
                  ].join(" ")}
                  style={{ backgroundColor: color }}
                />
              ))}

              <Input
                type="color"
                value={cor}
                onChange={(event) => setCor(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded-full border-border p-1"
              />
            </div>
          </div>

          <div>
            <Label>Palavras-chave</Label>

            <p className="mb-2 mt-1 text-xs leading-5 text-white/55">
              Compras importadas da fatura que contenham essas palavras serão
              classificadas nesta categoria.
            </p>

            <div className="flex gap-2">
              <Input
                value={kwInput}
                onChange={(event) => setKwInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Ex: Uber, 99, iFood..."
              />

              <Button type="button" variant="outline" onClick={addKeyword}>
                Adicionar
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1">
                  {keyword}

                  <button
                    type="button"
                    onClick={() =>
                      setKeywords(
                        keywords.filter((current) => current !== keyword)
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#D9FF66]/15 bg-[#D9FF66]/[0.06] p-4">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 text-[#D9FF66]" />

              <div>
                <p className="text-sm font-semibold text-white">
                  Como o orçamento funciona?
                </p>

                <p className="mt-1 text-xs leading-5 text-white/55">
                  O orçamento mensal é comparado com seus gastos da categoria no
                  período selecionado. Quando passar de 80%, a categoria entra
                  em alerta.
                </p>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={save.isPending} className="w-full rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90">
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <WalletCards className="mr-2 h-4 w-4" />
                Salvar categoria
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
