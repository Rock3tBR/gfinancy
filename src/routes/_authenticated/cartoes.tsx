import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { FinancialEntitySelector } from "@/components/FinancialEntitySelector";
import {
  BANKS,
  BankAvatar,
  getBankById,
  inferBankFromCardName,
} from "@/components/cards/BankAvatar";
import { PLAN_META } from "@/lib/plans";
import { brl } from "@/lib/format";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

import {
  AlertCircle,
  Building2,
  CalendarDays,
  CreditCard,
  Crown,
  Landmark,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";

type CartoesSearch = {
  novo?: boolean;
};

export const Route = createFileRoute("/_authenticated/cartoes")({
  component: CartoesPage,
  validateSearch: (search: Record<string, unknown>): CartoesSearch => ({
    novo: search.novo === true || search.novo === "true" ? true : undefined,
  }),
});

type CardRow = {
  id: string;
  user_id: string;
  entity_id: string | null;
  nome: string;
  bandeira: string;
  limite: number;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string;
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

type InvoiceRow = {
  id: string;
  card_id: string;
  entity_id: string | null;
  fatura_mes: string;
  paid_at: string | null;
  valor_pago: number | null;
};

type ProjectedInstallment = {
  fatura_mes: string;
  valor: number;
  dataCompra: Date;
};

type ProjectedInvoice = {
  cardId: string;
  faturaMes: string;
  total: number;
  valorPago: number;
  saldo: number;
  paidAt: string | null;
  vencimento: Date;
};

const BANDEIRAS = [
  "Visa",
  "Mastercard",
  "Elo",
  "American Express",
  "Hipercard",
] as const;

const CORES = [
  "#D9FF66",
  "#A88BFF",
  "#2ECC71",
  "#3BA3FF",
  "#FF4D5E",
  "#EF4444",
  "#8A05BE",
  "#FF7A00",
  "#111827",
];

function formatMaxCards(value: number) {
  if (value === Infinity) return "Ilimitado";

  return String(value);
}

function formatFaturaMes(value: string) {
  if (!value) return "—";

  const [year, month] = value.split("-");

  if (!year || !month) return value;

  return `${month}/${year}`;
}

function safeDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.max(1, Math.min(day, lastDay)));
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
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
  const values = [
    transaction.valor_total_compra,
    transaction.valor_total,
    transaction.valor,
    transaction.amount,
  ];
  for (const value of values) {
    const parsed = normalizeNumber(value, 0);
    if (parsed !== 0) return Math.abs(parsed);
  }
  return 0;
}

function getTransactionInstallments(transaction: TransactionRow) {
  const values = [
    transaction.total_parcelas,
    transaction.numero_parcelas,
    transaction.qtd_parcelas,
    transaction.parcelas,
    transaction.installments,
  ];
  for (const value of values) {
    const parsed = normalizeInteger(value, 0);
    if (parsed > 0) return parsed;
  }
  return 1;
}

function isExpenseTransaction(transaction: TransactionRow) {
  if (!transaction.card_id) return false;
  const type = String(
    transaction.tipo ?? transaction.type ?? transaction.natureza ?? "",
  )
    .trim()
    .toLowerCase();
  const ignored = [
    "receita",
    "entrada",
    "income",
    "pagamento",
    "payment",
    "estorno",
    "refund",
    "reembolso",
  ];
  return !ignored.includes(type) && getTransactionValue(transaction) > 0;
}

function getEffectiveClosingDay(
  year: number,
  monthIndex: number,
  configuredClosingDay: number,
) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const adjusted =
    lastDay === 30 ? configuredClosingDay + 1 : configuredClosingDay;
  return Math.max(1, Math.min(adjusted, lastDay));
}

