import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Calculator,
  Check,
  FileText,
  Gauge,
  List,
  Pencil,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type CustomWidgetType =
  | "kpi"
  | "progress"
  | "text"
  | "list"
  | "calculator";

export type CustomWidgetPeriod =
  | "current_month"
  | "last_30_days"
  | "current_year"
  | "all";

export type CustomWidgetAggregation =
  | "sum"
  | "count"
  | "average";

export type CustomWidgetConfig = {
  source?: "transactions" | "invoices" | "cards";
  aggregation?: CustomWidgetAggregation;
  transactionType?: "all" | "entrada" | "debito" | "credito";
  category?: string;
  period?: CustomWidgetPeriod;
  target?: number;
  value?: number;
  content?: string;
  items?: string[];
  prefix?: string;
  suffix?: string;
};

export type CustomWidgetRow = {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  description: string | null;
  widget_type: CustomWidgetType;
  icon: string;
  color: string;
  config: CustomWidgetConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TransactionLike = {
  tipo: "entrada" | "debito" | "credito";
  categoria: string | null;
  valor_total: number;
  data_compra: string;
};

type CardLike = { limite: number };
type InstallmentLike = { card_id: string; fatura_mes: string; valor: number };
type InvoiceLike = { card_id: string; fatura_mes: string; paid_at: string | null };

type CustomHomeWidgetProps = {
  widget: CustomWidgetRow;
  transactions: TransactionLike[];
  cards: CardLike[];
  installments: InstallmentLike[];
  invoices: InvoiceLike[];
};

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodRange(period: CustomWidgetPeriod) {
  const today = new Date();

  if (period === "all") return { start: "0000-01-01", end: "9999-12-31" };
  if (period === "current_year") {
    return {
      start: `${today.getFullYear()}-01-01`,
      end: `${today.getFullYear()}-12-31`,
    };
  }
  if (period === "last_30_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { start: ymd(start), end: ymd(today) };
  }

  return {
    start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
    end: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

function aggregate(values: number[], aggregation: CustomWidgetAggregation) {
  if (aggregation === "count") return values.length;
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return aggregation === "average" ? total / values.length : total;
}

function getIcon(icon: string) {
  if (icon === "bar-chart") return BarChart3;
  if (icon === "gauge") return Gauge;
  if (icon === "target") return Target;
  if (icon === "sparkles") return Sparkles;
  if (icon === "list") return List;
  if (icon === "file-text") return FileText;
  if (icon === "calculator") return Calculator;
  return TrendingUp;
}

function formatValue(value: number, prefix?: string, suffix?: string) {
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return [prefix?.trim(), formatted, suffix?.trim()].filter(Boolean).join(" ");
}

function getCalculatedValue({ widget, transactions, cards, installments, invoices }: CustomHomeWidgetProps) {
  const config = widget.config ?? {};
  const source = config.source ?? "transactions";
  const aggregation = config.aggregation ?? "sum";
  const range = getPeriodRange(config.period ?? "current_month");

  if (source === "cards") {
    return aggregate(cards.map((card) => Number(card.limite || 0)), aggregation);
  }

  if (source === "invoices") {
    const invoiceByKey = new Map(
      invoices.map((invoice) => [`${invoice.card_id}|${invoice.fatura_mes}`, invoice]),
    );
    const values = installments
      .filter((item) => item.fatura_mes >= range.start && item.fatura_mes <= range.end)
      .filter((item) => !invoiceByKey.get(`${item.card_id}|${item.fatura_mes}`)?.paid_at)
      .map((item) => Number(item.valor || 0));
    return aggregate(values, aggregation);
  }

  const transactionType = config.transactionType ?? "all";
  const category = config.category?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const values = transactions
    .filter((item) => item.data_compra >= range.start && item.data_compra <= range.end)
    .filter((item) => transactionType === "all" || item.tipo === transactionType)
    .filter((item) => !category || item.categoria?.trim().toLocaleLowerCase("pt-BR") === category)
    .map((item) => Number(item.valor_total || 0));

  return aggregate(values, aggregation);
}

function tokenize(expression: string) {
  const normalized = expression.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/");
  const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== normalized.replace(/\s/g, "")) throw new Error("Expressão inválida");
  return tokens;
}

function calculateExpression(expression: string) {
  const tokens = tokenize(expression);
  let index = 0;

  function parseExpression(): number {
    let value = parseTerm();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = parseFactor();
      if (operator === "/" && right === 0) throw new Error("Divisão por zero");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseFactor(): number {
    const token = tokens[index++];
    if (token === "-") return -parseFactor();
    if (token === "+") return parseFactor();
    if (token === "(") {
      const value = parseExpression();
      if (tokens[index++] !== ")") throw new Error("Parênteses inválidos");
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Expressão inválida");
    return value;
  }

  if (!tokens.length) return 0;
  const result = parseExpression();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Expressão inválida");
  return result;
}

function EditableNote({ widget }: { widget: CustomWidgetRow }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(widget.config?.content ?? "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = { ...(widget.config ?? {}), content };
      const { error } = await (supabase as any)
        .from("custom_widgets")
        .update({ config, updated_at: new Date().toISOString() })
        .eq("id", widget.id)
        .eq("user_id", widget.user_id)
        .eq("entity_id", widget.entity_id);
      if (error) throw error;
      return config;
    },
    onSuccess: async () => {
      toast.success("Nota atualizada");
      setEditing(false);
      await queryClient.invalidateQueries({
        queryKey: ["custom-widgets", widget.user_id, widget.entity_id],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (editing) {
    return (
      <div className="relative mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escreva sua nota..."
          className="min-h-[110px] flex-1 resize-none rounded-2xl border-white/10 bg-white/[0.04] text-sm leading-6 text-white placeholder:text-white/25"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setContent(widget.config?.content ?? "");
              setEditing(false);
            }}
            disabled={saveMutation.isPending}
            className="rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="rounded-full bg-[#D9FF66] font-bold text-[#151515] hover:bg-[#caff3d]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group/note flex min-h-[100px] flex-1 flex-col rounded-2xl border border-transparent p-3 text-left transition hover:border-white/10 hover:bg-white/[0.03]"
      >
        <div className="whitespace-pre-wrap text-sm leading-7 text-white/70">
          {content || "Clique para escrever uma nota."}
        </div>
        <span className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-white/30 transition group-hover/note:text-white/55">
          <Pencil className="h-3.5 w-3.5" />
          Clique para editar
        </span>
      </button>
    </div>
  );
}

function CalculatorWidget({ color }: { color: string }) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [hasError, setHasError] = useState(false);

  const keys = useMemo(
    () => ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "0", ",", "⌫", "="],
    [],
  );

  function press(key: string) {
    if (key === "C") {
      setExpression("");
      setResult("0");
      setHasError(false);
      return;
    }
    if (key === "⌫") {
      setExpression((current) => current.slice(0, -1));
      setHasError(false);
      return;
    }
    if (key === "=") {
      try {
        const value = calculateExpression(expression);
        setResult(value.toLocaleString("pt-BR", { maximumFractionDigits: 8 }));
        setHasError(false);
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Erro");
        setHasError(true);
      }
      return;
    }
    setExpression((current) => `${current}${key}`);
    setHasError(false);
  }

  return (
    <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-right">
        <div className="h-5 truncate text-xs text-white/35">{expression || "0"}</div>
        <div className={`mt-1 truncate text-2xl font-black ${hasError ? "text-red-400" : "text-white"}`}>{result}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {keys.map((key) => {
          const operator = ["÷", "×", "-", "+", "="].includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className="flex h-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.045] text-sm font-bold text-white/75 transition hover:bg-white/[0.09] active:scale-95"
              style={operator ? { color, borderColor: `${color}35`, backgroundColor: `${color}12` } : undefined}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CustomHomeWidget(props: CustomHomeWidgetProps) {
  const { widget } = props;
  const config = widget.config ?? {};
  const Icon = getIcon(widget.icon);
  const value = getCalculatedValue(props);
  const target = Math.max(0, Number(config.target ?? 0));
  const progress = target > 0 ? Math.min(100, (value / target) * 100) : 0;

  return (
    <Card className="h-full overflow-hidden rounded-[28px] border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="h-1" style={{ backgroundColor: widget.color }} />
      <CardContent className="relative flex h-full min-h-0 flex-col p-5">
        <div className="pointer-events-none absolute right-[-30px] top-[-30px] h-28 w-28 rounded-full blur-3xl" style={{ backgroundColor: `${widget.color}25` }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-black">{widget.name}</h3>
            {widget.description && <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/45">{widget.description}</p>}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border" style={{ color: widget.color, borderColor: `${widget.color}35`, backgroundColor: `${widget.color}14` }}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {widget.widget_type === "kpi" && (
          <div className="relative mt-auto pt-5">
            <p className="text-3xl font-black tracking-tight" style={{ color: widget.color }}>{formatValue(value, config.prefix, config.suffix)}</p>
            <p className="mt-2 text-xs text-white/40">Atualizado com os dados da entidade</p>
          </div>
        )}

        {widget.widget_type === "progress" && (
          <div className="relative mt-auto pt-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-black" style={{ color: widget.color }}>{formatValue(value, config.prefix, config.suffix)}</p>
                <p className="mt-1 text-xs text-white/40">de {formatValue(target, config.prefix, config.suffix)}</p>
              </div>
              <span className="text-lg font-black">{progress.toFixed(0)}%</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: widget.color }} />
            </div>
          </div>
        )}

        {widget.widget_type === "text" && <EditableNote widget={widget} />}

        {widget.widget_type === "list" && (
          <div className="relative mt-4 min-h-0 space-y-2 overflow-y-auto pr-1">
            {(config.items ?? []).length === 0 ? (
              <p className="text-sm text-white/40">Nenhum item cadastrado.</p>
            ) : (
              config.items?.map((item, index) => (
                <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-[#151515]" style={{ backgroundColor: widget.color }}>{index + 1}</span>
                  <span className="truncate text-sm text-white/70">{item}</span>
                </div>
              ))
            )}
          </div>
        )}

        {widget.widget_type === "calculator" && <CalculatorWidget color={widget.color} />}
      </CardContent>
    </Card>
  );
}
