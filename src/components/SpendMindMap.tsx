import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { brl, ptDate } from "@/lib/format";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  ReceiptText,
  Sparkles,
} from "lucide-react";

export type SpendMindMapItem = {
  id?: string;
  description: string;
  value: number;
  finalidade?: string;
  date?: string;
};

export type SpendMindMapGroup = {
  category: string;
  total: number;
  color?: string;
  items: SpendMindMapItem[];
};

type SpendMindMapProps = {
  title?: string;
  rootLabel: string;
  subtitle?: string;
  invoiceLabel?: string;
  groups: SpendMindMapGroup[];
  onSelectItem?: (item: SpendMindMapItem) => void;
};

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

function compactText(value: string, max = 32) {
  if (!value) return "Sem descrição";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function getPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, (value / total) * 100);
}

export function SpendMindMap({
  title = "Mapa mental de gastos",
  rootLabel,
  subtitle,
  invoiceLabel,
  groups,
  onSelectItem,
}: SpendMindMapProps) {
  const sortedGroups = useMemo(() => {
    return groups
      .filter((group) => group.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((group, index) => ({
        ...group,
        color: group.color ?? COLORS[index % COLORS.length],
        items: group.items
          .slice()
          .sort((a, b) => Number(b.value) - Number(a.value))
          .slice(0, 6),
      }));
  }, [groups]);

  const total = useMemo(() => {
    return sortedGroups.reduce((sum, group) => sum + Number(group.total), 0);
  }, [sortedGroups]);

  const biggestGroup = sortedGroups[0];

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Visualização inteligente
          </div>

          <h2 className="text-xl font-bold text-foreground">{title}</h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {subtitle ??
              "Veja como os gastos se ramificam por cartão, fatura, categoria e lançamento."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-72">
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Total analisado</p>
            <p className="mt-1 font-bold text-foreground">{brl(total)}</p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Maior categoria</p>
            <p className="mt-1 truncate font-bold text-foreground">
              {biggestGroup?.category ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <ReceiptText className="h-7 w-7 text-muted-foreground" />
          </div>

          <h3 className="mt-4 font-semibold text-foreground">
            Nenhum gasto para montar o mapa
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Ajuste os filtros de cartão, fatura ou período para visualizar as
            ramificações.
          </p>
        </div>
      ) : (
        <div className="p-5">
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <div className="relative">
              <div className="sticky top-24 rounded-3xl border border-border bg-muted/40 p-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <CreditCard className="h-7 w-7" />
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Origem dos gastos
                </p>

                <h3 className="mt-2 text-2xl font-bold text-foreground">
                  {rootLabel}
                </h3>

                {invoiceLabel && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {invoiceLabel}
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    {brl(total)}
                  </p>
                </div>

                <div className="mt-5 space-y-2">
                  {sortedGroups.slice(0, 5).map((group) => (
                    <div key={group.category}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-muted-foreground">
                          {group.category}
                        </span>
                        <span className="font-semibold text-foreground">
                          {getPercent(group.total, total).toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${getPercent(group.total, total)}%`,
                            backgroundColor: group.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {sortedGroups.map((group, groupIndex) => (
                <div
                  key={group.category}
                  className="relative rounded-3xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="absolute -left-6 top-8 hidden h-px w-6 bg-border xl:block" />

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{
                          backgroundColor: group.color,
                        }}
                      >
                        {String(groupIndex + 1).padStart(2, "0")}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-bold text-foreground">
                            {group.category}
                          </h3>

                          <Badge variant="secondary">
                            {getPercent(group.total, total).toFixed(0)}% do
                            total
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {group.items.length} lançamento(s) principais
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-right">
                      <p className="text-xs text-muted-foreground">
                        Total da categoria
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        {brl(group.total)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {group.items.map((item, itemIndex) => (
                      <button
                        key={`${group.category}-${item.description}-${itemIndex}`}
                        type="button"
                        onClick={() => onSelectItem?.(item)}
                        className="group grid gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-left transition hover:bg-muted/60 md:grid-cols-[1fr_auto]"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground">
                            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {compactText(item.description, 48)}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {item.date && <span>{ptDate(item.date)}</span>}

                              {item.finalidade && (
                                <span className="rounded-full border border-border bg-card px-2 py-0.5">
                                  {compactText(item.finalidade, 28)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 md:justify-end">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${getPercent(item.value, group.total)}%`,
                                backgroundColor: group.color,
                              }}
                            />
                          </div>

                          <p className="min-w-24 text-right text-sm font-bold text-foreground">
                            {brl(item.value)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}