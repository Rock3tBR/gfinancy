import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { BarChart3 } from "lucide-react";

type ChartItem = {
  label: string;
  entradas: number;
  gastos: number;
  resultado: number;
};

type Props = {
  data: ChartItem[];
};

function tooltipStyle() {
  return {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 16,
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 20px 40px rgba(15,23,42,0.10)",
  };
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
  }

  return brl(value).replace("R$", "R$ ");
}

export function ComparisonFinanceChart({ data }: Props) {
  const isEmpty = data.every(
    (item) => item.entradas === 0 && item.gastos === 0 && item.resultado === 0
  );

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border bg-card shadow-sm">
      <CardHeader className="shrink-0 border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Comparativo financeiro</CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Evolução entre entradas, gastos e resultado.
            </p>
          </div>

          <div className="rounded-2xl bg-muted p-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-4">
        {isEmpty ? (
          <div className="grid h-full min-h-[180px] place-items-center rounded-3xl border border-dashed bg-muted/30 text-center">
            <div>
              <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">
                Nenhuma movimentação ainda
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre transações para visualizar o gráfico.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[220px]">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                Entradas
              </div>

              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                Resultado
              </div>

              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                Gastos
              </div>
            </div>

            <div className="h-[calc(100%-28px)] min-h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="gradEntradasHome"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.36} />
                      <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.02} />
                    </linearGradient>

                    <linearGradient
                      id="gradResultadoHome"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                    </linearGradient>

                    <linearGradient
                      id="gradGastosHome"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    vertical={false}
                    strokeDasharray="4 4"
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    width={64}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    tickFormatter={(value) => compactMoney(Number(value))}
                  />

                  <Tooltip
                    contentStyle={tooltipStyle()}
                    formatter={(value) => brl(Number(value))}
                  />

                  <Area
                    type="monotone"
                    dataKey="entradas"
                    name="Entradas"
                    stroke="#67e8f9"
                    strokeWidth={3}
                    fill="url(#gradEntradasHome)"
                    dot={false}
                    activeDot={{ r: 5 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="resultado"
                    name="Resultado"
                    stroke="#60a5fa"
                    strokeWidth={3}
                    fill="url(#gradResultadoHome)"
                    dot={false}
                    activeDot={{ r: 5 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="gastos"
                    name="Gastos"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fill="url(#gradGastosHome)"
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}