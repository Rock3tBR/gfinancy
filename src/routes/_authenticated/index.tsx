import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { useHomeProfiles } from "@/hooks/use-home-profiles";
import { FinancialEntitySelector } from "@/components/FinancialEntitySelector";
import {
  BankAvatar,
  inferBankFromCardName,
} from "@/components/cards/BankAvatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  CreditCard,
  Filter,
  Hourglass,
  Loader2,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  UserRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import {
  EditableHomeDashboard,
  type HomeWidgetDefinition,
} from "@/components/home/EditableHomeDashboard";
import { CategoryDonut3D } from "@/components/home/CategoryDonut3D";
import { HomeProfileSelector } from "@/components/home/HomeProfileSelector";
import {
  CustomHomeWidget,
  type CustomWidgetRow,
} from "@/components/home/CustomHomeWidget";
import { ExpenseHeatmap } from "@/components/ExpenseHeatmap";
import { HomeCalculatorWidget } from "@/components/home/HomeCalculatorWidget";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

const THEME = {
  primary: "#D9FF66",
  secondary: "#A88BFF",
  tertiary: "#2ECC71",
  neutral: "#1A1A1A",
  background: "#0F0F0F",
  surface: "#1A1A1A",
  surfaceSoft: "#202020",
  danger: "#FF4D5E",
  info: "#3BA3FF",
};

type Tx = {
  id: string;
  entity_id: string | null;
  tipo: "entrada" | "debito" | "credito";
  descricao: string;
  categoria: string | null;
  valor_total: number;
  data_compra: string;
  card_id?: string | null;
  parcelas?: number | string | null;
  parcela_atual_importada?: number | string | null;
  total_parcelas_importadas?: number | string | null;
  fatura_mes_importada?: string | null;
};

type CardRow = {
  id: string;
  entity_id: string | null;
  nome: string;
  bandeira: string;
  limite: number;
  cor: string;
  dia_fechamento: number;
  dia_vencimento?: number;
};

type Installment = {
  id: string;
  entity_id: string | null;
  card_id: string;
  fatura_mes: string;
  valor: number;
};

type Invoice = {
  id: string;
  entity_id: string | null;
  card_id: string;
  fatura_mes: string;
  paid_at: string | null;
};

type Category = {
  id: string;
  nome: string;
  cor?: string | null;
};

type HomePeriod =
  "current_month" | "last_3_months" | "last_6_months" | "current_year";

type ChartPoint = {
  label: string;
  entradas: number;
  gastos: number;
  resultado: number;
};

const PERIOD_OPTIONS: Array<{ value: HomePeriod; label: string }> = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "current_year", label: "Ano atual" },
];

const DARK_CARD =
  "border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur";
const DARK_INNER =
  "border-white/10 bg-white/[0.035] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function safeDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(day, 1), lastDay));
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function parseLocalDate(value: string | null | undefined) {
  if (!value) return null;

  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function invoiceMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function normalizePositiveInteger(value: unknown, fallback = 1) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function effectiveClosingDay(
  year: number,
  monthIndex: number,
  configuredClosingDay: number,
) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const adjusted =
    lastDay === 30 ? configuredClosingDay + 1 : configuredClosingDay;

  return Math.max(1, Math.min(adjusted, lastDay));
}

function firstInvoiceMonth(purchaseDate: Date, configuredClosingDay: number) {
  const year = purchaseDate.getFullYear();
  const monthIndex = purchaseDate.getMonth();
  const closingDay = effectiveClosingDay(
    year,
    monthIndex,
    configuredClosingDay,
  );

  return new Date(
    year,
    monthIndex + (purchaseDate.getDate() > closingDay ? 1 : 0),
    1,
  );
}

function splitInstallmentValues(totalValue: number, totalInstallments: number) {
  const installments = Math.max(1, totalInstallments);
  const totalCents = Math.round(Math.abs(totalValue) * 100);
  const base = Math.floor(totalCents / installments);
  const remainder = totalCents % installments;

  return Array.from(
    { length: installments },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100,
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", {
      month: "short",
    })
    .replace(".", "")
    .toUpperCase();
}

function getPeriodRange(period: HomePeriod, today: Date) {
  if (period === "current_year") {
    return {
      start: `${today.getFullYear()}-01-01`,
      end: `${today.getFullYear()}-12-31`,
    };
  }

  const months =
    period === "last_6_months" ? 6 : period === "last_3_months" ? 3 : 1;

  const start = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
  const end = endOfMonth(today);

  return {
    start: ymd(start),
    end: ymd(end),
  };
}

