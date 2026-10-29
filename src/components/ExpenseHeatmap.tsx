import { useMemo } from "react";
import { brl, ptDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Flame,
  MousePointerClick,
  TrendingUp,
} from "lucide-react";

type ExpenseHeatmapItem = {
  date: string;
  entrada: number;
  saida: number;
};

type ExpenseHeatmapProps = {
  items: ExpenseHeatmapItem[];
  from: string;
  to: string;
  onSelectDate?: (date: string) => void;
};

type DayKind = "income" | "expense" | "neutral";

type DayCell = {
  date: string;
  entrada: number;
  saida: number;
  kind: DayKind;
  isInsideRange: boolean;
  month: number;
};

type MonthLabel = {
  label: string;
  column: number;
};

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);

  copy.setDate(copy.getDate() + amount);

  return copy;
}

function getMonthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", {
      month: "short",
    })
    .replace(".", "");
}

function getDayName(date: string) {
  return parseDate(date).toLocaleDateString("pt-BR", {
    weekday: "long",
  });
}

function getIntensity(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;

  const percent = value / max;

  if (percent >= 0.8) return 5;
  if (percent >= 0.6) return 4;
  if (percent >= 0.4) return 3;
  if (percent >= 0.2) return 2;

  return 1;
}

// Dia com saldo positivo (entrada > saída) fica na escala verde; dia com
// saldo negativo (saída > entrada) fica na escala vermelha; sem lançamento
// (ou empate) fica neutro. Cada escala usa sua própria intensidade (1 a 5)
// relativa ao maior dia daquele mesmo tipo, calculada em getIntensity.
function getCellClass(kind: DayKind, intensity: number, isInsideRange: boolean) {
  if (!isInsideRange) {
    return "bg-muted/20 opacity-30";
  }

  if (kind === "neutral" || intensity === 0) {
    return "bg-muted/60 hover:bg-muted";
  }

  if (kind === "income") {
    const classes: Record<number, string> = {
      1: "bg-emerald-500/15 hover:bg-emerald-500/25",
      2: "bg-emerald-500/30 hover:bg-emerald-500/40",
      3: "bg-emerald-500/50 hover:bg-emerald-500/60",
      4: "bg-emerald-500/75 hover:bg-emerald-500/85",
      5: "bg-emerald-500 hover:bg-emerald-400",
    };

    return classes[intensity] ?? classes[1];
  }

  const classes: Record<number, string> = {
    1: "bg-destructive/15 hover:bg-destructive/25",
    2: "bg-destructive/30 hover:bg-destructive/40",
    3: "bg-destructive/50 hover:bg-destructive/60",
    4: "bg-destructive/75 hover:bg-destructive/85",
    5: "bg-destructive hover:bg-destructive/90",
  };

  return classes[intensity] ?? classes[1];
}

function formatCompactMoney(value: number) {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  }

  if (value >= 10_000) {
    return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")} mil`;
  }

  return brl(value);
}

