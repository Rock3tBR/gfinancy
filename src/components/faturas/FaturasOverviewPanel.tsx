import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { brl, ptDate } from "@/lib/format";
import { ymd } from "@/lib/fatura";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  Receipt,
  Search,
  XCircle,
} from "lucide-react";

type CardRow = {
  id: string;
  entity_id: string | null;
  nome: string;
  bandeira: string;
  cor: string;
  dia_vencimento: number;
  dia_fechamento: number;
};

type TransactionRow = {
  id: string;
  user_id?: string | null;
  entity_id: string | null;
  card_id: string | null;

  descricao?: string | null;
  categoria?: string | null;
  data_compra?: string | null;

  valor?: number | string | null;
  valor_total?: number | string | null;
  valor_total_compra?: number | string | null;
  amount?: number | string | null;

  parcelas?: number | string | null;
  total_parcelas?: number | string | null;
  numero_parcelas?: number | string | null;
  qtd_parcelas?: number | string | null;
  installments?: number | string | null;

  parcela_atual_importada?: number | string | null;
  total_parcelas_importadas?: number | string | null;
  fatura_mes_importada?: string | null;

  tipo?: string | null;
  type?: string | null;
  natureza?: string | null;
};

type Invoice = {
  id: string;
  entity_id: string | null;
  card_id: string;
  fatura_mes: string;
  paid_at: string | null;
  valor_pago: number | null;
};

type Status = "aberta" | "fechada" | "vencida" | "paga" | "parcial";

type ExpenseItem = {
  id: string;
  transactionId: string;
  descricao: string;
  categoria: string;
  data_compra: string;
  valor: number;
  numero_parcela: number;
  total_parcelas: number;
  fatura_mes: string;
};

type Row = {
  card: CardRow;
  fatura_mes: string;
  total: number;
  valor_pago: number;
  saldo: number;
  paid_at: string | null;
  invoiceId: string | null;
  vencimento: Date;
  fechamento: Date;
  inicioPeriodo: Date;
  fimPeriodo: Date;
  status: Status;
  expenses: ExpenseItem[];
};

type FaturasOverviewPanelProps = {
  filtersOpen?: boolean;
};

/**
 * Cria uma data sem deixar o JavaScript avançar para o mês seguinte
 * quando o dia não existe naquele mês.
 */
function safeDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, lastDay));

  return new Date(year, monthIndex, safeDay);
}

function dateOnly(date: Date) {
  const copy = new Date(date);

  copy.setHours(0, 0, 0, 0);

  return copy;
}

/**
 * Faz a leitura de uma data no formato YYYY-MM-DD sem problemas
 * de fuso horário.
 */
