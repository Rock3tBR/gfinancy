import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { brl, ptDate } from "@/lib/format";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Filter,
  PieChart as PieChartIcon,
  ReceiptText,
  Table2,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import {
  SpendMindMap,
  type SpendMindMapGroup,
} from "@/components/SpendMindMap";
import { ExpenseHeatmap } from "@/components/ExpenseHeatmap";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


type Tx = {
  id: string;
  entity_id: string | null;
  tipo: "entrada" | "debito" | "credito";
  descricao: string;
  categoria: string | null;
  valor_total: number;
  data_compra: string;
  parcelas: number;
  card_id: string | null;
};

type Inst = {
  id: string;
  entity_id: string | null;
  card_id: string;
  fatura_mes: string;
  valor: number;
  transaction_id: string;
};

type CardRow = {
  id: string;
  entity_id: string | null;
  nome: string;
  dia_vencimento: number;
};

type Invoice = {
  id: string;
  entity_id: string | null;
  card_id: string;
  fatura_mes: string;
  paid_at: string | null;
  valor_pago: number | null;
};

type Item = {
  id: string;
  entity_id?: string | null;
  descricao_original: string;
  finalidade: string | null;
  valor: number;
  categoria: string | null;
  data: string;
};

type FaturaStatus =
  | "aberta"
  | "fechada"
  | "vencida"
  | "paga"
  | "parcial"
  | "todas";

type ReportView =
  | "table"
  | "mindmap"
  | "heatmap"
  | "category_bar"
  | "card_bar"
  | "evolution"
  | "donut";

type Row = {
  data: string;
  descricao: string;
  finalidade: string;
  categoria: string;
  cartao: string;
  cardId: string | null;
  valor: number;
  tipo: Tx["tipo"];
  faturaMes: string;
  faturaKey: string;
  faturaLabel: string;
  faturaStatus: string;
};

const CHART_COLORS = [
  "#D9FF66",
  "#A88BFF",
  "#2ECC71",
  "#3BA3FF",
  "#FF4D5E",
  "#C7D2FE",
  "#86EFAC",
  "#FDE68A",
  "#FCA5A5",
  "#67E8F9",
];

type RelatoriosPanelProps = {
  filtersOpen?: boolean;
};

export function RelatoriosPanel({
  filtersOpen = false,
}: RelatoriosPanelProps) {
  return (
    <FeatureGate
      feature="reports"
      reason="Relatórios avançados estão disponíveis no Plano Pro ou Premium."
    >
      <RelatoriosInner filtersOpen={filtersOpen} />
    </FeatureGate>
  );
}

function statusFatura(
  faturaMes: string,
  diaVencimento: number,
  total: number,
  paidAt: string | null,
  valorPago: number,
  today: Date
): Exclude<FaturaStatus, "todas"> {
  if (paidAt && (valorPago <= 0 || valorPago >= total - 0.01)) return "paga";
  if (valorPago > 0 && valorPago < total) return "parcial";

  const [year, month] = faturaMes.split("-").map(Number);
  const vencimento = new Date(year, month - 1, diaVencimento);

  if (today > vencimento) return "vencida";

  const inicioMes = new Date(year, month - 1, 1);

  if (today >= inicioMes) return "fechada";

  return "aberta";
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    aberta: "Aberta",
    fechada: "Fechada",
    vencida: "Vencida",
    paga: "Paga",
    parcial: "Parcial",
    "—": "—",
  };

  return labels[status] ?? status;
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    aberta:
      "border border-blue-500/20 bg-blue-500/10 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400",
    fechada:
      "border border-border bg-muted text-white/55 hover:bg-muted",
    vencida:
      "border border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/10 dark:text-red-400",
    paga:
      "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
    parcial:
      "border border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400",
    "—": "border border-border bg-muted text-white/55 hover:bg-muted",
  };

  return classes[status] ?? classes["—"];
}

