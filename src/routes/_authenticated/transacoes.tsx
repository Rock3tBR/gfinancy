import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { brl, ptDate } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CreditCard,
  FileSearch,
  Filter,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Repeat2,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { InvoiceImportDialog } from "@/components/InvoiceImportDialog";

type TransacoesSearch = {
  importar?: boolean;
};

export const Route = createFileRoute("/_authenticated/transacoes")({
  component: TransacoesPage,
  validateSearch: (search: Record<string, unknown>): TransacoesSearch => ({
    importar:
      search.importar === true || search.importar === "true"
        ? true
        : undefined,
  }),
});

type Category = {
  id: string;
  nome: string;
  entity_id?: string | null;
};

type CardRow = {
  id: string;
  nome: string;
  bandeira?: string | null;
  limite?: number | null;
  dia_fechamento: number;
  dia_vencimento?: number | null;
  cor?: string | null;
  entity_id?: string | null;
};

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
  parcela_atual_importada?: number | null;
  total_parcelas_importadas?: number | null;
  fatura_mes_importada?: string | null;
};

type Filters = {
  q: string;
  categoria: string;
  tipo: "todos" | "entrada" | "saida";
  forma: "todas" | "debito" | "credito";
  de: string;
  ate: string;
  valorMin: string;
  valorMax: string;
  cardId: string;
};

const FILTERS_INIT: Filters = {
  q: "",
  categoria: "",
  tipo: "todos",
  forma: "todas",
  de: "",
  ate: "",
  valorMin: "",
  valorMax: "",
  cardId: "",
};

type FixedExpense = {
  id: string;
  raw: Record<string, any>;
  descricao: string;
  categoria: string | null;
  tipo: "debito" | "credito";
  valor: number;
  dia: number;
  card_id: string | null;
  ativo: boolean;
  created_at?: string | null;
};

type FixedExpenseFormState = {
  descricao: string;
  categoria: string;
  tipo: "debito" | "credito";
  valor: string;
  dia: string;
  cardId: string;
  ativo: boolean;
};

const FIXED_EXPENSE_EMPTY_FORM: FixedExpenseFormState = {
  descricao: "",
  categoria: "",
  tipo: "debito",
  valor: "",
  dia: "1",
  cardId: "",
  ativo: true,
};

// SCHEMA FIX (2026-07-13): lia colunas que nunca existiram na tabela real
// (dia_mes, description, nome, tipo, amount, valor_mensal etc.), então
// "tipo" sempre caía no fallback "debito" mesmo para gastos fixos no
// cartão. A tabela não tem coluna "tipo" — crédito vs débito é decidido
// pela presença de card_id (mesma regra usada no banco em
// apply_scheduled_entries()).
function normalizeFixedExpense(row: Record<string, any>): FixedExpense {
  const descricao = String(row.descricao ?? "Gasto fixo");
  const categoria = row.categoria ?? null;
  const cardId = row.card_id ?? null;
  const tipo: "debito" | "credito" = cardId ? "credito" : "debito";
  const valor = Number(row.valor ?? 0);
  const dia = Number(row.dia ?? 1);
  const ativo = Boolean(row.ativo ?? true);

  return {
    id: String(row.id),
    raw: row,
    descricao,
    categoria,
    tipo,
    valor,
    dia: Number.isFinite(dia) ? dia : 1,
    card_id: cardId,
    ativo,
    created_at: row.created_at ?? null,
  };
}

function fixedExpenseToForm(expense: FixedExpense): FixedExpenseFormState {
  return {
    descricao: expense.descricao,
    categoria: expense.categoria ?? "",
    tipo: expense.tipo,
    valor: String(expense.valor || ""),
    dia: String(expense.dia || 1),
    cardId: expense.card_id ?? "",
    ativo: expense.ativo,
  };
}

// SCHEMA FIX (2026-07-13): esta função tentava 3 formatos de coluna
// diferentes (dia_mes/description/nome, day_of_month/amount, etc.) porque
// o schema real da tabela public.recurring_expenses nunca tinha sido
// conferido. Nenhuma das 3 variantes batia com as colunas de verdade
// (descricao, dia, valor, categoria, auto_debit, ativo, card_id, entity_id
// — ver supabase/migrations/20260520122821_...sql e
// 20260713150000_fix_recurring_expenses_entity_id.sql), então toda
// gravação falhava. Só existe uma forma certa agora, sem tentativa e erro.
//
// A tabela não tem coluna "tipo": a direção é inferida por card_id
// (presente = lançamento de crédito no cartão) e auto_debit (true = gera
// lançamento de débito automaticamente todo mês). Ver
// apply_scheduled_entries()/run_my_scheduled_entries() no banco.
function buildFixedExpensePayload({
  form,
  userId,
  entityId,
}: {
  form: FixedExpenseFormState;
  userId: string;
  entityId: string;
}) {
  const valor = parseMoney(form.valor);
  const dia = Math.min(Math.max(parsePositiveInteger(form.dia, 1), 1), 31);
  const cardId = form.tipo === "credito" ? form.cardId || null : null;
  const categoria = form.categoria.trim() || null;
  const descricao = form.descricao.trim();

  return {
    user_id: userId,
    entity_id: entityId,
    descricao,
    categoria,
    valor,
    dia,
    card_id: cardId,
    // Débito: precisa de auto_debit=true para ser lançado automaticamente
    // todo mês. Crédito: a presença de card_id já é suficiente para o job
    // gerar o lançamento na fatura, auto_debit fica false por clareza.
    auto_debit: form.tipo === "debito",
    ativo: form.ativo,
  };
}