function getFirstInvoiceMonth(purchaseDate: Date, closingDay: number) {
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth();
  const effectiveClosingDay = getEffectiveClosingDay(year, month, closingDay);
  return new Date(
    year,
    month + (purchaseDate.getDate() > effectiveClosingDay ? 1 : 0),
    1,
  );
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getInvoiceMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function splitValueIntoInstallments(
  totalValue: number,
  totalInstallments: number,
) {
  const quantity = Math.max(1, totalInstallments);
  const cents = Math.round(Math.abs(totalValue) * 100);
  const base = Math.floor(cents / quantity);
  const remainder = cents % quantity;
  return Array.from(
    { length: quantity },
    (_, index) => (base + (index < remainder ? 1 : 0)) / 100,
  );
}

function projectTransactionInstallments(
  transaction: TransactionRow,
  card: CardRow,
): ProjectedInstallment[] {
  const purchaseDate = parseDate(transaction.data_compra);
  const totalValue = getTransactionValue(transaction);
  if (!purchaseDate || totalValue <= 0) return [];

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
    const importedInvoiceMonth = parseDate(transaction.fatura_mes_importada);
    if (!importedInvoiceMonth) return [];

    return Array.from(
      { length: totalInstallments - currentInstallment + 1 },
      (_, index) => ({
        fatura_mes: getInvoiceMonthKey(addMonths(importedInvoiceMonth, index)),
        valor: totalValue,
        dataCompra: purchaseDate,
      }),
    );
  }

  const totalInstallments = getTransactionInstallments(transaction);
  const firstInvoiceMonth = getFirstInvoiceMonth(
    purchaseDate,
    card.dia_fechamento,
  );
  const values = splitValueIntoInstallments(totalValue, totalInstallments);

  return values.map((value, index) => ({
    fatura_mes: getInvoiceMonthKey(addMonths(firstInvoiceMonth, index)),
    valor: value,
    dataCompra: purchaseDate,
  }));
}

function getInvoiceDueDate(faturaMes: string, card: CardRow) {
  const [year, month] = faturaMes.slice(0, 7).split("-").map(Number);
  return safeDate(year, month - 1, card.dia_vencimento);
}

function CartoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const { plan, getLimit, reachedLimit, openUpgrade } = usePlan();
  const planMeta = PLAN_META[plan];

  const [open, setOpen] = useState(false);

  // Permite abrir o formulário de cadastro direto ao chegar em /cartoes?novo=true
  // (usado pelo atalho "Adicionar cartão" das Ações rápidas do início). Reusa
  // handleOpenNewCard (declarado abaixo) para respeitar as mesmas checagens
  // de entidade selecionada e limite de plano do botão "Novo cartão".
  useEffect(() => {
    if (search.novo) {
      handleOpenNewCard();
      navigate({
        to: "/cartoes",
        search: {},
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.novo]);

  const maxCards = getLimit("maxCards");

  const { data: allCardsCount = 0 } = useQuery({
    queryKey: ["cards-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("cards")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user!.id);

      if (error) throw error;

      return count ?? 0;
    },
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", user?.id, selectedEntityId],
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

  const { data: transactions = [] } = useQuery({
    queryKey: ["invoice-transactions", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .not("card_id", "is", null)
        .order("data_compra", { ascending: true });

      if (error) throw error;
      return (data ?? []) as TransactionRow[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id,card_id,entity_id,fatura_mes,paid_at,valor_pago")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });

  const projectedInvoices = useMemo(() => {
    const cardsById = new Map(cards.map((card) => [card.id, card]));

    const invoicesByKey = new Map(
      invoices.map((invoice) => [
        `${invoice.card_id}|${String(invoice.fatura_mes).slice(0, 7)}`,
        invoice,
      ]),
    );

    const valuesByKey = new Map<
      string,
      {
        total: number;
        saldo: number;
      }
    >();

    for (const transaction of transactions) {
      if (!isExpenseTransaction(transaction) || !transaction.card_id) {
        continue;
      }

      const card = cardsById.get(transaction.card_id);
      if (!card) continue;

      for (const installment of projectTransactionInstallments(
        transaction,
        card,
      )) {
        const key = `${card.id}|${installment.fatura_mes.slice(0, 7)}`;
        const invoice = invoicesByKey.get(key);
        const paymentDate = parseDate(invoice?.paid_at);

        /*
         * Uma fatura já paga só quita esta parcela quando o pagamento
         * ocorreu na mesma data ou depois da compra.
         *
         * Isso evita o erro em que uma nova compra é vinculada a uma
         * competência que já possuía um registro antigo marcado como pago.
         * Nesse caso, a nova compra continua comprometendo o limite.
         */
        const installmentWasPaid =
          Boolean(paymentDate) &&
          paymentDate!.getTime() >= installment.dataCompra.getTime();

        const current = valuesByKey.get(key) ?? {
          total: 0,
          saldo: 0,
        };

        current.total += installment.valor;

        if (!installmentWasPaid) {
          current.saldo += installment.valor;
        }

        valuesByKey.set(key, current);
      }
    }

    const result: ProjectedInvoice[] = [];

    for (const [key, rawValues] of valuesByKey.entries()) {
      const [cardId, month] = key.split("|");
      const card = cardsById.get(cardId);
      if (!card) continue;

      const invoice = invoicesByKey.get(key);
      const total =
        Math.round(rawValues.total * 100) / 100;
      const saldo =
        Math.round(rawValues.saldo * 100) / 100;
      const valorPago =
        Math.max(0, Math.round((total - saldo) * 100) / 100);

      result.push({
        cardId,
        faturaMes: `${month}-01`,
        total,
        valorPago,
        saldo,
        paidAt:
          saldo <= 0
            ? invoice?.paid_at ?? null
            : null,
        vencimento: getInvoiceDueDate(
          `${month}-01`,
          card,
        ),
      });
    }

    return result.sort(
      (a, b) =>
        a.vencimento.getTime() -
        b.vencimento.getTime(),
    );
  }, [cards, transactions, invoices]);

  const cardStats = useMemo(() => {
    const map = new Map<
      string,
      {
        faturaMes: string;
        faturaAtual: number;
        usado: number;
        disponivel: number;
        percentual: number;
      }
    >();

    for (const card of cards) {
      const cardInvoices = projectedInvoices.filter(
        (invoice) => invoice.cardId === card.id,
      );

      const unpaidInvoices = cardInvoices.filter(
        (invoice) => !invoice.paidAt && invoice.saldo > 0,
      );

      const currentInvoice = unpaidInvoices[0] ?? cardInvoices[0] ?? null;
      const used = unpaidInvoices.reduce(
        (sum, invoice) => sum + invoice.saldo,
        0,
      );
      const limit = Number(card.limite || 0);
      const available = Math.max(0, limit - used);
      const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

      map.set(card.id, {
        faturaMes: currentInvoice?.faturaMes ?? "",
        faturaAtual: currentInvoice?.saldo ?? 0,
        usado: Math.round(used * 100) / 100,
        disponivel: available,
        percentual: percentage,
      });
    }

    return map;
  }, [cards, projectedInvoices]);

  const totals = useMemo(() => {
    const limiteTotal = cards.reduce(
      (sum, card) => sum + Number(card.limite || 0),
      0,
    );

    const usadoTotal = Array.from(cardStats.values()).reduce(
      (sum, stat) => sum + stat.usado,
      0,
    );

    return {
      limiteTotal,
      usadoTotal,
      disponivelTotal: Math.max(0, limiteTotal - usadoTotal),
    };
  }, [cards, cardStats]);

  const reachedCardLimit = reachedLimit("maxCards", allCardsCount);

  function handleOpenNewCard() {
    if (!selectedEntityId) {
      toast.error(
        "Selecione uma entidade financeira antes de criar um cartão.",
      );
      return;
    }

    if (reachedCardLimit) {
      openUpgrade(
        maxCards === 1
          ? "O plano Grátis permite cadastrar apenas 1 cartão. Faça upgrade para o Pro e cadastre mais cartões."
          : `Seu plano permite cadastrar até ${maxCards} cartões. Faça upgrade para adicionar mais.`,
      );

      return;
    }

    setOpen(true);
  }

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      const { error } = await (supabase as any)
        .from("cards")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Cartão excluído");
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["cards-count"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

            <div>
              <h2 className="font-semibold text-white">
                Nenhuma entidade financeira selecionada
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/60">
                Selecione uma entidade para visualizar e cadastrar cartões.
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
          className="h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
          onClick={handleOpenNewCard}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo cartão
        </Button>

        <div className="ge-mobile-full rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-center text-xs text-white/55">
          {cards.length} nesta entidade · {allCardsCount}/
          {formatMaxCards(maxCards)} no plano
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Cartões"
          value={String(cards.length)}
          description={`Plano ${planMeta.name}`}
          icon={<WalletCards className="h-4 w-4" />}
          tone="primary"
        />

        <SummaryCard
          title="Limite total"
          value={brl(totals.limiteTotal)}
          description={`${allCardsCount}/${formatMaxCards(maxCards)} cartão(ões)`}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="secondary"
        />

        <SummaryCard
          title="Limite usado"
          value={brl(totals.usadoTotal)}
          description="Faturas em aberto"
          icon={<CreditCard className="h-4 w-4" />}
          tone="danger"
        />

        <SummaryCard
          title="Disponível"
          value={brl(totals.disponivelTotal)}
          description="Limite restante"
          icon={<Landmark className="h-4 w-4" />}
          tone="success"
        />
      </div>

      {reachedCardLimit && (
        <Card className="border-amber-500/30 bg-amber-500/10 text-white shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

              <div>
                <p className="text-sm font-semibold text-white">
                  Limite do plano atingido
                </p>

                <p className="mt-1 text-sm leading-5 text-white/60">
                  Seu plano atual permite cadastrar até{" "}
                  {formatMaxCards(maxCards)} cartão(ões). Faça upgrade para
                  adicionar mais cartões.
                </p>
              </div>
            </div>

            <Button
              type="button"
              className="rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
              onClick={() =>
                openUpgrade("Faça upgrade para o Pro e cadastre mais cartões.")
              }
            >
              <Crown className="mr-2 h-4 w-4" />
              Fazer upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#1A1A1A] text-white">
          <DialogHeader>
            <DialogTitle>Novo cartão</DialogTitle>
          </DialogHeader>

          <CardForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      {cardsLoading ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="flex items-center justify-center py-14 text-center">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando cartões...
            </div>
          </CardContent>
        </Card>
      ) : cards.length === 0 ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.045]">
              <CreditCard className="h-7 w-7 text-white/50" />
            </div>

            <h3 className="mt-4 font-semibold text-white">
              Nenhum cartão cadastrado em {selectedEntity.name}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
              Cadastre o primeiro cartão desta entidade para acompanhar faturas,
              limite, vencimentos e gastos previstos.
            </p>

            <Button
              type="button"
              onClick={handleOpenNewCard}
              className="mt-5 rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const stat = cardStats.get(card.id);
            const percentual = stat?.percentual ?? 0;
            const bank = inferBankFromCardName(card.nome);
            const usageColor =
              percentual >= 90
                ? "#FF4D5E"
                : percentual >= 75
                  ? "#F59E0B"
                  : "#D9FF66";

            return (
              <Card
                key={card.id}
                className="group overflow-hidden border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 hover:border-[#D9FF66]/30 hover:shadow-[0_24px_90px_rgba(0,0,0,0.34)]"
              >
                <div
                  className="h-1.5"
                  style={{ backgroundColor: card.cor || bank.color }}
                />

                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <BankAvatar bank={bank} />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-black text-white">
                            {card.nome}
                          </h2>

                          <Badge className="rounded-full bg-[#A88BFF] text-[#1A1A1A] hover:bg-[#A88BFF]">
                            {card.bandeira || "Cartão"}
                          </Badge>
                        </div>

                        <p className="mt-1 text-xs text-white/45">
                          {bank.label} · Fecha dia {card.dia_fechamento} · Vence
                          dia {card.dia_vencimento}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={deleteCard.isPending}
                      className="h-9 w-9 rounded-full text-white/45 hover:bg-[#FF4D5E]/10 hover:text-[#FF4D5E]"
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Deseja excluir este cartão?",
                        );

                        if (confirmed) {
                          deleteCard.mutate(card.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MetricBox
                      label="Fatura atual"
                      value={brl(stat?.faturaAtual ?? 0)}
                      helper={formatFaturaMes(stat?.faturaMes ?? "")}
                      valueClassName="text-white"
                    />

                    <MetricBox
                      label="Disponível"
                      value={brl(stat?.disponivel ?? Number(card.limite))}
                      helper={`de ${brl(Number(card.limite))}`}
                      valueClassName="text-[#2ECC71]"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="text-white/45">Limite usado</span>

                      <span className="font-bold text-white">
                        {brl(stat?.usado ?? 0)} / {brl(Number(card.limite))}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentual}%`,
                          backgroundColor: usageColor,
                          boxShadow: `0 0 20px ${usageColor}55`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-white/45">
                      {percentual.toFixed(0)}% do limite comprometido
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                    <div className="flex items-center gap-2 text-white/48">
                      <CalendarDays className="h-4 w-4" />
                      Fecha dia {card.dia_fechamento}
                    </div>

                    <div className="flex items-center gap-2 text-white/48">
                      <CalendarDays className="h-4 w-4" />
                      Vence dia {card.dia_vencimento}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone: "primary" | "secondary" | "success" | "danger";
}) {
  const toneClass = {
    primary: "text-[#D9FF66] bg-[#D9FF66]/10 border-[#D9FF66]/20",
    secondary: "text-[#A88BFF] bg-[#A88BFF]/10 border-[#A88BFF]/20",
    success: "text-[#2ECC71] bg-[#2ECC71]/10 border-[#2ECC71]/20",
    danger: "text-[#FF4D5E] bg-[#FF4D5E]/10 border-[#FF4D5E]/20",
  }[tone];

  const valueClass = {
    primary: "text-[#D9FF66]",
    secondary: "text-[#A88BFF]",
    success: "text-[#2ECC71]",
    danger: "text-[#FF4D5E]",
  }[tone];

  return (
    <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/55">{title}</p>

          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-full border",
              toneClass,
            ].join(" ")}
          >
            {icon}
          </div>
        </div>

        <p className={`mt-2 text-2xl font-black ${valueClass}`}>{value}</p>

        <p className="mt-1 text-xs text-white/38">{description}</p>
      </CardContent>
    </Card>
  );
}

function MetricBox({
  label,
  value,
  helper,
  valueClassName,
}: {
  label: string;
  value: string;
  helper: string;
  valueClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs text-white/45">{label}</p>

      <p className={`mt-1 text-lg font-black ${valueClassName}`}>{value}</p>

      <p className="mt-1 text-xs text-white/35">{helper}</p>
    </div>
  );
}

function CardForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedEntityId, selectedEntity } = useFinancialEntity();

  const [bankId, setBankId] = useState("santander");
  const [nome, setNome] = useState("");
  const [bandeira, setBandeira] = useState("Visa");
  const [limite, setLimite] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("1");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [cor, setCor] = useState(CORES[0]);

  const selectedBank = getBankById(bankId);

  const createCard = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      if (!selectedEntityId) {
        throw new Error("Selecione uma entidade financeira.");
      }

      const parsedLimit = Number(limite || 0);
      const parsedClosingDay = Number(diaFechamento);
      const parsedDueDay = Number(diaVencimento);

      if (!nome.trim()) {
        throw new Error("Informe o nome do cartão.");
      }

      if (parsedLimit <= 0) {
        throw new Error("Informe um limite válido.");
      }

      if (parsedClosingDay < 1 || parsedClosingDay > 31) {
        throw new Error("O dia de fechamento deve ser entre 1 e 31.");
      }

      if (parsedDueDay < 1 || parsedDueDay > 31) {
        throw new Error("O dia de vencimento deve ser entre 1 e 31.");
      }

      const { error } = await (supabase as any).from("cards").insert({
        user_id: user.id,
        entity_id: selectedEntityId,
        nome: nome.trim(),
        bandeira,
        limite: parsedLimit,
        dia_fechamento: parsedClosingDay,
        dia_vencimento: parsedDueDay,
        cor,
      });

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Cartão criado");
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["cards-count"] });
      onDone();

      setBankId("santander");
      setNome("");
      setBandeira("Visa");
      setLimite("");
      setDiaFechamento("1");
      setDiaVencimento("10");
      setCor(CORES[0]);
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createCard.mutate();
  }

  function handleBankChange(nextBankId: string) {
    const nextBank = getBankById(nextBankId);

    setBankId(nextBankId);

    if (!nome.trim() || BANKS.some((bank) => nome.trim() === bank.label)) {
      setNome(nextBank.id === "outro" ? "" : nextBank.label);
    }

    if (cor === CORES[0] || BANKS.some((bank) => bank.color === cor)) {
      setCor(nextBank.color);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {selectedEntity && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="text-xs text-white/45">Cartão será criado em</div>

          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
            {selectedEntity.type === "cnpj" ? (
              <Building2 className="h-4 w-4 text-white/45" />
            ) : (
              <UserRound className="h-4 w-4 text-white/45" />
            )}
            {selectedEntity.name} · {selectedEntity.type.toUpperCase()}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
        <div className="mb-4 flex items-center gap-3">
          <BankAvatar bank={selectedBank} />

          <div>
            <p className="font-bold text-white">
              {nome.trim() || selectedBank.label}
            </p>

            <p className="text-xs text-white/45">
              {selectedBank.label} · {bandeira}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Banco</Label>

            <Select value={bankId} onValueChange={handleBankChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {BANKS.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Bandeira</Label>

            <Select value={bandeira} onValueChange={setBandeira}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {BANDEIRAS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <Label>Nome do cartão</Label>

        <Input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          required
          placeholder="Ex: Santander SX, Nubank Ultravioleta"
        />
      </div>

      <div>
        <Label>Limite</Label>

        <Input
          type="number"
          step="0.01"
          value={limite}
          onChange={(event) => setLimite(event.target.value)}
          required
          placeholder="Ex: 5000"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Dia de fechamento</Label>

          <Input
            type="number"
            min={1}
            max={31}
            value={diaFechamento}
            onChange={(event) => setDiaFechamento(event.target.value)}
            required
          />
        </div>

        <div>
          <Label>Dia de vencimento</Label>

          <Input
            type="number"
            min={1}
            max={31}
            value={diaVencimento}
            onChange={(event) => setDiaVencimento(event.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label>Cor do cartão</Label>

        <div className="mt-2 flex flex-wrap gap-2">
          {CORES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Selecionar cor ${color}`}
              onClick={() => setCor(color)}
              className={[
                "h-8 w-8 rounded-full border border-white/10 transition-all",
                cor === color
                  ? "ring-2 ring-[#D9FF66] ring-offset-2 ring-offset-[#1A1A1A]"
                  : "",
              ].join(" ")}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <Button
        type="submit"
        disabled={createCard.isPending}
        className="w-full rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
      >
        {createCard.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Salvar cartão
          </>
        )}
      </Button>

      <p className="text-center text-xs text-white/38">
        Para usar logos reais, adicione arquivos SVG em public/banks. Se o logo
        não existir, o sistema mostra uma marca visual automática.
      </p>
    </form>
  );
}