function formatFaturaMes(value: string) {
  if (!value || value === "—") return "—";

  const [year, month] = value.split("-");

  if (!year || !month) return value;

  return `${month}/${year}`;
}

function sanitizeCsvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""').replace(/;/g, ",")}"`;
}

function chartCurrency(value: unknown) {
  return brl(Number(value)).replace("R$", "").trim();
}

function tooltipCurrency(value: unknown) {
  return brl(Number(value));
}

function getTooltipStyle() {
  return {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 14,
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 18px 45px hsl(222 47% 11% / 0.18)",
  };
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <div>
        <BarChart3 className="mx-auto h-8 w-8 text-white/55" />

        <p className="mt-3 text-sm font-medium text-white">{message}</p>

        <p className="mt-1 text-xs text-white/55">
          Ajuste os filtros ou cadastre novas transações.
        </p>
      </div>
    </div>
  );
}

function RelatoriosInner({ filtersOpen = false }: RelatoriosPanelProps) {
  const { user } = useAuth();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const today = useMemo(() => new Date(), []);
  const firstOfYear = `${today.getFullYear()}-01-01`;

  const [period, setPeriod] = useState({
    from: firstOfYear,
    to: today.toISOString().slice(0, 10),
  });

  const [categoria, setCategoria] = useState("__all__");
  const [cardId, setCardId] = useState("__all__");
  const [faturaKey, setFaturaKey] = useState("__all__");
  const [minV, setMinV] = useState("");
  const [maxV, setMaxV] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [faturaStatus, setFaturaStatus] = useState<FaturaStatus>("todas");
  const [reportView, setReportView] = useState<ReportView>("table");

  const { data: txs = [] } = useQuery({
    queryKey: ["txs", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Tx[];
    },
  });

  const { data: insts = [] } = useQuery({
    queryKey: ["insts", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("installments")
        .select("id,entity_id,card_id,fatura_mes,valor,transaction_id")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Inst[];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cards")
        .select("id,entity_id,nome,dia_vencimento")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as CardRow[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Invoice[];
    },
  });

  const { data: anItems = [] } = useQuery({
    queryKey: ["all-analysis-items", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_analysis_items")
        .select("id,entity_id,descricao_original,finalidade,valor,categoria,data")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Item[];
    },
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();

    txs.forEach((transaction) => {
      if (transaction.categoria) {
        set.add(transaction.categoria);
      }
    });

    anItems.forEach((item) => {
      if (item.categoria) {
        set.add(item.categoria);
      }
    });

    return Array.from(set).sort();
  }, [txs, anItems]);

  const faturasDisponiveis = useMemo(() => {
    const map = new Map<
      string,
      { cardId: string; faturaMes: string; label: string }
    >();

    for (const installment of insts) {
      if (cardId !== "__all__" && installment.card_id !== cardId) {
        continue;
      }

      const card = cards.find((item) => item.id === installment.card_id);
      const key = `${installment.card_id}|${installment.fatura_mes}`;

      map.set(key, {
        cardId: installment.card_id,
        faturaMes: installment.fatura_mes,
        label: `${card?.nome ?? "Cartão"} — ${formatFaturaMes(
          installment.fatura_mes
        )}`,
      });
    }

    return Array.from(map.entries())
      .map(([key, value]) => ({
        key,
        ...value,
      }))
      .sort((a, b) => b.faturaMes.localeCompare(a.faturaMes));
  }, [insts, cards, cardId]);

  const faturaStatusMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof statusFatura>>();
    const totals = new Map<string, number>();

    for (const installment of insts) {
      const key = `${installment.card_id}|${installment.fatura_mes}`;

      totals.set(key, (totals.get(key) ?? 0) + Number(installment.valor));
    }

    for (const [key, total] of totals) {
      const [currentCardId, currentFaturaMes] = key.split("|");

      const card = cards.find((item) => item.id === currentCardId);
      const invoice = invoices.find(
        (item) =>
          item.card_id === currentCardId &&
          item.fatura_mes === currentFaturaMes
      );

      if (!card) continue;

      map.set(
        key,
        statusFatura(
          currentFaturaMes,
          card.dia_vencimento,
          total,
          invoice?.paid_at ?? null,
          Number(invoice?.valor_pago ?? 0),
          today
        )
      );
    }

    return map;
  }, [insts, invoices, cards, today]);

  const rows: Row[] = useMemo(() => {
    function findFinalidade(transaction: Tx) {
      const transactionDescription = transaction.descricao.trim().toLowerCase();
      const totalValue = Number(transaction.valor_total).toFixed(2);

      const exact = anItems.find((item) => {
        return (
          item.descricao_original.trim().toLowerCase() ===
            transactionDescription &&
          Number(item.valor).toFixed(2) === totalValue
        );
      });

      if (exact?.finalidade) return exact.finalidade;

      const partial = anItems.find((item) => {
        const original = item.descricao_original.trim().toLowerCase();

        return (
          transactionDescription.includes(original) ||
          original.includes(transactionDescription)
        );
      });

      return partial?.finalidade ?? "";
    }

    const output: Row[] = [];

    for (const transaction of txs) {
      if (
        transaction.data_compra < period.from ||
        transaction.data_compra > period.to
      ) {
        continue;
      }

      if (
        categoria !== "__all__" &&
        (transaction.categoria ?? "") !== categoria
      ) {
        continue;
      }

      const fin = findFinalidade(transaction);

      if (
        finalidade &&
        !fin.toLowerCase().includes(finalidade.toLowerCase()) &&
        !transaction.descricao.toLowerCase().includes(finalidade.toLowerCase())
      ) {
        continue;
      }

      if (transaction.tipo === "credito") {
        const transactionInstallments = insts.filter(
          (installment) => installment.transaction_id === transaction.id
        );

        if (transactionInstallments.length === 0) {
          const value = Number(transaction.valor_total);

          if (minV && value < Number(minV)) continue;
          if (maxV && value > Number(maxV)) continue;
          if (cardId !== "__all__" && transaction.card_id !== cardId) continue;
          if (faturaKey !== "__all__") continue;
          if (faturaStatus !== "todas") continue;

          output.push({
            data: transaction.data_compra,
            descricao: transaction.descricao,
            finalidade: fin,
            categoria: transaction.categoria ?? "",
            cartao:
              cards.find((item) => item.id === transaction.card_id)?.nome ?? "",
            cardId: transaction.card_id,
            valor: value,
            tipo: transaction.tipo,
            faturaMes: "—",
            faturaKey: "—",
            faturaLabel: "—",
            faturaStatus: "—",
          });

          continue;
        }

        for (const installment of transactionInstallments) {
          const value = Number(installment.valor);
          const currentFaturaKey = `${installment.card_id}|${installment.fatura_mes}`;
          const currentFaturaStatus =
            faturaStatusMap.get(currentFaturaKey) ?? "—";

          if (cardId !== "__all__" && installment.card_id !== cardId) continue;
          if (faturaKey !== "__all__" && currentFaturaKey !== faturaKey)
            continue;
          if (faturaStatus !== "todas" && currentFaturaStatus !== faturaStatus)
            continue;
          if (minV && value < Number(minV)) continue;
          if (maxV && value > Number(maxV)) continue;

          const card = cards.find((item) => item.id === installment.card_id);

          output.push({
            data: transaction.data_compra,
            descricao: transaction.descricao,
            finalidade: fin,
            categoria: transaction.categoria ?? "",
            cartao: card?.nome ?? "",
            cardId: installment.card_id,
            valor: value,
            tipo: transaction.tipo,
            faturaMes: installment.fatura_mes,
            faturaKey: currentFaturaKey,
            faturaLabel: formatFaturaMes(installment.fatura_mes),
            faturaStatus: currentFaturaStatus,
          });
        }

        continue;
      }

      const value = Number(transaction.valor_total);

      if (cardId !== "__all__") continue;
      if (faturaKey !== "__all__") continue;
      if (faturaStatus !== "todas") continue;
      if (minV && value < Number(minV)) continue;
      if (maxV && value > Number(maxV)) continue;

      output.push({
        data: transaction.data_compra,
        descricao: transaction.descricao,
        finalidade: fin,
        categoria: transaction.categoria ?? "",
        cartao: "",
        cardId: null,
        valor: value,
        tipo: transaction.tipo,
        faturaMes: "—",
        faturaKey: "—",
        faturaLabel: "—",
        faturaStatus: "—",
      });
    }

    return output.sort((a, b) => b.data.localeCompare(a.data));
  }, [
    txs,
    anItems,
    cards,
    insts,
    faturaStatusMap,
    period,
    cardId,
    faturaKey,
    categoria,
    minV,
    maxV,
    finalidade,
    faturaStatus,
  ]);

  const mindMapGroups = useMemo<SpendMindMapGroup[]>(() => {
    const map = new Map<string, SpendMindMapGroup>();

    rows
      .filter((row) => row.tipo !== "entrada")
      .forEach((row) => {
        const category = row.categoria || "Sem categoria";
        const current = map.get(category);

        if (current) {
          current.total += Number(row.valor);
          current.items.push({
            description: row.descricao,
            value: Number(row.valor),
            finalidade: row.finalidade,
            date: row.data,
          });
        } else {
          map.set(category, {
            category,
            total: Number(row.valor),
            items: [
              {
                description: row.descricao,
                value: Number(row.valor),
                finalidade: row.finalidade,
                date: row.data,
              },
            ],
          });
        }
      });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();

    rows
      .filter((row) => row.tipo !== "entrada")
      .forEach((row) => {
        const key = row.categoria || "Sem categoria";

        map.set(key, (map.get(key) ?? 0) + Number(row.valor));
      });

    return Array.from(map.entries())
      .map(([categoria, valor]) => ({
        categoria,
        valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [rows]);

  const cardChartData = useMemo(() => {
    const map = new Map<string, number>();

    rows
      .filter((row) => row.tipo !== "entrada")
      .forEach((row) => {
        const key = row.cartao || "Sem cartão";

        map.set(key, (map.get(key) ?? 0) + Number(row.valor));
      });

    return Array.from(map.entries())
      .map(([cartao, valor]) => ({
        cartao,
        valor,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [rows]);

  const evolutionChartData = useMemo(() => {
    const map = new Map<
      string,
      { mes: string; entrada: number; gasto: number; resultado: number }
    >();

    rows.forEach((row) => {
      const [year, month] = row.data.split("-");
      const key = `${year}-${month}`;
      const label = `${month}/${year}`;

      const current = map.get(key) ?? {
        mes: label,
        entrada: 0,
        gasto: 0,
        resultado: 0,
      };

      if (row.tipo === "entrada") {
        current.entrada += Number(row.valor);
      } else {
        current.gasto += Number(row.valor);
      }

      current.resultado = current.entrada - current.gasto;

      map.set(key, current);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [rows]);

  const heatmapData = useMemo(() => {
    const map = new Map<string, { entrada: number; saida: number }>();

    rows.forEach((row) => {
      const current = map.get(row.data) ?? { entrada: 0, saida: 0 };

      if (row.tipo === "entrada") {
        current.entrada += Number(row.valor);
      } else {
        current.saida += Number(row.valor);
      }

      map.set(row.data, current);
    });

    return Array.from(map.entries()).map(([date, totals]) => ({
      date,
      entrada: totals.entrada,
      saida: totals.saida,
    }));
  }, [rows]);

  const selectedCardLabel = useMemo(() => {
    if (cardId === "__all__") return "Todos os cartões";

    return cards.find((card) => card.id === cardId)?.nome ?? "Cartão";
  }, [cardId, cards]);

  const selectedInvoiceLabel = useMemo(() => {
    if (faturaKey === "__all__") return "Todas as faturas";

    const found = faturasDisponiveis.find((fatura) => fatura.key === faturaKey);

    return found?.label ?? "Fatura";
  }, [faturaKey, faturasDisponiveis]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.tipo === "entrada") {
          acc.entrada += row.valor;
        } else {
          acc.gasto += row.valor;
        }

        return acc;
      },
      {
        entrada: 0,
        gasto: 0,
      }
    );
  }, [rows]);

  const lucro = totals.entrada - totals.gasto;

  const selectedEntityName = selectedEntity?.name ?? "entidade";
  const selectedEntityFileName = selectedEntityName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toLowerCase();

  const totalPorCategoria = useMemo(() => {
    const map = new Map<string, number>();

    rows
      .filter((row) => row.tipo !== "entrada")
      .forEach((row) => {
        const key = row.categoria || "Sem categoria";

        map.set(key, (map.get(key) ?? 0) + row.valor);
      });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const maiorCategoria = totalPorCategoria[0];

  function exportCSV() {
    const header = [
      "Data",
      "Descrição",
      "Finalidade/Destino",
      "Categoria",
      "Cartão",
      "Tipo",
      "Fatura",
      "Status da fatura",
      "Valor",
    ];

    const csv = [
      header.map(sanitizeCsvCell).join(";"),
      ...rows.map((row) =>
        [
          ptDate(row.data),
          row.descricao,
          row.finalidade,
          row.categoria,
          row.cartao,
          row.tipo,
          row.faturaLabel,
          getStatusLabel(row.faturaStatus),
          row.valor.toFixed(2).replace(".", ","),
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
    anchor.download = `relatorio_${selectedEntityFileName}_${period.from}_${period.to}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Relatório Financeiro - ${selectedEntityName}`, 14, 16);

    doc.setFontSize(10);
    doc.text(`Período: ${ptDate(period.from)} a ${ptDate(period.to)}`, 14, 24);
    doc.text(`Entradas: ${brl(totals.entrada)}`, 14, 31);
    doc.text(`Gastos: ${brl(totals.gasto)}`, 72, 31);
    doc.text(`Resultado: ${brl(lucro)}`, 128, 31);

    autoTable(doc, {
      startY: 40,
      head: [
        [
          "Data",
          "Descrição",
          "Finalidade",
          "Categoria",
          "Cartão",
          "Fatura",
          "Status",
          "Valor",
        ],
      ],
      body: rows.map((row) => [
        ptDate(row.data),
        row.descricao,
        row.finalidade,
        row.categoria,
        row.cartao,
        row.faturaLabel,
        getStatusLabel(row.faturaStatus),
        brl(row.valor),
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
      },
    });

    doc.save(
      `relatorio_${selectedEntityFileName}_${period.from}_${period.to}.pdf`
    );
  }

  function clearFilters() {
    setPeriod({
      from: firstOfYear,
      to: today.toISOString().slice(0, 10),
    });
    setCategoria("__all__");
    setCardId("__all__");
    setFaturaKey("__all__");
    setMinV("");
    setMaxV("");
    setFinalidade("");
    setFaturaStatus("todas");
  }

  useEffect(() => {
    function handleDownloadCSV() {
      if (rows.length === 0) return;
      exportCSV();
    }

    function handleDownloadPDF() {
      if (rows.length === 0) return;
      exportPDF();
    }

    window.addEventListener(
      "fintechpro:relatorios:download-csv",
      handleDownloadCSV
    );
    window.addEventListener(
      "fintechpro:relatorios:download-pdf",
      handleDownloadPDF
    );

    return () => {
      window.removeEventListener(
        "fintechpro:relatorios:download-csv",
        handleDownloadCSV
      );
      window.removeEventListener(
        "fintechpro:relatorios:download-pdf",
        handleDownloadPDF
      );
    };
  }, [
    rows,
    selectedEntityFileName,
    selectedEntityName,
    period.from,
    period.to,
    totals.entrada,
    totals.gasto,
    lucro,
  ]);

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
      <Card className="border-amber-500/30 bg-amber-500/10 text-white shadow-sm">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

          <div>
            <h2 className="font-semibold text-white">
              Nenhuma entidade financeira selecionada
            </h2>

            <p className="mt-1 text-sm leading-6 text-white/60">
              Selecione uma entidade para visualizar os
              relatórios.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/55">Entradas</p>
              <TrendingUp className="h-4 w-4 text-[#2ECC71]" />
            </div>

            <p className="mt-2 text-2xl font-black text-[#2ECC71]">
              {brl(totals.entrada)}
            </p>

            <p className="mt-1 text-xs text-white/38">
              Receitas no período filtrado
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/55">Gastos</p>
              <TrendingDown className="h-4 w-4 text-[#FF4D5E]" />
            </div>

            <p className="mt-2 text-2xl font-black text-[#FF4D5E]">
              {brl(totals.gasto)}
            </p>

            <p className="mt-1 text-xs text-white/38">
              Saídas e compras encontradas
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/55">Resultado</p>
              <BarChart3 className="h-4 w-4 text-[#D9FF66]" />
            </div>

            <p
              className={[
                "mt-2 text-2xl font-black",
                lucro >= 0 ? "text-[#2ECC71]" : "text-[#FF4D5E]",
              ].join(" ")}
            >
              {brl(lucro)}
            </p>

            <p className="mt-1 text-xs text-white/38">
              Entradas menos gastos
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/55">Itens filtrados</p>
              <ReceiptText className="h-4 w-4 text-[#A88BFF]" />
            </div>

            <p className="mt-2 text-2xl font-black text-white">
              {rows.length}
            </p>

            <p className="mt-1 text-xs text-white/38">
              {maiorCategoria ? `Maior categoria: ${maiorCategoria.name}` : "Nenhuma categoria dominante"}
            </p>
          </CardContent>
        </Card>
      </div>

      {filtersOpen && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Filter className="h-4 w-4" />
            Filtros do relatório
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-xs text-white/55">De</Label>
            <Input
              type="date"
              value={period.from}
              onChange={(event) =>
                setPeriod((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <Label className="text-xs text-white/55">Até</Label>
            <Input
              type="date"
              value={period.to}
              onChange={(event) =>
                setPeriod((prev) => ({
                  ...prev,
                  to: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <Label className="text-xs text-white/55">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>

                {categorias.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-white/55">Cartão</Label>
            <Select
              value={cardId}
              onValueChange={(value) => {
                setCardId(value);
                setFaturaKey("__all__");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>

                {cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-white/55">Fatura</Label>
            <Select value={faturaKey} onValueChange={setFaturaKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>

                {faturasDisponiveis.map((fatura) => (
                  <SelectItem key={fatura.key} value={fatura.key}>
                    {fatura.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-white/55">Valor mínimo</Label>
            <Input
              type="number"
              step="0.01"
              value={minV}
              onChange={(event) => setMinV(event.target.value)}
              placeholder="0,00"
            />
          </div>

          <div>
            <Label className="text-xs text-white/55">Valor máximo</Label>
            <Input
              type="number"
              step="0.01"
              value={maxV}
              onChange={(event) => setMaxV(event.target.value)}
              placeholder="0,00"
            />
          </div>

          <div>
            <Label className="text-xs text-white/55">
              Finalidade/Destino
            </Label>
            <Input
              value={finalidade}
              onChange={(event) => setFinalidade(event.target.value)}
              placeholder="Ex: Villyan"
            />
          </div>

          <div>
            <Label className="text-xs text-white/55">
              Status da fatura
            </Label>
            <Select
              value={faturaStatus}
              onValueChange={(value) => setFaturaStatus(value as FaturaStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="parcial">Parcialmente paga</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 md:col-span-3">
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="w-full md:w-auto"
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <CardContent className="flex flex-col justify-between gap-4 p-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-semibold text-white">
              Visualização do relatório
            </p>

            <p className="text-sm text-white/55">
              Escolha como deseja enxergar seus gastos filtrados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/40 p-1 sm:grid-cols-4 xl:grid-cols-7">
            <Button
              type="button"
              size="sm"
              variant={reportView === "table" ? "default" : "ghost"}
              onClick={() => setReportView("table")}
            >
              <Table2 className="mr-1.5 h-4 w-4" />
              Tabela
            </Button>

            <Button
              type="button"
              size="sm"
              variant={reportView === "mindmap" ? "default" : "ghost"}
              onClick={() => setReportView("mindmap")}
            >
              Mapa mental
            </Button>

            <Button
              type="button"
              size="sm"
              variant={reportView === "heatmap" ? "default" : "ghost"}
              onClick={() => setReportView("heatmap")}
            >
              Mapa calor
            </Button>

            <Button
              type="button"
              size="sm"
              variant={reportView === "category_bar" ? "default" : "ghost"}
              onClick={() => setReportView("category_bar")}
            >
              Categorias
            </Button>

            <Button
              type="button"
              size="sm"
              variant={reportView === "card_bar" ? "default" : "ghost"}
              onClick={() => setReportView("card_bar")}
            >
              Cartões
            </Button>

            <Button
              type="button"
              size="sm"
              variant={reportView === "evolution" ? "default" : "ghost"}
              onClick={() => setReportView("evolution")}
            >
              Evolução
            </Button>

            <Button
              type="button"
              size="sm"
              variant={reportView === "donut" ? "default" : "ghost"}
              onClick={() => setReportView("donut")}
            >
              <PieChartIcon className="mr-1.5 h-4 w-4" />
              Donut
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportView === "mindmap" && (
        <SpendMindMap
          rootLabel={selectedCardLabel}
          invoiceLabel={selectedInvoiceLabel}
          groups={mindMapGroups}
          subtitle="Ramificação dos gastos filtrados por cartão, fatura, categoria e lançamento."
          onSelectItem={(item) => {
            setFinalidade(item.description);
          }}
        />
      )}

      {reportView === "heatmap" && (
        <ExpenseHeatmap
          items={heatmapData}
          from={period.from}
          to={period.to}
          onSelectDate={(date) => {
            setPeriod({
              from: date,
              to: date,
            });
          }}
        />
      )}

      {reportView === "category_bar" && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.20)]">
          <CardContent className="p-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">
                Gastos por categoria
              </h2>

              <p className="text-sm text-white/55">
                Ranking das categorias que mais consumiram dinheiro no período.
              </p>
            </div>

            <div className="h-[420px]">
              {categoryChartData.length === 0 ? (
                <EmptyChart message="Nenhuma categoria encontrada para o período." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} layout="vertical">
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={chartCurrency}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      type="category"
                      dataKey="categoria"
                      width={150}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={tooltipCurrency}
                      contentStyle={getTooltipStyle()}
                    />
                    <Bar
                      dataKey="valor"
                      name="Gasto"
                      fill="#D9FF66"
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {reportView === "card_bar" && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.20)]">
          <CardContent className="p-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">
                Gastos por cartão
              </h2>

              <p className="text-sm text-white/55">
                Compare quanto cada cartão concentrou de gastos no período.
              </p>
            </div>

            <div className="h-[380px]">
              {cardChartData.length === 0 ? (
                <EmptyChart message="Nenhum gasto por cartão encontrado para o período." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cardChartData}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="cartao"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tickFormatter={chartCurrency}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={tooltipCurrency}
                      contentStyle={getTooltipStyle()}
                    />
                    <Bar
                      dataKey="valor"
                      name="Gasto"
                      fill="#D9FF66"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {reportView === "evolution" && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.20)]">
          <CardContent className="p-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">
                Evolução mensal
              </h2>

              <p className="text-sm text-white/55">
                Compare entradas, gastos e resultado ao longo dos meses
                filtrados.
              </p>
            </div>

            <div className="h-[380px]">
              {evolutionChartData.length === 0 ? (
                <EmptyChart message="Nenhum dado mensal encontrado para o período." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionChartData}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tickFormatter={chartCurrency}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={tooltipCurrency}
                      contentStyle={getTooltipStyle()}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="entrada"
                      name="Entradas"
                      stroke="#2ECC71"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gasto"
                      name="Gastos"
                      stroke="#FF4D5E"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado"
                      stroke="#D9FF66"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {reportView === "donut" && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.20)]">
          <CardContent className="p-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">
                Distribuição por categoria
              </h2>

              <p className="text-sm text-white/55">
                Veja a participação de cada categoria no total de gastos.
              </p>
            </div>

            <div className="h-[420px]">
              {categoryChartData.length === 0 ? (
                <EmptyChart message="Nenhum gasto encontrado para montar o donut." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="valor"
                      nameKey="categoria"
                      innerRadius={90}
                      outerRadius={140}
                      paddingAngle={3}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={tooltipCurrency}
                      contentStyle={getTooltipStyle()}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {reportView === "table" && (
        <Card className="overflow-hidden border-border bg-card shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/60 text-xs text-white/55">
                  <tr>
                    <th className="whitespace-nowrap p-3 text-left font-medium">
                      Data
                    </th>
                    <th className="min-w-[240px] p-3 text-left font-medium">
                      Descrição
                    </th>
                    <th className="min-w-[180px] p-3 text-left font-medium">
                      Finalidade
                    </th>
                    <th className="whitespace-nowrap p-3 text-left font-medium">
                      Categoria
                    </th>
                    <th className="whitespace-nowrap p-3 text-left font-medium">
                      Cartão
                    </th>
                    <th className="whitespace-nowrap p-3 text-left font-medium">
                      Fatura
                    </th>
                    <th className="whitespace-nowrap p-3 text-left font-medium">
                      Status
                    </th>
                    <th className="whitespace-nowrap p-3 text-right font-medium">
                      Valor
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {rows.map((row, index) => (
                    <tr
                      key={`${row.data}-${row.descricao}-${row.faturaKey}-${index}`}
                      className="transition-colors hover:bg-muted/40"
                    >
                      <td className="whitespace-nowrap p-3 text-white/55">
                        {ptDate(row.data)}
                      </td>

                      <td className="p-3 font-medium text-white">
                        {row.descricao}
                      </td>

                      <td className="p-3 text-white/55">
                        {row.finalidade || "—"}
                      </td>

                      <td className="p-3 text-white/80">
                        {row.categoria || "—"}
                      </td>

                      <td className="p-3 text-white/80">
                        <span className="inline-flex items-center gap-1.5">
                          {row.cartao && <CreditCard className="h-3.5 w-3.5" />}
                          {row.cartao || "—"}
                        </span>
                      </td>

                      <td className="p-3 text-white/80">
                        <span className="inline-flex items-center gap-1.5">
                          {row.faturaLabel !== "—" && (
                            <CalendarDays className="h-3.5 w-3.5" />
                          )}
                          {row.faturaLabel}
                        </span>
                      </td>

                      <td className="p-3">
                        <Badge className={getStatusClass(row.faturaStatus)}>
                          {getStatusLabel(row.faturaStatus)}
                        </Badge>
                      </td>

                      <td
                        className={[
                          "p-3 text-right font-semibold",
                          row.tipo === "entrada"
                            ? "text-emerald-500"
                            : "text-red-500",
                        ].join(" ")}
                      >
                        {brl(row.valor)}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-10 text-center text-sm text-white/55"
                      >
                        Nenhum resultado encontrado para os filtros
                        selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