function getNextFixedDate(day: number) {
  const now = new Date();
  const normalizedDay = Math.min(Math.max(Number(day || 1), 1), 31);

  const thisMonthLastDay = lastDayOfMonth(now).getDate();
  const thisMonthDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(normalizedDay, thisMonthLastDay)
  );

  if (thisMonthDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return ymd(thisMonthDate);
  }

  const nextMonth = addMonths(firstDayOfMonth(now), 1);
  const nextMonthLastDay = lastDayOfMonth(nextMonth).getDate();

  return ymd(
    new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(normalizedDay, nextMonthLastDay)
    )
  );
}

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function parsePositiveInteger(value: string, fallback = 1) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseMoney(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized || 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function getInvoiceMonthByClosingDay(
  purchaseDateString: string,
  closingDay: number,
  installmentIndex: number
) {
  const purchaseDate = new Date(`${purchaseDateString}T00:00:00`);
  const purchaseDay = purchaseDate.getDate();

  let invoiceMonth = new Date(
    purchaseDate.getFullYear(),
    purchaseDate.getMonth(),
    1
  );

  if (purchaseDay > closingDay) {
    invoiceMonth = addMonths(invoiceMonth, 1);
  }

  invoiceMonth = addMonths(invoiceMonth, installmentIndex);

  return ymd(invoiceMonth);
}

function splitInstallments(total: number, installments: number) {
  const base = Math.floor((total / installments) * 100) / 100;
  const values = Array.from({ length: installments }, () => base);

  const partial = values
    .slice(0, installments - 1)
    .reduce((sum, value) => sum + value, 0);

  values[installments - 1] = Math.round((total - partial) * 100) / 100;

  return values;
}

function getTransactionDisplayValue(transaction: Tx) {
  const totalValue = Math.abs(Number(transaction.valor_total || 0));

  if (transaction.tipo !== "credito") {
    return totalValue;
  }

  /*
   * Compras importadas de fatura guardam em valor_total o valor da
   * parcela exibida no PDF. Portanto, nesses registros não dividimos
   * novamente pelo total de parcelas.
   */
  const importedInstallment =
    Boolean(transaction.fatura_mes_importada) ||
    Number(transaction.parcela_atual_importada ?? 0) > 0 ||
    Number(transaction.total_parcelas_importadas ?? 0) > 0;

  if (importedInstallment) {
    return totalValue;
  }

  const totalInstallments = Math.max(
    1,
    Number(transaction.parcelas || 1),
  );

  if (totalInstallments === 1) {
    return totalValue;
  }

  /*
   * Usa a mesma distribuição em centavos empregada na geração das
   * parcelas. Assim, valores que não dividem exatamente continuam
   * conferindo com a fatura.
   */
  return splitInstallments(
    totalValue,
    totalInstallments,
  )[0] ?? totalValue;
}

function getTypeLabel(tipo: Tx["tipo"]) {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "debito") return "Débito";

  return "Crédito";
}

function formatLimit(value: number) {
  if (value === Infinity) return "∞";

  return String(value);
}

function TransacoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const { canUse, getLimit, reachedLimit, openUpgrade } = usePlan();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [filters, setFilters] = useState<Filters>(FILTERS_INIT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"transacoes" | "fixos">("transacoes");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  // Permite abrir o importador de fatura direto ao chegar em
  // /transacoes?importar=true (atalho "Importar fatura" das Ações rápidas do
  // início), respeitando o mesmo gate de plano do botão "Importar fatura"
  // já existente nesta página.
  useEffect(() => {
    if (search.importar) {
      setActiveTab("transacoes");

      if (canUse("invoiceImport")) {
        setImportOpen(true);
      } else {
        openUpgrade(
          "Importação de faturas está disponível no Plano Pro.",
          "invoiceImport"
        );
      }

      navigate({
        to: "/transacoes",
        search: {},
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.importar]);

  const today = useMemo(() => new Date(), []);
  const monthStart = ymd(firstDayOfMonth(today));
  const monthEnd = ymd(lastDayOfMonth(today));
  const maxTxPerMonth = getLimit("maxTxPerMonth");

  const { data: txs = [], isLoading: txsLoading } = useQuery({
    queryKey: ["txs", user?.id, selectedEntityId],
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

  const { data: monthlyTxCount = 0 } = useQuery({
    queryKey: ["txs-month-count", user?.id, monthStart, monthEnd],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("transactions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user!.id)
        .gte("data_compra", monthStart)
        .lte("data_compra", monthEnd);

      if (error) throw error;

      return count ?? 0;
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cards")
        .select("id,nome,bandeira,limite,dia_fechamento,dia_vencimento,cor,entity_id")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as CardRow[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id,nome,entity_id")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as Category[];
    },
  });

  const reachedTxLimit = reachedLimit("maxTxPerMonth", monthlyTxCount);

  const cardMap = useMemo(() => {
    return Object.fromEntries(cards.map((card) => [card.id, card.nome]));
  }, [cards]);

  const filtered = useMemo(() => {
    return txs.filter((transaction) => {
      const search = filters.q.trim().toLowerCase();

      if (
        search &&
        !transaction.descricao.toLowerCase().includes(search) &&
        !transaction.categoria?.toLowerCase().includes(search)
      ) {
        return false;
      }

      if (
        filters.categoria &&
        (transaction.categoria ?? "") !== filters.categoria
      ) {
        return false;
      }

      if (filters.tipo === "entrada" && transaction.tipo !== "entrada") {
        return false;
      }

      if (filters.tipo === "saida" && transaction.tipo === "entrada") {
        return false;
      }

      if (filters.forma !== "todas") {
        if (transaction.tipo === "entrada") return false;
        if (transaction.tipo !== filters.forma) return false;
      }

      if (filters.de && transaction.data_compra < filters.de) {
        return false;
      }

      if (filters.ate && transaction.data_compra > filters.ate) {
        return false;
      }

      const value = Number(transaction.valor_total);

      if (filters.valorMin && value < Number(filters.valorMin)) {
        return false;
      }

      if (filters.valorMax && value > Number(filters.valorMax)) {
        return false;
      }

      if (filters.cardId === "__none__") {
        if (transaction.card_id) return false;
      } else if (filters.cardId && transaction.card_id !== filters.cardId) {
        return false;
      }

      return true;
    });
  }, [txs, filters]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, transaction) => {
        if (transaction.tipo === "entrada") {
          acc.entrada += Number(transaction.valor_total);
        } else {
          acc.saida += Number(transaction.valor_total);
        }

        return acc;
      },
      {
        entrada: 0,
        saida: 0,
      }
    );
  }, [filtered]);

  const hasFilter = JSON.stringify(filters) !== JSON.stringify(FILTERS_INIT);

  function handleOpenCreate() {
    if (!selectedEntityId) {
      toast.error("Selecione uma entidade financeira antes de criar transações.");
      return;
    }

    if (reachedTxLimit) {
      openUpgrade(
        maxTxPerMonth === Infinity
          ? "Seu plano atual não possui limite de transações."
          : `Seu plano permite até ${maxTxPerMonth} transações por mês. Faça upgrade para continuar lançando movimentações.`
      );

      return;
    }

    setOpen(true);
  }

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      const { error: installmentsError } = await (supabase as any)
        .from("installments")
        .delete()
        .eq("transaction_id", id)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);

      if (installmentsError) throw installmentsError;

      const { error } = await (supabase as any)
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
    },

    onSuccess: async () => {
      toast.success("Transação removida");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["txs"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-month-count"] }),
        queryClient.invalidateQueries({ queryKey: ["insts"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["home-txs"] }),
        queryClient.invalidateQueries({ queryKey: ["home-installments"] }),
        queryClient.invalidateQueries({ queryKey: ["home-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-cat"] }),
      ]);
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!selectedEntityId) throw new Error("Nenhuma entidade selecionada.");
      if (ids.length === 0) return;

      const { error: instErr } = await (supabase as any)
        .from("installments")
        .delete()
        .in("transaction_id", ids)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);
      if (instErr) throw instErr;

      const { error } = await (supabase as any)
        .from("transactions")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);
      if (error) throw error;
    },
    onSuccess: async (_data, ids) => {
      toast.success(
        `${ids.length} ${
          ids.length === 1 ? "transação removida" : "transações removidas"
        }`
      );

      setSelected(new Set());

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["txs"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-month-count"] }),
        queryClient.invalidateQueries({ queryKey: ["insts"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["home-txs"] }),
        queryClient.invalidateQueries({ queryKey: ["home-installments"] }),
        queryClient.invalidateQueries({ queryKey: ["home-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-cat"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered(all: boolean) {
    if (all) {
      setSelected(new Set(filtered.map((t) => t.id)));
    } else {
      setSelected(new Set());
    }
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
      <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

            <div>
              <h2 className="font-semibold text-white">
                Nenhuma entidade financeira selecionada
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/60">
                Selecione uma entidade para visualizar e cadastrar transações.
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
    <div className="space-y-6">
      <section className="ge-mobile-toolbar flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="ge-mobile-toolbar-entity w-full sm:w-[260px]">
          <FinancialEntitySelector />
        </div>

        <Button
          type="button"
          variant="outline"
          className={[
            "h-10 rounded-full px-5 font-bold transition",
            activeTab === "transacoes"
              ? "border-[#D9FF66]/35 bg-[#D9FF66] text-[#1A1A1A] hover:bg-[#D9FF66]/90"
              : "border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
          ].join(" ")}
          onClick={() => setActiveTab("transacoes")}
        >
          <Receipt className="mr-2 h-4 w-4" />
          Transações
        </Button>

        <Button
          type="button"
          variant="outline"
          className={[
            "h-10 rounded-full px-5 font-bold transition",
            activeTab === "fixos"
              ? "border-[#D9FF66]/35 bg-[#D9FF66] text-[#1A1A1A] hover:bg-[#D9FF66]/90"
              : "border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
          ].join(" ")}
          onClick={() => {
            setActiveTab("fixos");
            setFiltersOpen(false);
          }}
        >
          <Repeat2 className="mr-2 h-4 w-4" />
          Gastos fixos
        </Button>

        {activeTab === "transacoes" && (
          <>
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

            {canUse("invoiceImport") ? (
              <InvoiceImportDialog
                cards={cards}
                open={importOpen}
                onOpenChange={setImportOpen}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66] disabled:text-white/35 disabled:hover:text-white/35"
                onClick={() =>
                  openUpgrade(
                    "Importação de faturas está disponível no Plano Pro.",
                    "invoiceImport"
                  )
                }
              >
                <FileSearch className="mr-2 h-4 w-4" />
                Importar fatura
              </Button>
            )}

            <Button
              type="button"
              className="h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
              onClick={handleOpenCreate}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova transação
            </Button>
          </>
        )}
      </section>

      {activeTab === "fixos" ? (
        <FixedExpensesPanel cards={cards} categories={categories} />
      ) : (
        <>

      {reachedTxLimit && (
        <Card className="border-amber-500/30 bg-amber-500/10 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />

              <div>
                <p className="text-sm font-semibold text-foreground">
                  Limite mensal atingido
                </p>

                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Seu plano atual permite até {formatLimit(maxTxPerMonth)}{" "}
                  transações por mês. Faça upgrade para continuar cadastrando
                  movimentações.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() =>
                openUpgrade(
                  "Faça upgrade para o Pro e tenha transações ilimitadas."
                )
              }
            >
              Fazer upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Movimentações de {selectedEntity.name}
          </h2>

          <p className="text-sm text-white/55">
            {filtered.length} de {txs.length} transações encontradas.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/55">
          {monthlyTxCount}/{formatLimit(maxTxPerMonth)} transações usadas neste mês
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-md overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#1A1A1A] text-white">
          <DialogHeader>
            <DialogTitle>Nova transação</DialogTitle>
          </DialogHeader>

          <TxForm
            cards={cards}
            categories={categories}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {filtersOpen && (
      <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Buscar</Label>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

                <Input
                  placeholder="Descrição ou categoria..."
                  value={filters.q}
                  onChange={(event) =>
                    setFilters({ ...filters, q: event.target.value })
                  }
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>

              <Select
                value={filters.categoria || "__all__"}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    categoria: value === "__all__" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>

                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.nome}>
                      {category.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>

              <Select
                value={filters.tipo}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    tipo: value as Filters["tipo"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Forma</Label>

              <Select
                value={filters.forma}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    forma: value as Filters["forma"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Período de
              </Label>

              <Input
                type="date"
                value={filters.de}
                onChange={(event) =>
                  setFilters({ ...filters, de: event.target.value })
                }
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Período até
              </Label>

              <Input
                type="date"
                value={filters.ate}
                onChange={(event) =>
                  setFilters({ ...filters, ate: event.target.value })
                }
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Valor mínimo
              </Label>

              <Input
                type="number"
                step="0.01"
                value={filters.valorMin}
                onChange={(event) =>
                  setFilters({ ...filters, valorMin: event.target.value })
                }
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Valor máximo
              </Label>

              <Input
                type="number"
                step="0.01"
                value={filters.valorMax}
                onChange={(event) =>
                  setFilters({ ...filters, valorMax: event.target.value })
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Cartão</Label>

              <Select
                value={filters.cardId || "__all__"}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    cardId: value === "__all__" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="__none__">Sem cartão</SelectItem>

                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {txs.length} transações
            </p>

            {hasFilter && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFilters(FILTERS_INIT)}
              >
                <X className="mr-1 h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {txsLoading ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="flex justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando transações...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {txs.length === 0
              ? `Nenhuma transação em ${selectedEntity.name}.`
              : "Nenhuma transação corresponde aos filtros."}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={
                    filtered.length > 0 &&
                    filtered.every((t) => selected.has(t.id))
                  }
                  onCheckedChange={(v) => toggleAllFiltered(Boolean(v))}
                />
                Selecionar tudo ({filtered.length})
              </label>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selected.size} selecionada(s)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(new Set())}
                  >
                    Limpar seleção
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkDelete.isPending}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Excluir ${selected.size} transações selecionadas? Esta ação não pode ser desfeita.`
                      );
                      if (confirmed) {
                        bulkDelete.mutate(Array.from(selected));
                      }
                    }}
                  >
                    {bulkDelete.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-4 w-4" />
                    )}
                    Excluir selecionadas
                  </Button>
                </div>
              )}
            </div>
            <div className="ge-transaction-list divide-y divide-border">
              {filtered.map((transaction) => {
                const isEntrada = transaction.tipo === "entrada";
                const Icon = isEntrada
                  ? ArrowUpCircle
                  : transaction.tipo === "credito"
                    ? CreditCard
                    : ArrowDownCircle;

                const color = isEntrada ? "text-emerald-500" : "text-red-500";
                const isChecked = selected.has(transaction.id);

                return (
                  <div
                    key={transaction.id}
                    className={`ge-transaction-row flex items-center gap-3 p-4 transition-colors hover:bg-muted/40 ${isChecked ? "bg-muted/30" : ""}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(transaction.id)}
                    />

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {transaction.descricao}
                        </p>

                        <Badge variant="secondary">
                          {getTypeLabel(transaction.tipo)}
                        </Badge>

                        {transaction.tipo === "credito" &&
                          transaction.parcelas > 1 && (
                            <Badge variant="secondary">
                              {transaction.parcelas}x
                            </Badge>
                          )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {ptDate(transaction.data_compra)}
                        {transaction.categoria
                          ? ` · ${transaction.categoria}`
                          : ""}
                        {transaction.card_id
                          ? ` · ${cardMap[transaction.card_id] ?? "—"}`
                          : ""}
                      </p>
                    </div>

                    <div className={`ge-tx-value text-sm font-bold ${color}`}>
                      {isEntrada ? "+" : "−"}{" "}
                      {brl(getTransactionDisplayValue(transaction))}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(transaction)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deleteTransaction.isPending}
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Deseja excluir esta transação?"
                        );

                        if (confirmed) {
                          deleteTransaction.mutate(transaction.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(isOpen) => !isOpen && setEditing(null)}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-md overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#1A1A1A] text-white">
          <DialogHeader>
            <DialogTitle>Editar transação</DialogTitle>
          </DialogHeader>

          {editing && (
            <TxForm
              cards={cards}
              categories={categories}
              initial={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}


function FixedExpensesPanel({
  cards,
  categories,
}: {
  cards: CardRow[];
  categories: Category[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedEntityId, selectedEntity } = useFinancialEntity();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [form, setForm] = useState<FixedExpenseFormState>(
    FIXED_EXPENSE_EMPTY_FORM
  );

  const { data: fixedExpenses = [], isLoading } = useQuery({
    queryKey: ["fixed-expenses", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;

      return ((data ?? []) as Record<string, any>[]).map(normalizeFixedExpense);
    },
  });

  const totals = useMemo(() => {
    return fixedExpenses.reduce(
      (acc, expense) => {
        if (expense.ativo) {
          acc.active += 1;
          acc.monthlyTotal += Number(expense.valor || 0);
        }

        if (expense.tipo === "credito") {
          acc.credit += 1;
        } else {
          acc.debit += 1;
        }

        return acc;
      },
      {
        active: 0,
        credit: 0,
        debit: 0,
        monthlyTotal: 0,
      }
    );
  }, [fixedExpenses]);

  function openCreate() {
    setEditing(null);
    setForm(FIXED_EXPENSE_EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(expense: FixedExpense) {
    setEditing(expense);
    setForm(fixedExpenseToForm(expense));
    setOpen(true);
  }

  const saveFixedExpense = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!selectedEntityId) throw new Error("Selecione uma entidade financeira.");
      if (!form.descricao.trim()) throw new Error("Informe a descrição.");
      if (parseMoney(form.valor) <= 0) throw new Error("Informe um valor válido.");
      if (form.tipo === "credito" && !form.cardId) {
        throw new Error("Selecione o cartão para gastos fixos no crédito.");
      }

      const payload = buildFixedExpensePayload({
        form,
        userId: user.id,
        entityId: selectedEntityId,
      });

      const request = editing
        ? (supabase as any)
            .from("recurring_expenses")
            .update(payload)
            .eq("id", editing.id)
            .eq("user_id", user.id)
            .eq("entity_id", selectedEntityId)
        : (supabase as any).from("recurring_expenses").insert(payload);

      const { error } = await request;

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success(editing ? "Gasto fixo atualizado" : "Gasto fixo criado");
      setOpen(false);
      setEditing(null);
      setForm(FIXED_EXPENSE_EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteFixedExpense = useMutation({
    mutationFn: async (expense: FixedExpense) => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!selectedEntityId) throw new Error("Selecione uma entidade financeira.");

      const { error } = await (supabase as any)
        .from("recurring_expenses")
        .delete()
        .eq("id", expense.id)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Gasto fixo removido");
      queryClient.invalidateQueries({ queryKey: ["fixed-expenses"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveFixedExpense.mutate();
  }

  function getCardName(cardId: string | null) {
    if (!cardId) return "Sem cartão";

    return cards.find((card) => card.id === cardId)?.nome ?? "Cartão";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Gastos fixos de {selectedEntity?.name ?? "Pessoal"}
          </h2>

          <p className="text-sm text-white/55">
            Crie, edite e remova despesas recorrentes desta entidade.
          </p>
        </div>

        <Button
          type="button"
          className="h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo gasto fixo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Gastos fixos</p>
            <p className="mt-2 text-3xl font-black text-white">
              {fixedExpenses.length}
            </p>
            <p className="mt-1 text-xs text-white/38">cadastrado(s)</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Ativos</p>
            <p className="mt-2 text-3xl font-black text-[#2ECC71]">
              {totals.active}
            </p>
            <p className="mt-1 text-xs text-white/38">gerados automaticamente</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">Total mensal</p>
            <p className="mt-2 text-2xl font-black text-[#FF4D5E]">
              {brl(totals.monthlyTotal)}
            </p>
            <p className="mt-1 text-xs text-white/38">soma dos ativos</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
          <CardContent className="p-5">
            <p className="text-sm text-white/55">No cartão</p>
            <p className="mt-2 text-3xl font-black text-[#A88BFF]">
              {totals.credit}
            </p>
            <p className="mt-1 text-xs text-white/38">entram na fatura</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="flex justify-center py-12 text-sm text-white/55">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando gastos fixos...
          </CardContent>
        </Card>
      ) : fixedExpenses.length === 0 ? (
        <Card className="border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
          <CardContent className="py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.045]">
              <Repeat2 className="h-7 w-7 text-white/50" />
            </div>

            <h3 className="mt-4 font-semibold text-white">
              Nenhum gasto fixo cadastrado
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
              Cadastre despesas recorrentes como aluguel, assinatura, internet,
              mensalidades e compras fixas no cartão.
            </p>

            <Button
              type="button"
              onClick={openCreate}
              className="mt-5 rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar gasto fixo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fixedExpenses.map((expense) => {
            const isCredit = expense.tipo === "credito";

            return (
              <Card
                key={expense.id}
                className="overflow-hidden border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 hover:border-[#D9FF66]/30 hover:shadow-[0_24px_90px_rgba(0,0,0,0.34)]"
              >
                <div
                  className="h-1.5"
                  style={{
                    backgroundColor: isCredit ? "#A88BFF" : "#FF4D5E",
                  }}
                />

                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={[
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
                          isCredit
                            ? "border-[#A88BFF]/20 bg-[#A88BFF]/10 text-[#A88BFF]"
                            : "border-[#FF4D5E]/20 bg-[#FF4D5E]/10 text-[#FF4D5E]",
                        ].join(" ")}
                      >
                        {isCredit ? (
                          <CreditCard className="h-5 w-5" />
                        ) : (
                          <Repeat2 className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-white">
                          {expense.descricao}
                        </h3>

                        <p className="mt-1 truncate text-xs text-white/45">
                          {expense.categoria || "Sem categoria"} ·{" "}
                          {isCredit ? getCardName(expense.card_id) : "Débito"}
                        </p>
                      </div>
                    </div>

                    <Badge
                      className={[
                        "rounded-full border px-2.5 py-1 text-xs font-bold",
                        expense.ativo
                          ? "border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#2ECC71] hover:bg-[#2ECC71]/10"
                          : "border-white/10 bg-white/[0.045] text-white/45 hover:bg-white/[0.045]",
                      ].join(" ")}
                    >
                      {expense.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-xs text-white/45">Valor mensal</p>
                      <p className="mt-1 text-xl font-black text-white">
                        {brl(expense.valor)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-xs text-white/45">Dia</p>
                      <p className="mt-1 text-xl font-black text-[#D9FF66]">
                        {expense.dia}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 text-white/50">
                      <CalendarDays className="h-4 w-4" />
                      Próximo lançamento
                    </div>

                    <span className="font-bold text-white">
                      {ptDate(getNextFixedDate(expense.dia))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full px-3 text-white/55 hover:bg-white/[0.06] hover:text-[#D9FF66]"
                      onClick={() => openEdit(expense)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full px-3 text-white/55 hover:bg-[#FF4D5E]/10 hover:text-[#FF4D5E]"
                      disabled={deleteFixedExpense.isPending}
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Deseja excluir este gasto fixo?"
                        );

                        if (confirmed) deleteFixedExpense.mutate(expense);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Apagar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-md overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#1A1A1A] text-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar gasto fixo" : "Novo gasto fixo"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-5 py-4">
              <div className="text-xs text-white/38">Gasto fixo será criado em</div>

              <div className="mt-1 flex items-center gap-2 text-sm font-black text-white">
                {selectedEntity?.type === "cnpj" ? (
                  <Building2 className="h-4 w-4 text-white/55" />
                ) : (
                  <UserRound className="h-4 w-4 text-white/55" />
                )}

                {selectedEntity?.name ?? "Pessoal"}
                {selectedEntity?.type ? ` · ${selectedEntity.type.toUpperCase()}` : ""}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.045] p-1">
              <button
                type="button"
                className={[
                  "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
                  form.tipo === "debito"
                    ? "bg-[#FF4D5E] text-white"
                    : "text-white/55 hover:bg-white/[0.06] hover:text-white",
                ].join(" ")}
                onClick={() => setForm({ ...form, tipo: "debito", cardId: "" })}
              >
                <ArrowDownCircle className="h-4 w-4" />
                Débito
              </button>

              <button
                type="button"
                className={[
                  "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
                  form.tipo === "credito"
                    ? "bg-[#A88BFF] text-[#1A1A1A]"
                    : "text-white/55 hover:bg-white/[0.06] hover:text-white",
                ].join(" ")}
                onClick={() => setForm({ ...form, tipo: "credito" })}
              >
                <CreditCard className="h-4 w-4" />
                Crédito
              </button>
            </div>

            <div>
              <Label className="text-xs text-white/55">Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(event) =>
                  setForm({ ...form, descricao: event.target.value })
                }
                required
                placeholder="Ex: Netflix, aluguel, internet..."
                className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
              />
            </div>

            <div>
              <Label className="text-xs text-white/55">Categoria</Label>
              {categories.length > 0 ? (
                <Select
                  value={form.categoria || "__none__"}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      categoria: value === "__none__" ? "" : value,
                    })
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
                  value={form.categoria}
                  onChange={(event) =>
                    setForm({ ...form, categoria: event.target.value })
                  }
                  placeholder="Ex: Assinaturas, Moradia..."
                  className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
                />
              )}
            </div>

            {form.tipo === "credito" && (
              <div>
                <Label className="text-xs text-white/55">Cartão</Label>
                <Select
                  value={form.cardId}
                  onValueChange={(value) => setForm({ ...form, cardId: value })}
                >
                  <SelectTrigger className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white">
                    <SelectValue placeholder="Selecione o cartão" />
                  </SelectTrigger>

                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-white/55">Valor mensal</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(event) =>
                    setForm({ ...form, valor: event.target.value })
                  }
                  required
                  placeholder="Ex: 59.90"
                  className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
                />
              </div>

              <div>
                <Label className="text-xs text-white/55">Dia do mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dia}
                  onChange={(event) =>
                    setForm({ ...form, dia: event.target.value })
                  }
                  required
                  className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white"
                />
              </div>
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/70">
              <span>Ativo</span>
              <Checkbox
                checked={form.ativo}
                onCheckedChange={(checked) =>
                  setForm({ ...form, ativo: Boolean(checked) })
                }
              />
            </label>

            <Button
              type="submit"
              disabled={saveFixedExpense.isPending}
              className="w-full rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
            >
              {saveFixedExpense.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editing ? (
                "Salvar alterações"
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar gasto fixo
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TxForm({
  cards,
  categories,
  onDone,
  initial,
}: {
  cards: CardRow[];
  categories: Category[];
  onDone: () => void;
  initial?: Tx;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedEntityId, selectedEntity } = useFinancialEntity();

  const isEdit = Boolean(initial);

  const [tipo, setTipo] = useState<"entrada" | "debito" | "credito">(
    initial?.tipo ?? "debito"
  );
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [categoria, setCategoria] = useState(initial?.categoria ?? "");
  const [data, setData] = useState(initial?.data_compra ?? ymd(new Date()));
  const [modoValor, setModoValor] = useState<"total" | "parcela">("total");
  const [valor, setValor] = useState(initial ? String(initial.valor_total) : "");
  const [parcelas, setParcelas] = useState(
    initial ? String(initial.parcelas) : "1"
  );
  const [cardId, setCardId] = useState<string>(initial?.card_id ?? "");

  const selectedCard = cards.find((card) => card.id === cardId);

  const numParcelas = parsePositiveInteger(parcelas, 1);
  const numValor = parseMoney(valor);

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
        index
      ),
    }));
  }, [tipo, selectedCard, data, numParcelas]);

  async function replaceInstallments(transactionId: string) {
    if (!user) {
      throw new Error("Usuário não autenticado.");
    }

    if (!selectedEntityId) {
      throw new Error("Selecione uma entidade financeira.");
    }

    const { error: deleteError } = await (supabase as any)
      .from("installments")
      .delete()
      .eq("transaction_id", transactionId)
      .eq("user_id", user.id)
      .eq("entity_id", selectedEntityId);

    if (deleteError) throw deleteError;

    if (tipo !== "credito" || !selectedCard) return;

    const values = splitInstallments(valorTotal, numParcelas);

    const rows = values.map((installmentValue, index) => ({
      user_id: user.id,
      entity_id: selectedEntityId,
      transaction_id: transactionId,
      card_id: selectedCard.id,
      fatura_mes: getInvoiceMonthByClosingDay(
        data,
        selectedCard.dia_fechamento,
        index
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

  const saveTransaction = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      if (!selectedEntityId) {
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
        user_id: user.id,
        entity_id: selectedEntityId,
        tipo,
        descricao: descricao.trim(),
        categoria: categoria || null,
        valor_total: valorTotal,
        data_compra: data,
        parcelas: tipo === "credito" ? numParcelas : 1,
        card_id: tipo === "credito" ? selectedCard!.id : null,
      };

      if (isEdit && initial) {
        const { error } = await (supabase as any)
          .from("transactions")
          .update(payload)
          .eq("id", initial.id)
          .eq("user_id", user.id)
          .eq("entity_id", selectedEntityId);

        if (error) throw error;

        await replaceInstallments(initial.id);

        return;
      }

      const { data: created, error } = await (supabase as any)
        .from("transactions")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      await replaceInstallments(created.id);
    },

    onSuccess: async () => {
      toast.success(isEdit ? "Transação atualizada" : "Transação adicionada");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["txs"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-month-count"] }),
        queryClient.invalidateQueries({ queryKey: ["insts"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["home-txs"] }),
        queryClient.invalidateQueries({ queryKey: ["home-installments"] }),
        queryClient.invalidateQueries({ queryKey: ["home-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-cat"] }),
      ]);

      onDone();
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveTransaction.mutate();
  }

  const activeTabClass =
    tipo === "entrada"
      ? "bg-[#2ECC71] text-[#1A1A1A] shadow-[0_12px_32px_rgba(46,204,113,0.22)]"
      : tipo === "credito"
        ? "bg-[#A88BFF] text-[#1A1A1A] shadow-[0_12px_32px_rgba(168,139,255,0.20)]"
        : "bg-[#FF4D5E] text-white shadow-[0_12px_32px_rgba(255,77,94,0.20)]";

  return (
    <form onSubmit={submit} className="space-y-4">
      {selectedEntity && (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-5 py-4">
          <div className="text-xs text-white/38">
            Transação será criada em
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm font-black text-white">
            {selectedEntity.type === "cnpj" ? (
              <Building2 className="h-4 w-4 text-white/55" />
            ) : (
              <UserRound className="h-4 w-4 text-white/55" />
            )}

            {selectedEntity.name} · {selectedEntity.type.toUpperCase()}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.045] p-1">
        <button
          type="button"
          className={[
            "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
            tipo === "entrada"
              ? activeTabClass
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
              ? activeTabClass
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
              ? activeTabClass
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

      {tipo === "credito" && !isEdit && (
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
            {tipo === "credito" && modoValor === "parcela" && !isEdit
              ? "Valor da parcela"
              : "Valor"}
          </Label>

          <Input
            type="number"
            step="0.01"
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
        disabled={saveTransaction.isPending}
        className="w-full rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
      >
        {saveTransaction.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : isEdit ? (
          "Salvar alterações"
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