export function ExpenseHeatmap({
  items,
  from,
  to,
  onSelectDate,
}: ExpenseHeatmapProps) {
  const {
    weeks,
    monthLabels,
    maxEntrada,
    maxSaida,
    total,
    activeDays,
    averageActiveDay,
    biggestDay,
  } = useMemo(() => {
    const start = parseDate(from);
    const end = parseDate(to);

    const startGrid = addDays(start, -start.getDay());
    const endGrid = addDays(end, 6 - end.getDay());

    const entradaByDate = new Map<string, number>();
    const saidaByDate = new Map<string, number>();

    for (const item of items) {
      entradaByDate.set(
        item.date,
        (entradaByDate.get(item.date) ?? 0) + (item.entrada || 0)
      );
      saidaByDate.set(
        item.date,
        (saidaByDate.get(item.date) ?? 0) + (item.saida || 0)
      );
    }

    const cells: DayCell[] = [];
    let current = startGrid;

    while (current <= endGrid) {
      const date = ymd(current);
      const entrada = entradaByDate.get(date) ?? 0;
      const saida = saidaByDate.get(date) ?? 0;
      // Dia é classificado pelo que domina: mais saída que entrada = "expense"
      // (vermelho), mais entrada que saída = "income" (verde). Sem
      // lançamento (ou empate) fica neutro.
      const kind: DayKind =
        saida > 0 && saida >= entrada
          ? "expense"
          : entrada > 0 && entrada > saida
            ? "income"
            : "neutral";

      cells.push({
        date,
        entrada,
        saida,
        kind,
        isInsideRange: current >= start && current <= end,
        month: current.getMonth(),
      });

      current = addDays(current, 1);
    }

    const weeksOutput: DayCell[][] = [];

    for (let index = 0; index < cells.length; index += 7) {
      weeksOutput.push(cells.slice(index, index + 7));
    }

    const labels: MonthLabel[] = [];
    let lastMonth: number | null = null;

    weeksOutput.forEach((week, column) => {
      const firstInsideDay = week.find((cell) => cell.isInsideRange);

      if (!firstInsideDay) return;

      const date = parseDate(firstInsideDay.date);

      if (firstInsideDay.month !== lastMonth) {
        labels.push({
          label: getMonthLabel(date),
          column,
        });

        lastMonth = firstInsideDay.month;
      }
    });

    const insideCells = cells.filter((cell) => cell.isInsideRange);

    const maxEntradaValue = insideCells.reduce(
      (highest, cell) => Math.max(highest, cell.entrada),
      0
    );
    const maxSaidaValue = insideCells.reduce(
      (highest, cell) => Math.max(highest, cell.saida),
      0
    );

    const totalSaida = insideCells.reduce((sum, cell) => sum + cell.saida, 0);
    const daysWithExpense = insideCells.filter((cell) => cell.saida > 0);
    const biggest = daysWithExpense
      .slice()
      .sort((a, b) => b.saida - a.saida)[0];

    return {
      weeks: weeksOutput,
      monthLabels: labels,
      maxEntrada: maxEntradaValue,
      maxSaida: maxSaidaValue,
      total: totalSaida,
      activeDays: daysWithExpense.length,
      averageActiveDay:
        daysWithExpense.length > 0 ? totalSaida / daysWithExpense.length : 0,
      biggestDay: biggest ? { date: biggest.date, value: biggest.saida } : null,
    };
  }, [items, from, to]);

  return (
    <Card className="h-full overflow-hidden rounded-3xl border-border bg-card shadow-sm">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
              Mapa de calor
            </div>

            <h2 className="mt-3 text-xl font-bold text-foreground">
              Mapa de calor de gastos
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Cada quadrado representa um dia. Verde = dia com mais entrada
              que saída; vermelho = dia com mais saída que entrada. Quanto
              mais forte a cor, maior o valor naquele dia.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[460px]">
            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Total gasto
              </p>
              <p className="mt-1 truncate text-sm font-bold text-foreground">
                {formatCompactMoney(total)}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Dias com gasto
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {activeDays}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Média por dia
              </p>
              <p className="mt-1 truncate text-sm font-bold text-foreground">
                {formatCompactMoney(averageActiveDay)}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Maior dia
              </p>
              <p className="mt-1 truncate text-sm font-bold text-foreground">
                {biggestDay ? formatCompactMoney(biggestDay.value) : "—"}
              </p>
            </div>
          </div>
        </div>

        {biggestDay && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />

              <div>
                <p className="text-sm font-semibold text-foreground">
                  Dia com maior gasto
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {ptDate(biggestDay.date)} teve{" "}
                  <span className="font-semibold text-foreground">
                    {brl(biggestDay.value)}
                  </span>{" "}
                  em gastos.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-3xl border border-border bg-muted/20 p-4">
          <div className="min-w-max">
            <div className="mb-2 grid grid-cols-[38px_1fr] gap-2">
              <div />

              <div
                className="relative h-5"
                style={{
                  width: `${weeks.length * 18}px`,
                }}
              >
                {monthLabels.map((month) => (
                  <span
                    key={`${month.label}-${month.column}`}
                    className="absolute text-[11px] font-semibold uppercase text-muted-foreground"
                    style={{
                      left: `${month.column * 18}px`,
                    }}
                  >
                    {month.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[38px_1fr] gap-2">
              <div className="grid grid-rows-7 gap-1">
                {WEEK_DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex h-3.5 items-center text-[11px] text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div
                className="grid grid-flow-col grid-rows-7 gap-1"
                style={{
                  gridAutoColumns: "14px",
                }}
              >
                {weeks.flat().map((cell) => {
                  const intensity =
                    cell.kind === "income"
                      ? getIntensity(cell.entrada, maxEntrada)
                      : cell.kind === "expense"
                        ? getIntensity(cell.saida, maxSaida)
                        : 0;

                  const title =
                    cell.entrada > 0 || cell.saida > 0
                      ? [
                          `${getDayName(cell.date)}, ${ptDate(cell.date)}`,
                          cell.entrada > 0 ? `Entrada: ${brl(cell.entrada)}` : null,
                          cell.saida > 0 ? `Saída: ${brl(cell.saida)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" — ")
                      : `${getDayName(cell.date)}, ${ptDate(
                          cell.date
                        )} — sem lançamento`;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      title={title}
                      disabled={!cell.isInsideRange}
                      onClick={() => onSelectDate?.(cell.date)}
                      className={[
                        "h-3.5 w-3.5 rounded-[4px] border border-border/70 transition",
                        "hover:scale-110 hover:ring-2 hover:ring-primary/40",
                        "disabled:pointer-events-none",
                        getCellClass(cell.kind, intensity, cell.isInsideRange),
                      ].join(" ")}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Intensidade baseada no maior valor diário de cada tipo.
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground sm:items-end">
            <div className="flex items-center gap-1.5">
              <span className="mr-0.5">Saída</span>
              <span className="h-3 w-3 rounded-[3px] border border-border bg-muted/60" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-destructive/15" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-destructive/30" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-destructive/50" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-destructive/75" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-destructive" />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="mr-0.5">Entrada</span>
              <span className="h-3 w-3 rounded-[3px] border border-border bg-muted/60" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-emerald-500/15" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-emerald-500/30" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-emerald-500/50" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-emerald-500/75" />
              <span className="h-3 w-3 rounded-[3px] border border-border bg-emerald-500" />
            </div>
          </div>

          {onSelectDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MousePointerClick className="h-3.5 w-3.5" />
              Clique em um dia para filtrar.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}