function parseDate(value: string | null | undefined) {
  if (!value) return null;

  const normalized = String(value).slice(0, 10);
  const parts = normalized.split("-").map(Number);

  if (parts.length !== 3) return null;

  const [year, month, day] = parts;

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return null;

  return dateOnly(date);
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) return fallback;

  const normalized =
    trimmed.includes(",") && trimmed.includes(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeInteger(value: unknown, fallback = 1) {
  const parsed = Math.trunc(normalizeNumber(value, fallback));

  return parsed > 0 ? parsed : fallback;
}

function getTransactionValue(transaction: TransactionRow) {
  const possibleValues = [
    transaction.valor_total_compra,
    transaction.valor_total,
    transaction.valor,
    transaction.amount,
  ];

  for (const value of possibleValues) {
    const parsed = normalizeNumber(value, 0);

    if (parsed !== 0) {
      return Math.abs(parsed);
    }
  }

  return 0;
}

function getTransactionInstallments(transaction: TransactionRow) {
  const possibleInstallments = [
    transaction.total_parcelas,
    transaction.numero_parcelas,
    transaction.qtd_parcelas,
    transaction.parcelas,
    transaction.installments,
  ];

  for (const value of possibleInstallments) {
    const parsed = normalizeInteger(value, 0);

    if (parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function isExpenseTransaction(transaction: TransactionRow) {
  if (!transaction.card_id) return false;

  const transactionType = String(
    transaction.tipo ??
      transaction.type ??
      transaction.natureza ??
      "",
  )
    .trim()
    .toLowerCase();

  // FIX (2026-07-15): "credito"/"crédito" estavam nesta lista de tipos
  // IGNORADOS, mas no schema deste app (enum public.transaction_type:
  // 'entrada' | 'debito' | 'credito') o valor 'credito' significa "compra
  // no cartão de crédito" — ou seja, é exatamente o tipo de transação que
  // gera fatura. Só transações com card_id chegam até aqui (checado acima),
  // e a ÚNICA tipo que sempre tem card_id é 'credito' (ver transacoes.tsx e
  // InvoiceImportDialog.tsx, que sempre gravam tipo: "credito" para compras
  // no cartão). Com "credito"/"crédito" na lista de ignorados, TODA compra
  // no cartão era descartada aqui, e a página de Faturas ficava sempre
  // vazia ("Nenhuma fatura encontrada"), mesmo com dezenas de transações
  // reais. Os demais valores da lista (receita/entrada/pagamento/estorno/
  // etc.) não existem de fato como `tipo` neste schema — são mantidos como
  // proteção extra, caso o campo venha de uma fonte com nomes diferentes.
  const ignoredTypes = [
    "receita",
    "entrada",
    "income",
    "pagamento",
    "payment",
    "estorno",
    "refund",
    "reembolso",
  ];

  if (ignoredTypes.includes(transactionType)) {
    return false;
  }

  return getTransactionValue(transaction) > 0;
}

/**
 * Regra informada:
 *
 * - Mês com 30 dias: fechamento configurado + 1.
 * - Mês com 31 dias: fechamento normal.
 * - Fevereiro mantém o fechamento configurado, limitado ao último dia.
 *
 * Exemplo:
 * fechamento configurado = 6
 *
 * Junho, que possui 30 dias:
 * fechamento efetivo = 7
 *
 * Julho, que possui 31 dias:
 * fechamento efetivo = 6
 */
function getEffectiveClosingDay(
  year: number,
  monthIndex: number,
  configuredClosingDay: number,
) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  const adjustedClosingDay =
    lastDay === 30
      ? configuredClosingDay + 1
      : configuredClosingDay;

  return Math.max(1, Math.min(adjustedClosingDay, lastDay));
}

function getClosingDate(
  year: number,
  monthIndex: number,
  configuredClosingDay: number,
) {
  const closingDay = getEffectiveClosingDay(
    year,
    monthIndex,
    configuredClosingDay,
  );

  return safeDate(year, monthIndex, closingDay);
}

/**
 * Descobre em qual fatura a primeira parcela deve entrar.
 *
 * Compra feita até o fechamento:
 * entra na fatura do mesmo mês.
 *
 * Compra feita depois do fechamento:
 * entra na fatura do mês seguinte.
 */
function getFirstInvoiceMonth(
  purchaseDate: Date,
  configuredClosingDay: number,
) {
  const year = purchaseDate.getFullYear();
  const monthIndex = purchaseDate.getMonth();

  const closingDay = getEffectiveClosingDay(
    year,
    monthIndex,
    configuredClosingDay,
  );

  const shouldMoveToNextMonth =
    purchaseDate.getDate() > closingDay;

  return new Date(
    year,
    monthIndex + (shouldMoveToNextMonth ? 1 : 0),
    1,
  );
}

function addMonths(date: Date, amount: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1,
  );
}

function getInvoiceMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

/**
 * Divide o valor em centavos para evitar diferenças como:
 *
 * 100 / 3 = 33,333333...
 *
 * Resultado:
 * 33,34
 * 33,33
 * 33,33
 */
function splitValueIntoInstallments(
  totalValue: number,
  totalInstallments: number,
) {
  const safeInstallments = Math.max(1, totalInstallments);
  const totalInCents = Math.round(Math.abs(totalValue) * 100);

  const baseInstallment = Math.floor(
    totalInCents / safeInstallments,
  );

  const remainder = totalInCents % safeInstallments;

  return Array.from(
    { length: safeInstallments },
    (_, index) => {
      const cents =
        baseInstallment + (index < remainder ? 1 : 0);

      return cents / 100;
    },
  );
}

function generateTransactionInstallments(
  transaction: TransactionRow,
  card: CardRow,
): ExpenseItem[] {
  const purchaseDate = parseDate(transaction.data_compra);

  if (!purchaseDate) return [];

  const totalValue = getTransactionValue(transaction);

  if (totalValue <= 0) {
    return [];
  }

  if (transaction.fatura_mes_importada) {
    const currentInstallment = normalizeInteger(
      transaction.parcela_atual_importada,
      1,
    );

    const totalInstallments = Math.max(
      currentInstallment,
      normalizeInteger(
        transaction.total_parcelas_importadas ?? transaction.parcelas,
        currentInstallment,
      ),
    );

    const firstImportedInvoiceMonth = parseDate(
      String(transaction.fatura_mes_importada).slice(0, 10),
    );

    if (!firstImportedInvoiceMonth) {
      return [];
    }

    const remainingInstallments =
      totalInstallments - currentInstallment + 1;

    return Array.from(
      { length: remainingInstallments },
      (_, index) => {
        const invoiceMonth = addMonths(
          firstImportedInvoiceMonth,
          index,
        );

        return {
          id: `${transaction.id}-imported-${currentInstallment + index}`,
          transactionId: transaction.id,
          descricao:
            transaction.descricao?.trim() || "Compra sem descrição",
          categoria:
            transaction.categoria?.trim() || "Sem categoria",
          data_compra: ymd(purchaseDate),
          valor: totalValue,
          numero_parcela: currentInstallment + index,
          total_parcelas: totalInstallments,
          fatura_mes: getInvoiceMonthKey(invoiceMonth),
        };
      },
    );
  }

  const totalInstallments = getTransactionInstallments(transaction);

  if (totalInstallments <= 0) {
    return [];
  }

  const firstInvoiceMonth = getFirstInvoiceMonth(
    purchaseDate,
    card.dia_fechamento,
  );

  const installmentValues = splitValueIntoInstallments(
    totalValue,
    totalInstallments,
  );

  return installmentValues.map((installmentValue, index) => {
    const invoiceMonth = addMonths(firstInvoiceMonth, index);

    return {
      id: `${transaction.id}-${index + 1}`,
      transactionId: transaction.id,
      descricao:
        transaction.descricao?.trim() ||
        "Compra sem descrição",
      categoria:
        transaction.categoria?.trim() ||
        "Sem categoria",
      data_compra: ymd(purchaseDate),
      valor: installmentValue,
      numero_parcela: index + 1,
      total_parcelas: totalInstallments,
      fatura_mes: getInvoiceMonthKey(invoiceMonth),
    };
  });
}

function getInvoiceDates(
  faturaMes: string,
  card: CardRow,
) {
  const [year, month] = faturaMes
    .slice(0, 7)
    .split("-")
    .map(Number);

  const monthIndex = month - 1;

  const fechamento = getClosingDate(
    year,
    monthIndex,
    card.dia_fechamento,
  );

  const vencimento = safeDate(
    year,
    monthIndex,
    card.dia_vencimento,
  );

  const previousMonth = new Date(year, monthIndex - 1, 1);

  const fechamentoAnterior = getClosingDate(
    previousMonth.getFullYear(),
    previousMonth.getMonth(),
    card.dia_fechamento,
  );

  const inicioPeriodo = new Date(fechamentoAnterior);

  inicioPeriodo.setDate(inicioPeriodo.getDate() + 1);

  return {
    vencimento: dateOnly(vencimento),
    fechamento: dateOnly(fechamento),
    inicioPeriodo: dateOnly(inicioPeriodo),
    fimPeriodo: dateOnly(fechamento),
  };
}

function getStatus(
  row: {
    total: number;
    valor_pago: number;
    paid_at: string | null;
    vencimento: Date;
    fechamento: Date;
  },
  today: Date,
): Status {
  const total = Math.max(0, Number(row.total || 0));

  const paid = Math.max(
    0,
    Math.min(Number(row.valor_pago || 0), total),
  );

  if (total > 0 && paid >= total - 0.01) {
    return "paga";
  }

  if (total > 0 && paid > 0 && paid < total - 0.01) {
    return "parcial";
  }

  const now = dateOnly(today);
  const due = dateOnly(row.vencimento);
  const close = dateOnly(row.fechamento);

  if (now > due) return "vencida";
  if (now > close) return "fechada";

  return "aberta";
}

function statusBadge(status: Status) {
  const base = "gap-1 rounded-full border";

  switch (status) {
    case "paga":
      return (
        <Badge
          className={`${base} border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Paga
        </Badge>
      );

    case "vencida":
      return (
        <Badge
          className={`${base} border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/10 dark:text-red-400`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Vencida
        </Badge>
      );

    case "parcial":
      return (
        <Badge
          className={`${base} border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400`}
        >
          <Clock className="h-3.5 w-3.5" />
          Parcial
        </Badge>
      );

    case "fechada":
      return (
        <Badge
          className={`${base} border-border bg-muted text-muted-foreground hover:bg-muted`}
        >
          <Receipt className="h-3.5 w-3.5" />
          Fechada
        </Badge>
      );

    case "aberta":
      return (
        <Badge
          className={`${base} border-blue-500/20 bg-blue-500/10 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400`}
        >
          <Clock className="h-3.5 w-3.5" />
          Aberta
        </Badge>
      );
  }
}

function formatFaturaMes(value: string) {
  const [year, month] = value.slice(0, 7).split("-");

  return `${month}/${year}`;
}

function formatFaturaMesLong(value: string) {
  const [year, month] = value
    .slice(0, 7)
    .split("-")
    .map(Number);

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function FaturasOverviewPanel({
  filtersOpen = false,
}: FaturasOverviewPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const today = useMemo(() => new Date(), []);

  const [cardFilter, setCardFilter] =
    useState("__all__");

  const [statusFilter, setStatusFilter] =
    useState("__all__");

  const [search, setSearch] = useState("");

  const [expensesDialog, setExpensesDialog] =
    useState<Row | null>(null);

  const [paymentDialog, setPaymentDialog] = useState<{
    row: Row;
    type: "full" | "partial";
  } | null>(null);

  const [payDate, setPayDate] = useState(ymd(today));
  const [payAmount, setPayAmount] = useState("");

  const {
    data: cards = [],
    isLoading: cardsLoading,
  } = useQuery({
    queryKey: [
      "cards",
      user?.id,
      selectedEntityId,
    ],

    enabled: Boolean(user && selectedEntityId),

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

  /**
   * Agora a página de faturas lê diretamente a tabela transactions.
   *
   * A tabela installments não é mais usada para calcular o total
   * das faturas.
   */
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
  } = useQuery({
    queryKey: [
      "invoice-transactions",
      user?.id,
      selectedEntityId,
    ],

    enabled: Boolean(user && selectedEntityId),

    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .not("card_id", "is", null)
        .order("data_compra", {
          ascending: true,
        });

      if (error) throw error;

      return (data ?? []) as TransactionRow[];
    },
  });

  /**
   * A tabela invoices continua sendo utilizada apenas para guardar
   * pagamentos realizados.
   *
   * O valor total da fatura não vem mais de invoices.
   */
  const {
    data: invoices = [],
    isLoading: invoicesLoading,
  } = useQuery({
    queryKey: [
      "invoices",
      user?.id,
      selectedEntityId,
    ],

    enabled: Boolean(user && selectedEntityId),

    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select(
          "id,entity_id,card_id,fatura_mes,paid_at,valor_pago",
        )
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return (data ?? []) as Invoice[];
    },
  });

  const isLoading =
    cardsLoading ||
    transactionsLoading ||
    invoicesLoading;

  const rows: Row[] = useMemo(() => {
    const cardsById = new Map(
      cards.map((card) => [card.id, card]),
    );

    const invoicesByKey = new Map<string, Invoice>();

    for (const invoice of invoices) {
      const invoiceMonth = String(
        invoice.fatura_mes,
      ).slice(0, 7);

      const key = `${invoice.card_id}|${invoiceMonth}`;

      invoicesByKey.set(key, invoice);
    }

    const expensesByInvoice = new Map<
      string,
      ExpenseItem[]
    >();

    for (const transaction of transactions) {
      if (!isExpenseTransaction(transaction)) {
        continue;
      }

      const card = transaction.card_id
        ? cardsById.get(transaction.card_id)
        : null;

      if (!card) continue;

      const generatedInstallments =
        generateTransactionInstallments(
          transaction,
          card,
        );

      for (const installment of generatedInstallments) {
        const invoiceMonth = installment.fatura_mes.slice(
          0,
          7,
        );

        const key = `${card.id}|${invoiceMonth}`;

        const currentExpenses =
          expensesByInvoice.get(key) ?? [];

        currentExpenses.push(installment);

        expensesByInvoice.set(key, currentExpenses);
      }
    }

    const generatedRows: Row[] = [];

    for (const [
      key,
      invoiceExpenses,
    ] of expensesByInvoice.entries()) {
      const [cardId, invoiceMonth] = key.split("|");

      const card = cardsById.get(cardId);

      if (!card) continue;

      const invoice = invoicesByKey.get(key);

      const total = invoiceExpenses.reduce(
        (sum, expense) => sum + expense.valor,
        0,
      );

      const roundedTotal =
        Math.round(total * 100) / 100;

      if (roundedTotal <= 0) {
        continue;
      }

      const rawPaidValue = Number(
        invoice?.valor_pago ?? 0,
      );

      const paidValue = Math.max(
        0,
        Math.min(rawPaidValue, roundedTotal),
      );

      const roundedPaidValue =
        Math.round(paidValue * 100) / 100;

      const balance = Math.max(
        0,
        Math.round(
          (roundedTotal - roundedPaidValue) * 100,
        ) / 100,
      );

      const dates = getInvoiceDates(
        `${invoiceMonth}-01`,
        card,
      );

      const baseRow = {
        card,
        fatura_mes: `${invoiceMonth}-01`,
        total: roundedTotal,
        valor_pago: roundedPaidValue,
        saldo: balance,
        paid_at: invoice?.paid_at ?? null,
        invoiceId: invoice?.id ?? null,
        vencimento: dates.vencimento,
        fechamento: dates.fechamento,
        inicioPeriodo: dates.inicioPeriodo,
        fimPeriodo: dates.fimPeriodo,
        expenses: [...invoiceExpenses].sort(
          (a, b) => {
            const dateComparison =
              a.data_compra.localeCompare(
                b.data_compra,
              );

            if (dateComparison !== 0) {
              return dateComparison;
            }

            return (
              a.numero_parcela -
              b.numero_parcela
            );
          },
        ),
      };

      generatedRows.push({
        ...baseRow,
        status: getStatus(baseRow, today),
      });
    }

    return generatedRows.sort((a, b) => {
      const aPaid = a.status === "paga" ? 1 : 0;
      const bPaid = b.status === "paga" ? 1 : 0;

      if (aPaid !== bPaid) {
        return aPaid - bPaid;
      }

      return a.fatura_mes.localeCompare(
        b.fatura_mes,
      );
    });
  }, [cards, transactions, invoices, today]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const normalizedSearch = search
        .trim()
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        row.card.nome
          .toLowerCase()
          .includes(normalizedSearch) ||
        row.card.bandeira
          .toLowerCase()
          .includes(normalizedSearch) ||
        formatFaturaMes(row.fatura_mes).includes(
          normalizedSearch,
        ) ||
        formatFaturaMesLong(row.fatura_mes)
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesCard =
        cardFilter === "__all__" ||
        row.card.id === cardFilter;

      const matchesStatus =
        statusFilter === "__all__" ||
        row.status === statusFilter;

      return (
        matchesSearch &&
        matchesCard &&
        matchesStatus
      );
    });
  }, [
    rows,
    search,
    cardFilter,
    statusFilter,
  ]);

  const totals = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator.total += row.total;
        accumulator.pago += row.valor_pago;
        accumulator.saldo += row.saldo;

        if (row.status === "vencida") {
          accumulator.vencido += row.saldo;
        }

        if (row.status === "paga") {
          accumulator.pagas += 1;
        } else {
          accumulator.abertas += 1;
        }

        return accumulator;
      },
      {
        total: 0,
        pago: 0,
        saldo: 0,
        vencido: 0,
        pagas: 0,
        abertas: 0,
      },
    );
  }, [rows]);

  const payInvoice = useMutation({
    mutationFn: async ({
      row,
      date,
      amount,
    }: {
      row: Row;
      date: string;
      amount: number;
    }) => {
      if (!user) {
        throw new Error(
          "Usuário não autenticado.",
        );
      }

      if (!selectedEntityId) {
        throw new Error(
          "Nenhuma entidade financeira selecionada.",
        );
      }

      const normalizedAmount =
        Math.round(Number(amount) * 100) / 100;

      if (
        !Number.isFinite(normalizedAmount) ||
        normalizedAmount <= 0
      ) {
        throw new Error(
          "Informe um valor válido.",
        );
      }

      if (
        normalizedAmount >
        row.total + 0.001
      ) {
        throw new Error(
          "O valor pago não pode ser maior que o total da fatura.",
        );
      }

      const isFullPayment =
        normalizedAmount >= row.total - 0.01;

      const payload = {
        user_id: user.id,
        entity_id: selectedEntityId,
        card_id: row.card.id,
        fatura_mes: row.fatura_mes,
        valor_pago: isFullPayment
          ? row.total
          : normalizedAmount,
        paid_at: isFullPayment ? date : null,
      };

      if (row.invoiceId) {
        const { error } = await (
          supabase as any
        )
          .from("invoices")
          .update(payload)
          .eq("id", row.invoiceId)
          .eq("user_id", user.id)
          .eq(
            "entity_id",
            selectedEntityId,
          );

        if (error) throw error;

        return;
      }

      const { error } = await (
        supabase as any
      )
        .from("invoices")
        .insert(payload);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Fatura atualizada");

      queryClient.invalidateQueries({
        queryKey: ["invoices"],
      });

      queryClient.invalidateQueries({
        queryKey: ["invoice-transactions"],
      });

      queryClient.invalidateQueries({
        queryKey: ["txs"],
      });

      setPaymentDialog(null);
      setPayAmount("");
      setPayDate(ymd(today));
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const unpayInvoice = useMutation({
    mutationFn: async (row: Row) => {
      if (!user) {
        throw new Error(
          "Usuário não autenticado.",
        );
      }

      if (!selectedEntityId) {
        throw new Error(
          "Nenhuma entidade financeira selecionada.",
        );
      }

      if (!row.invoiceId) return;

      const { error } = await (
        supabase as any
      )
        .from("invoices")
        .update({
          paid_at: null,
          valor_pago: 0,
        })
        .eq("id", row.invoiceId)
        .eq("user_id", user.id)
        .eq(
          "entity_id",
          selectedEntityId,
        );

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Pagamento desfeito");

      queryClient.invalidateQueries({
        queryKey: ["invoices"],
      });

      queryClient.invalidateQueries({
        queryKey: ["invoice-transactions"],
      });

      queryClient.invalidateQueries({
        queryKey: ["txs"],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function openFullPayment(
    row: Row,
    directToday = false,
  ) {
    if (directToday) {
      payInvoice.mutate({
        row,
        date: ymd(today),
        amount: row.total,
      });

      return;
    }

    setPayDate(ymd(today));
    setPayAmount(String(row.total));

    setPaymentDialog({
      row,
      type: "full",
    });
  }

  function openPartialPayment(row: Row) {
    setPayDate(ymd(today));

    setPayAmount(
      row.valor_pago > 0
        ? String(row.valor_pago)
        : "",
    );

    setPaymentDialog({
      row,
      type: "partial",
    });
  }

  function confirmPayment() {
    if (!paymentDialog) return;

    const amount =
      paymentDialog.type === "full"
        ? paymentDialog.row.total
        : normalizeNumber(payAmount, 0);

    payInvoice.mutate({
      row: paymentDialog.row,
      date: payDate,
      amount,
    });
  }

  if (entityLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          Carregando entidade financeira...
        </div>
      </div>
    );
  }

  if (!selectedEntityId || !selectedEntity) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/10 shadow-sm">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

          <div>
            <h2 className="font-semibold text-foreground">
              Nenhuma entidade financeira
              selecionada
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Selecione uma entidade para
              visualizar suas faturas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Faturas
            </p>

            <p className="mt-2 text-2xl font-bold text-foreground">
              {rows.length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Pagas
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {totals.pagas}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Em aberto
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-600">
              {totals.abertas}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Saldo restante
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {brl(totals.saldo)}
            </p>
          </CardContent>
        </Card>
      </section>

      {filtersOpen && (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por cartão, bandeira ou mês da fatura..."
                className="pl-9"
              />
            </div>

            <Select
              value={cardFilter}
              onValueChange={setCardFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Cartão" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__all__">
                  Todos os cartões
                </SelectItem>

                {cards.map((card) => (
                  <SelectItem
                    key={card.id}
                    value={card.id}
                  >
                    {card.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="__all__">
                  Todos os status
                </SelectItem>

                <SelectItem value="aberta">
                  Aberta
                </SelectItem>

                <SelectItem value="fechada">
                  Fechada
                </SelectItem>

                <SelectItem value="vencida">
                  Vencida
                </SelectItem>

                <SelectItem value="parcial">
                  Parcial
                </SelectItem>

                <SelectItem value="paga">
                  Paga
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Carregando faturas...
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>

            <h3 className="mt-4 font-semibold text-foreground">
              Nenhuma fatura encontrada em{" "}
              {selectedEntity.name}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Cadastre compras no crédito para
              gerar faturas ou ajuste os filtros
              atuais.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRows.map((row) => {
            const paidPercent =
              row.total > 0
                ? Math.min(
                    100,
                    (row.valor_pago /
                      row.total) *
                      100,
                  )
                : 0;

            return (
              <Card
                key={`${row.card.id}-${row.fatura_mes}`}
                className="overflow-hidden border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="h-1.5"
                  style={{
                    backgroundColor:
                      row.card.cor || "#1e293b",
                  }}
                />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base text-foreground">
                          {row.card.nome}
                        </CardTitle>

                        <Badge variant="secondary">
                          {row.card.bandeira ||
                            "Cartão"}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Fatura{" "}
                        {formatFaturaMesLong(
                          row.fatura_mes,
                        )}
                      </p>
                    </div>

                    {statusBadge(row.status)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Valor total
                      </p>

                      <p className="mt-1 text-xl font-bold text-foreground">
                        {brl(row.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Saldo restante
                      </p>

                      <p className="mt-1 text-xl font-bold text-red-600">
                        {brl(row.saldo)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Pagamento
                      </span>

                      <span className="font-medium text-foreground/80">
                        {brl(row.valor_pago)} /{" "}
                        {brl(row.total)}
                      </span>
                    </div>

                    <Progress value={paidPercent} />

                    {row.paid_at && (
                      <p className="mt-2 text-xs text-emerald-600">
                        Paga em{" "}
                        {ptDate(row.paid_at)}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 border-t border-border pt-4 text-sm md:grid-cols-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground/70" />

                      <span>
                        Período:{" "}
                        {ptDate(
                          ymd(row.inicioPeriodo),
                        )}{" "}
                        a{" "}
                        {ptDate(
                          ymd(row.fimPeriodo),
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground/70" />

                      <span>
                        Vence:{" "}
                        {ptDate(
                          ymd(row.vencimento),
                        )}
                      </span>
                    </div>
                  </div>

                  {row.status === "paga" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={
                        unpayInvoice.isPending
                      }
                      onClick={() =>
                        unpayInvoice.mutate(row)
                      }
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Desfazer pagamento
                    </Button>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button
                        size="sm"
                        onClick={() =>
                          openFullPayment(
                            row,
                            true,
                          )
                        }
                        disabled={
                          payInvoice.isPending
                        }
                      >
                        Pagar hoje
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openFullPayment(row)
                        }
                      >
                        Já paguei
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openPartialPayment(row)
                        }
                      >
                        Pago parcial
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setExpensesDialog(row)
                    }
                  >
                    <ListChecks className="mr-2 h-4 w-4" />
                    Mostrar gastos
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(expensesDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setExpensesDialog(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Gastos de{" "}
              {expensesDialog
                ? formatFaturaMesLong(
                    expensesDialog.fatura_mes,
                  )
                : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {!expensesDialog ||
            expensesDialog.expenses.length ===
              0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum gasto encontrado nesta
                fatura.
              </p>
            ) : (
              expensesDialog.expenses.map(
                (expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {expense.descricao}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {ptDate(
                          expense.data_compra,
                        )}{" "}
                        · {expense.categoria}
                        {expense.total_parcelas >
                        1
                          ? ` · ${expense.numero_parcela}/${expense.total_parcelas}`
                          : ""}
                      </p>
                    </div>

                    <span className="shrink-0 font-semibold">
                      {brl(expense.valor)}
                    </span>
                  </div>
                ),
              )
            )}
          </div>

          <DialogFooter>
            <div className="flex w-full items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Total dos gastos listados
              </span>

              <span className="font-bold">
                {brl(
                  expensesDialog?.expenses.reduce(
                    (total, expense) =>
                      total + expense.valor,
                    0,
                  ) ?? 0,
                )}
              </span>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(paymentDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentDialog(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {paymentDialog?.type ===
              "partial"
                ? "Pagamento parcial"
                : "Confirmar pagamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Data do pagamento</Label>

              <Input
                type="date"
                value={payDate}
                onChange={(event) =>
                  setPayDate(
                    event.target.value,
                  )
                }
              />
            </div>

            {paymentDialog?.type ===
              "partial" && (
              <div>
                <Label>
                  Valor pago até agora
                </Label>

                <Input
                  type="number"
                  min="0"
                  max={
                    paymentDialog.row.total
                  }
                  step="0.01"
                  value={payAmount}
                  onChange={(event) =>
                    setPayAmount(
                      event.target.value,
                    )
                  }
                  placeholder="Ex: 250,00"
                />

                <p className="mt-1 text-xs text-muted-foreground">
                  Informe o total já pago
                  nesta fatura, e não apenas
                  o último pagamento.
                </p>
              </div>
            )}

            {paymentDialog && (
              <Card className="border-border bg-muted/40">
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Fatura
                    </span>

                    <span className="text-right font-medium">
                      {
                        paymentDialog.row.card
                          .nome
                      }{" "}
                      —{" "}
                      {formatFaturaMesLong(
                        paymentDialog.row
                          .fatura_mes,
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total
                    </span>

                    <span className="font-bold">
                      {brl(
                        paymentDialog.row
                          .total,
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Saldo atual
                    </span>

                    <span className="font-bold text-red-600">
                      {brl(
                        paymentDialog.row
                          .saldo,
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() =>
                setPaymentDialog(null)
              }
            >
              Cancelar
            </Button>

            <Button
              onClick={confirmPayment}
              disabled={
                payInvoice.isPending
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}