import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { brl } from "@/lib/format";
import { PieChartIcon } from "lucide-react";

type Item = {
  name: string;
  value: number;
};

type Props = {
  data: Item[];
};

const COLORS = [
  "#4f46e5",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
];

function darkenColor(hex: string, amount: number) {
  let color = hex.replace("#", "");

  if (color.length === 3) {
    color = color
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const num = parseInt(color, 16);

  let r = (num >> 16) - amount;
  let g = ((num >> 8) & 0x00ff) - amount;
  let b = (num & 0x0000ff) - amount;

  r = Math.max(0, r);
  g = Math.max(0, g);
  b = Math.max(0, b);

  return `rgb(${r}, ${g}, ${b})`;
}

function tooltipStyle() {
  return {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 16,
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 20px 40px rgba(15,23,42,0.10)",
  };
}

export function CategoryDonut3D({ data }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const isEmpty = data.length === 0 || total <= 0;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border bg-card shadow-sm">
      <CardHeader className="shrink-0 border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Gastos por categoria</CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Distribuição visual com destaque nas categorias mais relevantes.
            </p>
          </div>

          <div className="rounded-2xl bg-muted p-2">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[1.05fr_0.95fr]">
        {isEmpty ? (
          <div className="col-span-full grid h-full min-h-[220px] place-items-center rounded-3xl border border-dashed bg-muted/30 text-center">
            <div>
              <PieChartIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">
                Nenhuma categoria para exibir
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre gastos com categoria para montar o gráfico.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {[57, 55, 53, 51].map((cy, layerIndex) => (
                    <Pie
                      key={cy}
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy={`${cy}%`}
                      innerRadius="42%"
                      outerRadius="70%"
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {data.map((_, index) => (
                        <Cell
                          key={`${layerIndex}-${index}`}
                          fill={darkenColor(
                            COLORS[index % COLORS.length],
                            28 + layerIndex * 8
                          )}
                        />
                      ))}
                    </Pie>
                  ))}

                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="49%"
                    innerRadius="43%"
                    outerRadius="70%"
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={4}
                  >
                    {data.map((_, index) => (
                      <Cell
                        key={`top-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    contentStyle={tooltipStyle()}
                    formatter={(value) => brl(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-background/85 px-5 py-4 text-center shadow-sm backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total
                  </div>

                  <div className="mt-1 text-lg font-bold text-foreground">
                    {brl(total)}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
              {data.map((item, index) => {
                const percent = total > 0 ? (item.value / total) * 100 : 0;

                return (
                  <div
                    key={item.name}
                    className="rounded-2xl border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />

                          <span className="truncate text-sm font-medium">
                            {item.name}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {percent.toFixed(1).replace(".", ",")}% do total
                        </div>
                      </div>

                      <div className="text-right text-sm font-semibold">
                        {brl(item.value)}
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}