function HomePage() {
  const { user } = useAuth();
  const { canUse, openUpgrade } = usePlan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const {
    profiles,
    activeProfile,
    activeProfileId,
    isLoading: profilesLoading,
    isMutating: profilesMutating,
    isSaving: profileSaving,
    selectProfile,
    createProfile,
    duplicateProfile,
    renameProfile,
    deleteProfile,
    saveProfile,
  } = useHomeProfiles({
    userId: user?.id,
    entityId: selectedEntityId,
  });

  const [period, setPeriod] = useState<HomePeriod>("current_month");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [upcomingInvoiceCardId, setUpcomingInvoiceCardId] = useState("all");

  const today = useMemo(() => new Date(), []);
  const periodRange = useMemo(
    () => getPeriodRange(period, today),
    [period, today],
  );

  useEffect(() => {
    function toggleFilters() {
      setFiltersOpen((current) => !current);
    }

    window.addEventListener("fintechpro:toggle-home-filters", toggleFilters);

    return () => {
      window.removeEventListener(
        "fintechpro:toggle-home-filters",
        toggleFilters,
      );
    };
  }, []);

  const startPeriod = periodRange.start;
  const endPeriod = periodRange.end;
  const startYear = `${today.getFullYear()}-01-01`;
  const endYear = `${today.getFullYear()}-12-31`;

  const { data: txs = [] } = useQuery({
    queryKey: ["home-txs", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("data_compra", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Tx[];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["home-cards", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cards")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as CardRow[];
    },
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["home-installments", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("installments")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Installment[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["home-invoices", user?.id, selectedEntityId],
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

  const { data: customWidgets = [] } = useQuery({
    queryKey: [
      "custom-widgets",
      user?.id,
      selectedEntityId,
    ],
    enabled:
      Boolean(user?.id) &&
      Boolean(selectedEntityId),
    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      )
        .from("custom_widgets")
        .select("*")
        .eq("user_id", user!.id)
        .eq(
          "entity_id",
          selectedEntityId,
        )
        .eq("is_active", true)
        .order("updated_at", {
          ascending: false,
        });

      if (error) throw error;

      return (
        (data ?? []) as CustomWidgetRow[]
      ).map((widget) => ({
        ...widget,
        config:
          widget.config ?? {},
      }));
    },
  });

  const invoiceByKey = useMemo(() => {
    return new Map(
      invoices.map((invoice) => [
        `${invoice.card_id}|${invoice.fatura_mes}`,
        invoice,
      ]),
    );
  }, [invoices]);

  const stats = useMemo(() => {
    const entradasTotal = txs
      .filter((tx) => tx.tipo === "entrada")
      .reduce((sum, tx) => sum + Number(tx.valor_total), 0);

    // O saldo atual representa apenas o dinheiro que realmente saiu da conta.
    // Compras feitas no cartão de crédito não diminuem o saldo no momento da
    // compra, pois serão cobradas posteriormente na fatura.
    const gastosQueAfetamSaldo = txs
      .filter((tx) => tx.tipo === "debito")
      .reduce((sum, tx) => sum + Number(tx.valor_total), 0);

    const entradasPeriodo = txs
      .filter(
        (tx) =>
          tx.tipo === "entrada" &&
          tx.data_compra >= startPeriod &&
          tx.data_compra <= endPeriod,
      )
      .reduce((sum, tx) => sum + Number(tx.valor_total), 0);

    const gastosPeriodo = txs
      .filter(
        (tx) =>
          tx.tipo !== "entrada" &&
          tx.data_compra >= startPeriod &&
          tx.data_compra <= endPeriod,
      )
      .reduce((sum, tx) => sum + Number(tx.valor_total), 0);

    const openInstallments = installments.filter((installment) => {
      const invoice = invoiceByKey.get(
        `${installment.card_id}|${installment.fatura_mes}`,
      );

      return !invoice?.paid_at;
    });

    const previstoPeriodo = openInstallments
      .filter(
        (installment) =>
          installment.fatura_mes >= startPeriod &&
          installment.fatura_mes <= endPeriod,
      )
      .reduce((sum, installment) => sum + Number(installment.valor), 0);

    return {
      saldo: entradasTotal - gastosQueAfetamSaldo,
      entradasPeriodo,
      gastosPeriodo,
      resultadoPeriodo: entradasPeriodo - gastosPeriodo,
      previstoPeriodo,
    };
  }, [txs, installments, invoiceByKey, startPeriod, endPeriod]);

  const comparisonData = useMemo(() => {
    const output: ChartPoint[] = [];

    for (let index = 11; index >= 0; index--) {
      const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
      const start = ymd(startOfMonth(date));
      const end = ymd(endOfMonth(date));

      const entradas = txs
        .filter(
          (tx) =>
            tx.tipo === "entrada" &&
            tx.data_compra >= start &&
            tx.data_compra <= end,
        )
        .reduce((sum, tx) => sum + Number(tx.valor_total), 0);

      const gastos = txs
        .filter(
          (tx) =>
            tx.tipo !== "entrada" &&
            tx.data_compra >= start &&
            tx.data_compra <= end,
        )
        .reduce((sum, tx) => sum + Number(tx.valor_total), 0);

      output.push({
        label: monthLabel(date),
        entradas,
        gastos,
        resultado: entradas - gastos,
      });
    }

    return output;
  }, [txs, today]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();

    txs
      .filter(
        (tx) =>
          tx.tipo !== "entrada" &&
          tx.data_compra >= startPeriod &&
          tx.data_compra <= endPeriod,
      )
      .forEach((tx) => {
        const key = tx.categoria || "Sem categoria";

        map.set(key, (map.get(key) ?? 0) + Number(tx.valor_total));
      });

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [txs, startPeriod, endPeriod]);

  const heatmapData = useMemo(() => {
    const map = new Map<string, { entrada: number; saida: number }>();

    txs
      .filter((tx) => tx.data_compra >= startYear && tx.data_compra <= endYear)
      .forEach((tx) => {
        const current = map.get(tx.data_compra) ?? { entrada: 0, saida: 0 };

        if (tx.tipo === "entrada") {
          current.entrada += Number(tx.valor_total);
        } else {
          current.saida += Number(tx.valor_total);
        }

        map.set(tx.data_compra, current);
      });

    return Array.from(map.entries()).map(([date, totals]) => ({
      date,
      entrada: totals.entrada,
      saida: totals.saida,
    }));
  }, [txs, startYear, endYear]);

  const cardsUsage = useMemo(() => {
    return cards.map((card) => {
      const used = installments
        .filter((installment) => {
          if (installment.card_id !== card.id) return false;

          const invoice = invoiceByKey.get(
            `${installment.card_id}|${installment.fatura_mes}`,
          );

          return !invoice?.paid_at;
        })
        .reduce((sum, installment) => sum + Number(installment.valor), 0);

      const available = Math.max(0, Number(card.limite) - used);
      const percent =
        Number(card.limite) > 0 ? (used / Number(card.limite)) * 100 : 0;

      return {
        ...card,
        used,
        available,
        percent,
      };
    });
  }, [cards, installments, invoiceByKey]);

  const upcomingInvoiceRows = useMemo(() => {
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const cardById = new Map(cards.map((card) => [card.id, card]));
    const grouped = new Map<
      string,
      {
        cardId: string;
        cardName: string;
        cardBrand: string;
        invoiceMonth: string;
        dueDate: Date;
        amount: number;
      }
    >();

    const addProjectedInstallment = (
      card: CardRow,
      invoiceMonth: string,
      amount: number,
    ) => {
      const normalizedMonth = String(invoiceMonth).slice(0, 7) + "-01";
      const [yearText, monthText] = normalizedMonth.split("-");
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;

      if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return;

      const invoice = invoiceByKey.get(`${card.id}|${normalizedMonth}`);
      if (invoice?.paid_at) return;

      const dueDate = safeDate(
        year,
        monthIndex,
        Number(card.dia_vencimento || 1),
      );

      if (dueDate < todayStart) return;

      const key = `${card.id}|${normalizedMonth}`;
      const current = grouped.get(key);

      if (current) {
        current.amount += amount;
        return;
      }

      grouped.set(key, {
        cardId: card.id,
        cardName: card.nome,
        cardBrand: card.bandeira,
        invoiceMonth: normalizedMonth,
        dueDate,
        amount,
      });
    };

    // A Home projeta as faturas diretamente das transações, usando a mesma
    // regra da tela de Faturas. Assim, as próximas competências aparecem
    // mesmo quando a tabela installments ainda não possui linhas futuras.
    for (const transaction of txs) {
      if (transaction.tipo !== "credito" || !transaction.card_id) continue;

      const card = cardById.get(transaction.card_id);
      if (!card) continue;

      const value = Math.abs(Number(transaction.valor_total || 0));
      if (!Number.isFinite(value) || value <= 0) continue;

      if (transaction.fatura_mes_importada) {
        const currentInstallment = normalizePositiveInteger(
          transaction.parcela_atual_importada,
          1,
        );
        const totalInstallments = Math.max(
          currentInstallment,
          normalizePositiveInteger(
            transaction.total_parcelas_importadas ?? transaction.parcelas,
            currentInstallment,
          ),
        );
        const importedMonth = parseLocalDate(transaction.fatura_mes_importada);

        if (!importedMonth) continue;

        const remaining = totalInstallments - currentInstallment + 1;

        for (let index = 0; index < remaining; index++) {
          addProjectedInstallment(
            card,
            invoiceMonthKey(addMonths(importedMonth, index)),
            value,
          );
        }

        continue;
      }

      const purchaseDate = parseLocalDate(transaction.data_compra);
      if (!purchaseDate) continue;

      const totalInstallments = normalizePositiveInteger(
        transaction.parcelas,
        1,
      );
      const values = splitInstallmentValues(value, totalInstallments);
      const initialMonth = firstInvoiceMonth(
        purchaseDate,
        Number(card.dia_fechamento || 31),
      );

      values.forEach((installmentValue, index) => {
        addProjectedInstallment(
          card,
          invoiceMonthKey(addMonths(initialMonth, index)),
          installmentValue,
        );
      });
    }

    const allRows = Array.from(grouped.values())
      .map((row) => ({
        ...row,
        amount: Math.round(row.amount * 100) / 100,
      }))
      .sort(
        (first, second) =>
          first.dueDate.getTime() - second.dueDate.getTime() ||
          first.cardName.localeCompare(second.cardName, "pt-BR"),
      );

    if (upcomingInvoiceCardId !== "all") {
      return allRows
        .filter((invoice) => invoice.cardId === upcomingInvoiceCardId)
        .slice(0, 5);
    }

    // No filtro padrão, mostra somente a próxima fatura de cada cartão.
    const firstInvoiceByCard = new Map<string, (typeof allRows)[number]>();

    for (const invoice of allRows) {
      if (!firstInvoiceByCard.has(invoice.cardId)) {
        firstInvoiceByCard.set(invoice.cardId, invoice);
      }
    }

    return Array.from(firstInvoiceByCard.values())
      .sort(
        (first, second) => first.dueDate.getTime() - second.dueDate.getTime(),
      )
      .slice(0, 5);
  }, [cards, txs, invoiceByKey, today, upcomingInvoiceCardId]);

  const widgets = useMemo<HomeWidgetDefinition[]>(() => {
    const systemWidgets: HomeWidgetDefinition[] = [
      {
        id: "quickActions",
        title: "Ações rápidas",
        description: "Atalhos principais do sistema.",
        defaultSize: "compact",
        defaultVisible: false,
        render: () => (
          <Card className="h-full rounded-[28px] border-none bg-transparent shadow-none">
            <CardContent className="flex h-full flex-col justify-center p-0">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Nova transação",
                    description: "Registrar entrada ou saída",
                    icon: Plus,
                    onClick: () => setTransactionOpen(true),
                    ring: "border-[#D9FF66]/15 bg-[#D9FF66]/7 text-[#D9FF66]",
                    hover: "hover:border-[#D9FF66]/40 hover:bg-[#D9FF66]/5",
                  },
                  {
                    label: "Importar fatura",
                    description: "PDF, TXT ou CSV",
                    icon: ReceiptText,
                    onClick: () =>
                      navigate({
                        to: "/transacoes",
                        search: { importar: true },
                      }),
                    ring: "border-[#3BA3FF]/15 bg-[#3BA3FF]/7 text-[#3BA3FF]",
                    hover: "hover:border-[#3BA3FF]/40 hover:bg-[#3BA3FF]/5",
                  },
                  {
                    label: "Adicionar cartão",
                    description: "Cadastrar limite e vencimento",
                    icon: CreditCard,
                    onClick: () =>
                      navigate({ to: "/cartoes", search: { novo: true } }),
                    ring: "border-[#A88BFF]/15 bg-[#A88BFF]/7 text-[#A88BFF]",
                    hover: "hover:border-[#A88BFF]/40 hover:bg-[#A88BFF]/5",
                  },
                  {
                    label: "Resumo do mês",
                    description: "Analisar movimentações",
                    icon: Wallet,
                    onClick: () => navigate({ to: "/relatorios" }),
                    ring: "border-[#2ECC71]/15 bg-[#2ECC71]/7 text-[#2ECC71]",
                    hover: "hover:border-[#2ECC71]/40 hover:bg-[#2ECC71]/5",
                  },
                ].map((action) => (
                  <Button
                    key={action.label}
                    type="button"
                    variant="outline"
                    className={`group h-[84px] justify-start rounded-[24px] px-4 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)] ${action.hover} ${DARK_INNER}`}
                    onClick={action.onClick}
                  >
                    <div className="flex w-full items-center gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform duration-200 group-hover:scale-110 ${action.ring}`}
                      >
                        <action.icon className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white">
                          {action.label}
                        </div>

                        <div className="mt-1 truncate text-xs text-white/45">
                          {action.description}
                        </div>
                      </div>

                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/20 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/50 group-hover:opacity-100" />
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "stats",
        title: "Cards financeiros",
        description: "Saldo, entradas, gastos e previsão do período.",
        defaultSize: "compact",
        render: () => {
          const items = [
            {
              label: "Saldo atual",
              value: brl(stats.saldo),
              icon: Wallet,
              color: "text-[#2ECC71]",
              bg: "bg-[#2ECC71]/10",
              border: "border-[#2ECC71]/20",
              detail: "Entradas menos gastos no débito",
            },
            {
              label: "Entradas",
              value: brl(stats.entradasPeriodo),
              icon: ArrowUpCircle,
              color: "text-[#3BA3FF]",
              bg: "bg-[#3BA3FF]/10",
              border: "border-[#3BA3FF]/20",
              detail: "Receitas no período",
            },
            {
              label: "Saídas",
              value: brl(stats.gastosPeriodo),
              icon: ArrowDownCircle,
              color: "text-[#FF4D5E]",
              bg: "bg-[#FF4D5E]/10",
              border: "border-[#FF4D5E]/20",
              detail: "Despesas no período",
            },
            {
              label: "Previsto",
              value: brl(stats.previstoPeriodo),
              icon: Hourglass,
              color: "text-[#A88BFF]",
              bg: "bg-[#A88BFF]/10",
              border: "border-[#A88BFF]/20",
              detail: "Faturas em aberto",
            },
          ];

          return (
            <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <Card
                  key={item.label}
                  className={`group h-full overflow-hidden rounded-[28px] transition hover:-translate-y-0.5 ${DARK_CARD}`}
                >
                  <CardContent className="relative flex h-full min-h-[96px] flex-col justify-between p-4 sm:min-h-[118px] sm:p-5">
                    <div
                      className={`absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border ${item.border} ${item.bg}`}
                    >
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>

                    <div className="pr-14">
                      <div className="text-sm font-medium text-white/58">
                        {item.label}
                      </div>

                      <div
                        className={`mt-2 truncate text-base font-black tracking-tight sm:text-xl ${item.color}`}
                      >
                        {item.value}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-white/45">
                      {item.detail}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        },
      },
      {
        id: "comparison",
        title: "Comparativo",
        description: "Gráfico comparativo entre entradas, gastos e resultado.",
        defaultSize: "medium",
        render: () => <DarkFinanceChart data={comparisonData} />,
      },
      {
        id: "category3d",
        title: "Gastos por categoria",
        description: "Distribuição dos gastos por categoria.",
        defaultSize: "medium",
        render: () => (
          <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
            <CardContent className="h-full p-0 [&_*]:text-white/80">
              <CategoryDonut3D data={categoryData} />
            </CardContent>
          </Card>
        ),
      },
      {
        id: "cards",
        title: "Uso por cartão",
        description: "Limite comprometido por cartão.",
        defaultSize: "medium",
        defaultVisible: false,
        render: () => (
          <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
            <CardContent className="h-full overflow-y-auto p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-white">
                    Uso por cartão
                  </div>

                  <div className="mt-1 text-sm text-white/48">
                    Limite comprometido, faturas abertas e saldo disponível.
                  </div>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#A88BFF]/20 bg-[#A88BFF]/10 text-[#A88BFF]">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>

              <div className="space-y-4">
                {cardsUsage.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm text-white/45">
                    Nenhum cartão cadastrado nesta entidade.
                  </div>
                ) : (
                  cardsUsage.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className="h-10 w-10 shrink-0 rounded-full shadow-[0_0_24px_rgba(255,255,255,0.08)]"
                            style={{
                              backgroundColor: card.cor || THEME.secondary,
                            }}
                          />

                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">
                              {card.nome}
                            </div>

                            <div className="text-xs text-white/45">
                              {card.percent.toFixed(0)}% do limite usado
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold text-white">
                            {brl(card.used)}
                          </div>

                          <div className="text-xs text-white/42">
                            de {brl(Number(card.limite))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#A88BFF] shadow-[0_0_18px_rgba(168,139,255,0.55)]"
                            style={{
                              width: `${Math.min(100, card.percent)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-white/45">Disponível</span>

                          <span className="font-bold text-[#2ECC71]">
                            {brl(card.available)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "heatmap",
        title: "Mapa de calor",
        description: "Dias com maior volume de gastos.",
        defaultSize: "wide",
        defaultVisible: false,
        render: () => (
          <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
            <CardContent className="h-full p-0 [&_*]:text-white/80">
              <ExpenseHeatmap
                items={heatmapData}
                from={startYear}
                to={endYear}
              />
            </CardContent>
          </Card>
        ),
      },
      {
        id: "recentTransactions",
        title: "Últimas transações",
        description: "Movimentações recentes da entidade.",
        defaultSize: "medium",
        render: () => {
          const recentTransactions = txs.slice(0, 5);

          return (
            <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-white">
                      Últimas transações
                    </div>

                    <div className="mt-1 text-sm text-white/48">
                      Movimentações mais recentes da entidade selecionada.
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-full px-3 text-[#D9FF66] hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
                  >
                    Ver todas
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {recentTransactions.length === 0 ? (
                  <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] text-center">
                    <div>
                      <CircleDollarSign className="mx-auto h-8 w-8 text-white/42" />
                      <p className="mt-3 text-sm font-bold text-white">
                        Nenhuma transação ainda
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Cadastre movimentações para acompanhar seu histórico.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {recentTransactions.map((tx) => {
                      const isIncome = tx.tipo === "entrada";

                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/[0.035] p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                                isIncome
                                  ? "border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#2ECC71]"
                                  : "border-[#FF4D5E]/20 bg-[#FF4D5E]/10 text-[#FF4D5E]"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowUpCircle className="h-4 w-4" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">
                                {tx.descricao || "Sem descrição"}
                              </p>

                              <p className="mt-1 truncate text-xs text-white/45">
                                {tx.categoria || "Sem categoria"} ·{" "}
                                {new Date(
                                  `${tx.data_compra}T00:00:00`,
                                ).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`shrink-0 text-sm font-black ${
                              isIncome ? "text-[#2ECC71]" : "text-[#FF4D5E]"
                            }`}
                          >
                            {isIncome ? "+" : "-"} {brl(Number(tx.valor_total))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        },
      },
      {
        id: "upcomingInvoices",
        title: "Próximas faturas",
        description: "Faturas abertas e vencimentos próximos.",
        defaultSize: "medium",
        render: () => {
          return (
            <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-base font-bold text-white">
                      Próximas faturas
                    </div>

                    <div className="mt-1 text-sm text-white/48">
                      Ordenadas do vencimento mais próximo ao mais distante.
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 self-start rounded-full px-3 text-[#D9FF66] hover:bg-[#D9FF66]/10 hover:text-[#D9FF66] sm:self-auto"
                    onClick={() => navigate({ to: "/faturas" })}
                  >
                    Ver todas
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {cards.length > 1 && (
                  <div className="mb-4">
                    <Select
                      value={upcomingInvoiceCardId}
                      onValueChange={setUpcomingInvoiceCardId}
                    >
                      <SelectTrigger className="h-10 w-full rounded-full border-white/10 bg-white/[0.045] px-4 text-white sm:w-[240px]">
                        <SelectValue placeholder="Filtrar por cartão" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">
                          Próxima de cada cartão
                        </SelectItem>
                        {cards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {upcomingInvoiceRows.length === 0 ? (
                  <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] text-center">
                    <div>
                      <CalendarClock className="mx-auto h-8 w-8 text-white/42" />
                      <p className="mt-3 text-sm font-bold text-white">
                        Nenhuma fatura em aberto
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Faturas futuras aparecerão aqui automaticamente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {upcomingInvoiceRows.map((invoice) => (
                      <button
                        type="button"
                        key={`${invoice.cardId}-${invoice.invoiceMonth}`}
                        onClick={() => navigate({ to: "/faturas" })}
                        className="flex w-full items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-[#D9FF66]/25 hover:bg-[#D9FF66]/[0.055]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <BankAvatar
                            bank={inferBankFromCardName(invoice.cardName)}
                          />

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">
                              Fatura {invoice.cardName}
                            </p>

                            <p className="mt-1 truncate text-xs text-white/45">
                              {invoice.cardBrand || "Cartão"} · Vencimento{" "}
                              {formatShortDate(invoice.dueDate)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-white">
                            {brl(invoice.amount)}
                          </p>

                          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 px-2 py-0.5 text-[11px] font-bold text-[#D9FF66]">
                            <CalendarClock className="h-3 w-3" />
                            {formatShortDate(invoice.dueDate)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        },
      },
      {
        id: "quickInfo",
        title: "Categorias ativas",
        description: "Resumo rápido das categorias.",
        defaultSize: "small",
        defaultVisible: false,
        render: () => (
          <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
            <CardContent className="flex h-full items-center justify-between gap-3 p-5">
              <div>
                <div className="text-sm text-white/48">Categorias ativas</div>

                <div className="mt-2 text-3xl font-black text-white">
                  {categoryData.length}
                </div>
              </div>

              <div className="rounded-2xl border border-[#D9FF66]/15 bg-[#D9FF66]/10 px-3 py-2 text-xs font-bold text-[#D9FF66]">
                Gráfico 3D
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "cardsCount",
        title: "Cartões",
        description: "Quantidade de cartões cadastrados.",
        defaultSize: "small",
        defaultVisible: false,
        render: () => (
          <Card className={`h-full rounded-[28px] ${DARK_CARD}`}>
            <CardContent className="flex h-full items-center justify-between gap-3 p-5">
              <div>
                <div className="text-sm text-white/48">Cartões cadastrados</div>

                <div className="mt-2 text-3xl font-black text-white">
                  {cards.length}
                </div>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D9FF66]/15 bg-[#D9FF66]/10 text-[#D9FF66]">
                <CreditCard className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "calculator",
        title: "Calculadora",
        description: "Faça cálculos rápidos diretamente na página inicial.",
        defaultSize: "medium",
        defaultVisible: false,
        render: () => <HomeCalculatorWidget />,
      },
    ];

    const personalizedWidgets: HomeWidgetDefinition[] =
      customWidgets.map((widget) => ({
        id: `custom-widget-${widget.id}`,
        title: widget.name,
        description:
          widget.description ??
          "Widget personalizado",
        defaultSize:
          widget.widget_type === "text" ||
          widget.widget_type === "list"
            ? "medium"
            : "small",
        /*
         * Widgets criados pelo usuário entram ocultos por padrão.
         * Assim eles aparecem em "Widgets ocultos" quando o usuário
         * abre o modo Editar página e podem ser adicionados ao perfil.
         */
        defaultVisible: false,
        render: () => (
          <CustomHomeWidget
            widget={widget}
            transactions={txs}
            cards={cards}
            installments={installments}
            invoices={invoices}
          />
        ),
      }));

    return [
      ...systemWidgets,
      ...personalizedWidgets,
    ];
  }, [
    selectedEntity,
    period,
    stats,
    comparisonData,
    categoryData,
    heatmapData,
    startYear,
    endYear,
    cardsUsage,
    cards,
    installments,
    invoices,
    txs,
    customWidgets,
    upcomingInvoiceRows,
    upcomingInvoiceCardId,
    navigate,
  ]);

  if (entityLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/60 shadow-2xl backdrop-blur">
          Carregando entidade financeira...
        </div>
      </div>
    );
  }

  if (!selectedEntityId || !selectedEntity) {
    return (
      <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-white">
              Nenhuma entidade financeira selecionada
            </h2>

            <p className="mt-1 text-sm leading-6 text-white/60">
              Selecione uma entidade para visualizar o dashboard.
            </p>
          </div>

          <div className="min-w-[260px]">
            <FinancialEntitySelector />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:w-[260px]">
          <FinancialEntitySelector />
        </div>

        {/* Mobile action bar */}
        <div className="flex w-full flex-col gap-3 sm:hidden">
          {/* Top row: Filtros + Nova transação */}
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "flex-1 h-11 items-center justify-center gap-2 rounded-2xl border-[#2A2A2A] bg-[#1A1A1A] px-4 font-medium text-white transition-all active:scale-[0.97] active:bg-[#222222]",
                filtersOpen &&
                  "border-[#D9FF66]/35 bg-[#D9FF66]/15 text-[#D9FF66]",
              )}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Filter className="h-5 w-5" />
              Filtros
            </Button>

            <Button
              type="button"
              className="flex-[1.4] h-11 items-center justify-center gap-2 rounded-2xl border border-[#D9FF66]/35 bg-[#D9FF66] px-4 font-bold text-[#0B0B0B] shadow-[0_4px_20px_rgba(217,255,102,0.15)] transition-all hover:bg-[#D9FF66]/90 active:scale-[0.97] active:opacity-90"
              onClick={() => setTransactionOpen(true)}
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
              Nova transação
            </Button>
          </div>

          {/* Bottom row: profile actions + Editar página */}
          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#1A1A1A]/40 px-3 py-2">
            <HomeProfileSelector
              profiles={profiles}
              activeProfileId={activeProfileId}
              disabled={profilesLoading || profilesMutating}
              compact
              onSelectProfile={selectProfile}
              onCreateProfile={createProfile}
              onDuplicateProfile={duplicateProfile}
              onRenameProfile={renameProfile}
              onDeleteProfile={deleteProfile}
            />

            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 items-center gap-2 rounded-2xl border-0 bg-transparent px-3 font-semibold text-xs uppercase tracking-wide text-white/60 transition-all hover:bg-transparent hover:text-white active:scale-[0.98]"
              onClick={() => {
                if (!canUse("editableDashboard")) {
                  openUpgrade(undefined, "editableDashboard");
                  return;
                }

                window.dispatchEvent(
                  new Event("fintechpro:edit-home"),
                );
              }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Editar página
            </Button>
          </div>
        </div>

        {/* Desktop action bar */}
        <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 rounded-full px-5 font-bold transition",
              filtersOpen
                ? "border-[#D9FF66]/35 bg-[#D9FF66]/15 text-[#D9FF66]"
                : "border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
            )}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>

          <Button
            type="button"
            className="h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
            onClick={() => setTransactionOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova transação
          </Button>

          <div className="ge-home-profile-actions ml-auto flex min-w-0 flex-nowrap items-center gap-2">
            <HomeProfileSelector
              profiles={profiles}
              activeProfileId={activeProfileId}
              disabled={profilesLoading || profilesMutating}
              onSelectProfile={selectProfile}
              onCreateProfile={createProfile}
              onDuplicateProfile={duplicateProfile}
              onRenameProfile={renameProfile}
              onDeleteProfile={deleteProfile}
            />

            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
              onClick={() => {
                if (!canUse("editableDashboard")) {
                  openUpgrade(undefined, "editableDashboard");
                  return;
                }

                window.dispatchEvent(
                  new Event("fintechpro:edit-home"),
                );
              }}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Editar página
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto rounded-[24px] border-white/10 bg-[#1A1A1A] p-4 text-white sm:max-h-[90vh] sm:w-full sm:p-6">
          <DialogHeader>
            <DialogTitle>Nova transação</DialogTitle>
          </DialogHeader>

          <TransactionDialog
            userId={user?.id}
            entity={selectedEntity}
            entityId={selectedEntityId}
            cards={cards}
            onDone={() => {
              setTransactionOpen(false);
              queryClient.invalidateQueries({ queryKey: ["home-txs"] });
              queryClient.invalidateQueries({ queryKey: ["txs"] });
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
              queryClient.invalidateQueries({
                queryKey: ["dashboard-summary"],
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {filtersOpen && (
        <section className="rounded-[28px] border border-white/10 bg-[#1A1A1A]/88 p-4 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-white">Filtros da página</p>
              <p className="mt-1 text-xs text-white/50">
                Ajuste o período usado nos indicadores da Home.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as HomePeriod)}
              >
                <SelectTrigger className="h-10 rounded-full border-white/10 bg-white/[0.055] px-5 text-white sm:w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>

                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-white/10 bg-white/[0.055] px-5 text-white hover:bg-white/[0.09]"
                onClick={() => setFiltersOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </section>
      )}

      {profilesLoading || !activeProfile ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/10 bg-[#1A1A1A]/80">
          <div className="flex items-center gap-3 text-sm text-white/55">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando perfil da Home...
          </div>
        </div>
      ) : (
        <EditableHomeDashboard
          key={activeProfile.id}
          widgets={widgets}
          profileId={activeProfile.id}
          profileName={activeProfile.name}
          layouts={activeProfile.layouts}
          visibility={activeProfile.visibility}
          isSaving={profileSaving}
          onSave={async ({ layouts, visibility }) => {
            await saveProfile({
              profileId: activeProfile.id,
              layouts,
              visibility,
            });
          }}
        />
      )}
    </div>
  );
}

type TransactionEntity = {
  id: string;
  name?: string | null;
  nickname?: string | null;
  type?: string | null;
};

function getEntityDisplayName(entity?: TransactionEntity | null) {
  if (!entity) return "Entidade";

  return entity.nickname || entity.name || "Entidade sem nome";
}

function parseMoneyValue(value: string) {
  const clean = value.trim().replace(/\s/g, "");
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;

  return Number(normalized || 0);
}

function parsePositiveInteger(value: string, fallback = 1) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return parsed;
}

function getInvoiceMonthByClosingDay(
  purchaseDateISO: string,
  closingDay: number,
  installmentIndex: number,
) {
  const purchaseDate = new Date(`${purchaseDateISO}T00:00:00`);
  const normalizedClosingDay = Math.min(
    Math.max(Number(closingDay || 1), 1),
    31,
  );

  const firstInvoiceDate =
    purchaseDate.getDate() > normalizedClosingDay
      ? addMonths(purchaseDate, 1)
      : new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);

  return ymd(addMonths(firstInvoiceDate, installmentIndex)).slice(0, 7);
}

function splitInstallments(total: number, count: number) {
  const safeCount = Math.max(1, count);
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / safeCount);
  const remainder = cents - base * safeCount;

  return Array.from({ length: safeCount }).map((_, index) => {
    const value = base + (index < remainder ? 1 : 0);
    return value / 100;
  });
}

function ptMonth(value: string) {
  if (!value) return "—";

  const [year, month] = value.split("-");

  if (!year || !month) return value;

  return `${month}/${year}`;
}

function TransactionDialog({
  userId,
  entity,
  entityId,
  cards,
  onDone,
}: {
  userId?: string;
  entity: TransactionEntity | null;
  entityId: string | null;
  cards: CardRow[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<"entrada" | "debito" | "credito">("debito");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState(ymd(new Date()));
  const [modoValor, setModoValor] = useState<"total" | "parcela">("total");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [cardId, setCardId] = useState("");

  const entityName = getEntityDisplayName(entity);

  const { data: categories = [] } = useQuery({
    queryKey: ["home-transaction-categories", userId, entityId],
    enabled: !!userId && !!entityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id,nome,cor")
        .eq("user_id", userId)
        .eq("entity_id", entityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as Category[];
    },
  });

  const selectedCard = cards.find((card) => card.id === cardId);
  const numParcelas = parsePositiveInteger(parcelas, 1);
  const numValor = parseMoneyValue(valor);

  const valorTotal =
    tipo === "credito" && modoValor === "parcela"
      ? numValor * numParcelas
      : numValor;

  const valorParcela =
    tipo === "credito" && numParcelas > 1
      ? valorTotal / numParcelas
      : valorTotal;

  const invoicePreview = useMemo(() => {
    if (tipo !== "credito" || !selectedCard) return [];

    return Array.from({ length: numParcelas }).map((_, index) => ({
      parcela: index + 1,
      faturaMes: getInvoiceMonthByClosingDay(
        data,
        selectedCard.dia_fechamento,
        index,
      ),
    }));
  }, [tipo, selectedCard, data, numParcelas]);

  async function createInstallments(transactionId: string) {
    if (!userId || !entityId) return;
    if (tipo !== "credito" || !selectedCard) return;

    const values = splitInstallments(valorTotal, numParcelas);

    const rows = values.map((installmentValue, index) => ({
      user_id: userId,
      entity_id: entityId,
      transaction_id: transactionId,
      card_id: selectedCard.id,
      fatura_mes: getInvoiceMonthByClosingDay(
        data,
        selectedCard.dia_fechamento,
        index,
      ),
      data_compra: data,
      valor: installmentValue,
      numero_parcela: index + 1,
      total_parcelas: numParcelas,
    }));

    if (!rows.length) return;

    const { error } = await (supabase as any).from("installments").insert(rows);

    if (error) throw error;
  }

  const createTransaction = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Usuário não autenticado.");
      }

      if (!entityId) {
        throw new Error("Selecione uma entidade financeira.");
      }

      if (!descricao.trim()) {
        throw new Error("Informe a descrição.");
      }

      if (valorTotal <= 0) {
        throw new Error("Informe um valor válido.");
      }

      if (tipo === "credito" && !selectedCard) {
        throw new Error("Selecione o cartão.");
      }

      const payload = {
        user_id: userId,
        entity_id: entityId,
        tipo,
        descricao: descricao.trim(),
        categoria: categoria || null,
        valor_total: valorTotal,
        data_compra: data,
        parcelas: tipo === "credito" ? numParcelas : 1,
        card_id: tipo === "credito" ? selectedCard!.id : null,
      };

      const { data: created, error } = await (supabase as any)
        .from("transactions")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      await createInstallments(created.id);
    },

    onSuccess: () => {
      toast.success("Transação cadastrada");
      queryClient.invalidateQueries({ queryKey: ["home-txs"] });
      queryClient.invalidateQueries({ queryKey: ["txs"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["home-installments"] });
      queryClient.invalidateQueries({ queryKey: ["insts"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onDone();
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransaction.mutate();
  }

  const summaryTone =
    tipo === "entrada"
      ? "border-[#2ECC71]/18 bg-[#2ECC71]/[0.08]"
      : tipo === "credito"
        ? "border-[#A88BFF]/18 bg-[#A88BFF]/[0.08]"
        : "border-[#FF4D5E]/18 bg-[#FF4D5E]/[0.08]";

  const summaryText =
    tipo === "entrada"
      ? `Será criada uma entrada em ${entityName}.`
      : tipo === "credito"
        ? `Será criada uma compra no crédito em ${entityName}${
            selectedCard ? ` no cartão ${selectedCard.nome}` : ""
          }.`
        : `Será criada uma saída em ${entityName}.`;

  const activeClass =
    tipo === "entrada"
      ? "bg-[#2ECC71] text-[#1A1A1A] shadow-[0_12px_32px_rgba(46,204,113,0.22)]"
      : tipo === "credito"
        ? "bg-[#A88BFF] text-[#1A1A1A] shadow-[0_12px_32px_rgba(168,139,255,0.20)]"
        : "bg-[#FF4D5E] text-white shadow-[0_12px_32px_rgba(255,77,94,0.20)]";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-5 py-4">
        <div className="text-xs text-white/38">Transação será criada em</div>

        <div className="mt-1 flex items-center gap-2 text-sm font-black text-white">
          {entity?.type === "cnpj" ? (
            <Building2 className="h-4 w-4 text-white/55" />
          ) : (
            <UserRound className="h-4 w-4 text-white/55" />
          )}

          {entityName}
          {entity?.type ? ` · ${entity.type.toUpperCase()}` : ""}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.045] p-1">
        <button
          type="button"
          className={[
            "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
            tipo === "entrada"
              ? activeClass
              : "text-white/55 hover:bg-white/[0.06] hover:text-white",
          ].join(" ")}
          onClick={() => setTipo("entrada")}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Entrada
        </button>

        <button
          type="button"
          className={[
            "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
            tipo === "debito"
              ? activeClass
              : "text-white/55 hover:bg-white/[0.06] hover:text-white",
          ].join(" ")}
          onClick={() => setTipo("debito")}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Saída
        </button>

        <button
          type="button"
          className={[
            "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
            tipo === "credito"
              ? activeClass
              : "text-white/55 hover:bg-white/[0.06] hover:text-white",
          ].join(" ")}
          onClick={() => setTipo("credito")}
        >
          <CreditCard className="h-4 w-4" />
          Crédito
        </button>
      </div>

      <div>
        <Label className="text-xs text-white/55">Descrição</Label>

        <Input
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
          required
          placeholder="Ex: Salário, mercado, aluguel..."
          className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
        />
      </div>

      <div>
        <Label className="text-xs text-white/55">Categoria</Label>

        {categories.length > 0 ? (
          <Select
            value={categoria || "__none__"}
            onValueChange={(value) =>
              setCategoria(value === "__none__" ? "" : value)
            }
          >
            <SelectTrigger className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="__none__">— Nenhuma —</SelectItem>

              {categories.map((category) => (
                <SelectItem key={category.id} value={category.nome}>
                  {category.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            placeholder="Ex: Alimentação, Transporte, Receita..."
            className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
          />
        )}
      </div>

      {tipo === "credito" && (
        <div>
          <Label className="text-xs text-white/55">Cartão</Label>

          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white">
              <SelectValue placeholder="Selecione o cartão" />
            </SelectTrigger>

            <SelectContent>
              {cards.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Cadastre um cartão primeiro.
                </div>
              )}

              {cards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {card.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {tipo === "credito" && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={modoValor === "total" ? "default" : "outline"}
            size="sm"
            className={[
              "rounded-full",
              modoValor === "total"
                ? "bg-[#D9FF66] text-[#1A1A1A] hover:bg-[#D9FF66]/90"
                : "border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.065]",
            ].join(" ")}
            onClick={() => setModoValor("total")}
          >
            Valor total
          </Button>

          <Button
            type="button"
            variant={modoValor === "parcela" ? "default" : "outline"}
            size="sm"
            className={[
              "rounded-full",
              modoValor === "parcela"
                ? "bg-[#D9FF66] text-[#1A1A1A] hover:bg-[#D9FF66]/90"
                : "border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.065]",
            ].join(" ")}
            onClick={() => setModoValor("parcela")}
          >
            Valor da parcela
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-white/55">
            {tipo === "credito" && modoValor === "parcela"
              ? "Valor da parcela"
              : "Valor"}
          </Label>

          <Input
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            required
            placeholder="Ex: 250,00"
            className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
          />
        </div>

        <div>
          <Label className="text-xs text-white/55">Data</Label>

          <Input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            required
            className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white"
          />
        </div>
      </div>

      {tipo === "credito" && (
        <div>
          <Label className="text-xs text-white/55">Parcelas</Label>

          <Input
            type="number"
            min={1}
            max={24}
            value={parcelas}
            onChange={(event) => setParcelas(event.target.value)}
            required
            className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white"
          />
        </div>
      )}

      <Button
        type="submit"
        disabled={createTransaction.isPending}
        className="w-full rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
      >
        {createTransaction.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar transação
          </>
        )}
      </Button>
    </form>
  );
}

function DarkFinanceChart({ data }: { data: ChartPoint[] }) {
  const chartWidth = 1200;
  const chartHeight = 260;
  const paddingX = 48;
  // Padding assimétrico: menos espaço em cima, bem mais embaixo — reserva
  // uma faixa só para os rótulos dos meses, para os pontos (mesmo os de
  // valor 0) nunca ficarem visualmente em cima do texto (AGO, SET, JAN...).
  const paddingTop = 24;
  const paddingBottom = 48;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const baselineY = chartHeight - paddingBottom;
  const labelY = chartHeight - 14;

  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [
      item.entradas,
      item.gastos,
      Math.abs(item.resultado),
    ]),
  );

  function getX(index: number) {
    if (data.length <= 1) return paddingX;
    return (
      paddingX +
      (index * (chartWidth - paddingX * 2)) / Math.max(1, data.length - 1)
    );
  }

  function getY(value: number) {
    // Clampa entre o topo do gráfico e a linha de base (0): garante que
    // nenhum ponto — nem resultado negativo — escape para dentro da faixa
    // reservada aos rótulos.
    const clamped = Math.max(0, Math.min(value, maxValue));
    return baselineY - (clamped / maxValue) * plotHeight;
  }

  function pathFor(
    key: keyof Pick<ChartPoint, "entradas" | "gastos" | "resultado">,
  ) {
    return data
      .map((item, index) => {
        const x = getX(index);
        const y = getY(Math.max(0, item[key]));
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  return (
    <Card className={`ge-mobile-chart-card h-full rounded-[32px] ${DARK_CARD}`}>
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">
              Comparativo financeiro
            </h2>

            <p className="mt-1 text-sm text-white/48">
              Evolução entre entradas, gastos e resultado.
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-white/55">
            <Wallet className="h-4 w-4" />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-4 text-xs text-white/55">
          <LegendDot color={THEME.tertiary} label="Entradas" />
          <LegendDot color={THEME.primary} label="Resultado" />
          <LegendDot color={THEME.danger} label="Gastos" />
        </div>

        <div className="ge-mobile-chart-box min-h-0 flex-1 rounded-[24px] border border-white/10 bg-white/[0.02] p-3 sm:p-4">
          {data.length === 0 ? (
            <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-white/45">
              Sem dados suficientes para montar o gráfico.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="h-full min-h-[160px] w-full sm:min-h-[210px]"
              preserveAspectRatio="none"
            >
              {[0, 1, 2, 3, 4].map((line) => {
                const y = paddingTop + line * (plotHeight / 4);

                return (
                  <line
                    key={line}
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="8 8"
                  />
                );
              })}

              <path
                d={pathFor("entradas")}
                fill="none"
                stroke={THEME.tertiary}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={pathFor("resultado")}
                fill="none"
                stroke={THEME.primary}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={pathFor("gastos")}
                fill="none"
                stroke={THEME.danger}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {data.map((item, index) => (
                <g key={item.label}>
                  <circle
                    cx={getX(index)}
                    cy={getY(item.entradas)}
                    r="5"
                    fill={THEME.tertiary}
                  />
                  <circle
                    cx={getX(index)}
                    cy={getY(Math.max(0, item.resultado))}
                    r="5"
                    fill={THEME.primary}
                  />
                  <circle
                    cx={getX(index)}
                    cy={getY(item.gastos)}
                    r="5"
                    fill={THEME.danger}
                  />
                  <text
                    x={getX(index)}
                    y={labelY}
                    fill="rgba(255,255,255,0.45)"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {item.label}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />
      {label}
    </span>
  );
}
