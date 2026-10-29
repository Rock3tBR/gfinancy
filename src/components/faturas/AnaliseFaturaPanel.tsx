import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { parseInvoice } from "@/lib/invoice.functions";
import {
  insertTransactionsWithInstallments,
  matchCategory,
  type ImportCategory,
} from "@/lib/invoice-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { brl, ptDate } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileSearch,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import { usePlan } from "@/hooks/use-plan";


type CardRow = {
  id: string;
  entity_id: string | null;
  nome: string;
};

type Category = ImportCategory & {
  entity_id: string | null;
};

type Analysis = {
  id: string;
  entity_id: string | null;
  nome: string | null;
  card_id: string | null;
  fatura_mes: string | null;
  created_at: string;
};

type Item = {
  id: string;
  entity_id: string | null;
  analysis_id: string;
  data: string;
  descricao_original: string;
  valor: number;
  categoria: string | null;
  finalidade: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
};


export function AnaliseFaturaPanel() {
  return (
    <FeatureGate
      feature="invoiceAnalysis"
      reason="A análise detalhada de faturas está disponível no Plano Pro ou Premium."
    >
      <AnaliseFaturaInner />
    </FeatureGate>
  );
}

function downloadCsv(filename: string, rows: Item[]) {
  if (!rows.length) {
    toast.error("Não há itens para baixar.");
    return;
  }

  const headers = [
    "Data",
    "Descrição original",
    "Valor",
    "Categoria",
    "Finalidade/Destino",
  ];

  const csvRows = rows.map((item) => [
    ptDate(item.data),
    item.descricao_original,
    Number(item.valor).toFixed(2).replace(".", ","),
    item.categoria ?? "",
    item.finalidade ?? "",
  ]);

  const csv = [headers, ...csvRows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function makeSafeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toLowerCase();
}

function AnaliseFaturaInner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { plan } = usePlan();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cards")
        .select("id,entity_id,nome")
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
        .select("id,entity_id,nome,keywords")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("nome");

      if (error) throw error;

      return (data ?? []) as Category[];
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ["analyses", user?.id, selectedEntityId],
    enabled: !!user && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_analyses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as Analysis[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["analysis-items", selectedId, selectedEntityId],
    enabled: !!selectedId && !!selectedEntityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_analysis_items")
        .select("*")
        .eq("analysis_id", selectedId!)
        .eq("entity_id", selectedEntityId)
        .order("data");

      if (error) throw error;

      return (data ?? []) as Item[];
    },
  });

  const selectedAnalysis = analyses.find(
    (analysis) => analysis.id === selectedId
  );

  const selectedCard = selectedAnalysis
    ? cards.find((card) => card.id === selectedAnalysis.card_id)
    : null;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const normalizedSearch = search.trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        item.descricao_original.toLowerCase().includes(normalizedSearch) ||
        item.finalidade?.toLowerCase().includes(normalizedSearch) ||
        item.categoria?.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "__all__" ||
        item.categoria === categoryFilter ||
        (categoryFilter === "__empty__" && !item.categoria);

      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const total = items.reduce((sum, item) => sum + Number(item.valor), 0);

  const filteredTotal = filteredItems.reduce(
    (sum, item) => sum + Number(item.valor),
    0
  );

  const categorizedCount = items.filter((item) => item.categoria).length;
  const purposeCount = items.filter((item) => item.finalidade).length;

  const selectedEntityFileName = makeSafeFileName(
    selectedEntity?.name ?? "entidade"
  );

  const delAnalysis = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Usuário não autenticado.");

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      const { error } = await (supabase as any)
        .from("invoice_analyses")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Análise excluída");
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      queryClient.invalidateQueries({ queryKey: ["analysis-items"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        categoria?: string | null;
        finalidade?: string | null;
      };
    }) => {
      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      const { error } = await (supabase as any)
        .from("invoice_analysis_items")
        .update(patch)
        .eq("id", id)
        .eq("entity_id", selectedEntityId);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analysis-items", selectedId, selectedEntityId],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const linkToTransactions = useMutation({
    mutationFn: async () => {
      if (!user || !selectedId) return 0;

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      const analysis = analyses.find((item) => item.id === selectedId);

      if (!analysis?.card_id) {
        throw new Error("Vincule um cartão a esta análise antes de lançar.");
      }

      if (!analysis.fatura_mes) {
        throw new Error("Informe o mês da fatura antes de lançar.");
      }

      if (!items.length) {
        throw new Error("Sem itens para lançar.");
      }

      const faturaMes = analysis.fatura_mes;
      const cardId = analysis.card_id;

      const transactionRows = items.map((item) => {
        const parcelaValor = Math.abs(Number(item.valor));
        const totalParcelas = Number(item.total_parcelas ?? 1) || 1;
        // Se o item veio parcelado (ex.: "02/06"), armazena o valor total
        // da compra (parcela × total). Assim FaturasOverviewPanel projeta
        // corretamente as próximas parcelas nas próximas faturas.
        const valorTotalCompra = Number(
          (parcelaValor * totalParcelas).toFixed(2),
        );
        return {
          user_id: user.id,
          entity_id: selectedEntityId,
          tipo: "credito" as const,
          descricao:
            item.descricao_original +
            (item.finalidade ? ` — ${item.finalidade}` : ""),
          categoria: item.categoria || null,
          valor_total: valorTotalCompra,
          data_compra: item.data,
          parcelas: totalParcelas,
          card_id: cardId,
        };
      });


      return insertTransactionsWithInstallments(supabase as any, {
        userId: user.id,
        entityId: selectedEntityId,
        rows: transactionRows,
        // Mês de fatura fixo, escolhido manualmente pelo usuário ao criar a
        // análise (diferente de InvoiceImportDialog, que calcula o mês a
        // partir do dia de fechamento do cartão).
        computeFaturaMes: () => faturaMes,
      });
    },

    onSuccess: (count) => {
      toast.success(`${count} transações criadas`);
      queryClient.invalidateQueries({ queryKey: ["txs"] });
      queryClient.invalidateQueries({ queryKey: ["insts"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["home-txs"] });
      queryClient.invalidateQueries({ queryKey: ["home-installments"] });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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
              Nenhuma entidade financeira selecionada
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Selecione uma entidade no topo da tela para analisar faturas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Suas análises
          </h2>

          <p className="text-sm text-muted-foreground">
            Selecione uma análise existente ou crie uma nova fatura para revisar.
          </p>
        </div>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova análise
            </Button>
          </DialogTrigger>

          <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Nova análise de fatura</DialogTitle>
            </DialogHeader>

            <NewAnalysisForm
              cards={cards}
              categories={categories}
              onDone={(id) => {
                setNewOpen(false);
                setSelectedId(id);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground">
              Histórico de análises
            </CardTitle>
          </CardHeader>

          <CardContent className="max-h-[650px] space-y-2 overflow-y-auto">
            {analyses.length === 0 && (
              <div className="rounded-2xl border border-dashed bg-muted/40 p-6 text-center">
                <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 text-sm font-medium text-foreground">
                  Nenhuma análise ainda
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Crie sua primeira análise de fatura para começar.
                </p>
              </div>
            )}

            {analyses.map((analysis) => {
              const card = cards.find((item) => item.id === analysis.card_id);
              const active = selectedId === analysis.id;

              return (
                <button
                  key={analysis.id}
                  type="button"
                  onClick={() => setSelectedId(analysis.id)}
                  className={[
                    "w-full rounded-2xl border p-3 text-left text-sm transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div className="font-semibold">
                    {analysis.nome || "Sem nome"}
                  </div>

                  <div
                    className={[
                      "mt-2 flex items-center gap-1.5 text-xs",
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {card?.nome ?? "Sem cartão"}
                  </div>

                  <div
                    className={[
                      "mt-1 flex items-center gap-1.5 text-xs",
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(analysis.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selectedAnalysis ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <FileSearch className="h-7 w-7 text-muted-foreground" />
                </div>

                <h3 className="mt-4 font-semibold text-foreground">
                  Selecione uma análise
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Escolha uma fatura no histórico ao lado ou crie uma nova
                  análise para começar a revisar seus gastos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-border bg-card shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">
                          {selectedAnalysis.nome || "Sem nome"}
                        </h3>

                        <Badge variant="secondary">
                          {selectedCard?.nome ?? "Sem cartão"}
                        </Badge>
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {items.length} itens importados • Total {brl(total)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadCsv(
                            `analise-fatura-${selectedEntityFileName}-${
                              selectedAnalysis.nome || selectedAnalysis.id
                            }.csv`,
                            filteredItems
                          )
                        }
                      >
                        <Download className="mr-1.5 h-4 w-4" />
                        CSV
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => delAnalysis.mutate(selectedAnalysis.id)}
                        disabled={delAnalysis.isPending}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Excluir
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => linkToTransactions.mutate()}
                        disabled={linkToTransactions.isPending}
                      >
                        {linkToTransactions.isPending ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-4 w-4" />
                        )}
                        Lançar como transações
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Total da fatura
                    </p>

                    <p className="mt-1 text-xl font-bold text-foreground">
                      {brl(total)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Itens</p>

                    <p className="mt-1 text-xl font-bold text-foreground">
                      {items.length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Categorizados
                    </p>

                    <p className="mt-1 text-xl font-bold text-foreground">
                      {categorizedCount}/{items.length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Com finalidade
                    </p>

                    <p className="mt-1 text-xl font-bold text-foreground">
                      {purposeCount}/{items.length}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border bg-card shadow-sm">
                <CardContent className="p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_220px_160px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por descrição, categoria ou finalidade..."
                        className="pl-9"
                      />
                    </div>

                    <Select
                      value={categoryFilter}
                      onValueChange={setCategoryFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="__all__">
                          Todas as categorias
                        </SelectItem>
                        <SelectItem value="__empty__">Sem categoria</SelectItem>

                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.nome}>
                            {category.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center justify-end rounded-xl border bg-muted/40 px-3 text-sm font-medium text-foreground">
                      {brl(filteredTotal)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="w-28 p-3 text-left font-medium">
                            Data
                          </th>
                          <th className="min-w-[240px] p-3 text-left font-medium">
                            Descrição original
                          </th>
                          <th className="w-32 p-3 text-right font-medium">
                            Valor
                          </th>
                          <th className="w-44 p-3 text-left font-medium">
                            Categoria
                          </th>
                          <th className="w-64 p-3 text-left font-medium">
                            Finalidade/Destino
                          </th>
                          <th className="w-32 p-3 text-left font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border">
                        {filteredItems.map((item) => {
                          const completed = Boolean(
                            item.categoria && item.finalidade
                          );

                          return (
                            <tr
                              key={item.id}
                              className="transition-colors hover:bg-muted/40"
                            >
                              <td className="whitespace-nowrap p-3 text-muted-foreground">
                                {ptDate(item.data)}
                              </td>

                              <td className="p-3 font-medium text-foreground">
                                {item.descricao_original}
                              </td>

                              <td className="p-3 text-right font-semibold text-foreground">
                                {brl(Number(item.valor))}
                              </td>

                              <td className="p-3">
                                <Select
                                  value={item.categoria ?? "__none__"}
                                  onValueChange={(value) =>
                                    updateItem.mutate({
                                      id: item.id,
                                      patch: {
                                        categoria:
                                          value === "__none__" ? null : value,
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Categoria" />
                                  </SelectTrigger>

                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      Sem categoria
                                    </SelectItem>

                                    {categories.map((category) => (
                                      <SelectItem
                                        key={category.id}
                                        value={category.nome}
                                      >
                                        {category.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>

                              <td className="p-3">
                                <Input
                                  defaultValue={item.finalidade ?? ""}
                                  placeholder="Ex: Mandei para Villyan"
                                  className="h-9 text-xs"
                                  onBlur={(event) => {
                                    if (
                                      (item.finalidade ?? "") !==
                                      event.target.value
                                    ) {
                                      updateItem.mutate({
                                        id: item.id,
                                        patch: {
                                          finalidade:
                                            event.target.value || null,
                                        },
                                      });
                                    }
                                  }}
                                />
                              </td>

                              <td className="p-3">
                                {completed ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Completo
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10"
                                  >
                                    Pendente
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {filteredItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-10 text-center text-sm text-muted-foreground"
                            >
                              Nenhum item encontrado com os filtros atuais.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {plan === "premium" && (
                <Card className="border-amber-500/30 bg-amber-500/10 shadow-sm">
                  <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-700">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />

                    <p>
                      Sugestões inteligentes de categoria por IA serão exibidas
                      aqui em breve para usuários Premium.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewAnalysisForm({
  cards,
  categories,
  onDone,
}: {
  cards: CardRow[];
  categories: Category[];
  onDone: (id: string) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const parseFn = useServerFn(parseInvoice);

  const { selectedEntityId, selectedEntity } = useFinancialEntity();

  const [nome, setNome] = useState("");
  const [cardId, setCardId] = useState<string>("");
  const [faturaMes, setFaturaMes] = useState<string>("");
  const [text, setText] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }

      if (!text.trim()) {
        throw new Error("Cole o texto da fatura.");
      }

      const result = await parseFn({
        data: {
          text,
        },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const items = result.items;

      if (result.divergencia != null && Math.abs(result.divergencia) > 0.05) {
        toast.warning(
          `Atenção: a soma dos lançamentos importados não bate com o total da fatura (diferença R$ ${result.divergencia.toFixed(2)}). Verifique se algum lançamento ficou de fora.`
        );
      }

      const { data: analysis, error: analysisError } = await (supabase as any)
        .from("invoice_analyses")
        .insert({
          user_id: user.id,
          entity_id: selectedEntityId,
          card_id: cardId || null,
          fatura_mes: faturaMes || null,
          nome: nome || `Fatura ${new Date().toLocaleDateString("pt-BR")}`,
          raw_text: text.slice(0, 20000),
        })
        .select("id")
        .single();

      if (analysisError) throw analysisError;

      if (items.length) {
        const rows = items.map((item) => ({
          analysis_id: analysis.id,
          user_id: user.id,
          entity_id: selectedEntityId,
          data: item.data,
          descricao_original: item.descricao,
          valor: item.valor,
          categoria: matchCategory(item.descricao, categories) || null,
          finalidade: null,
          parcela_atual: item.parcela_atual ?? null,
          total_parcelas: item.total_parcelas ?? null,
        }));


        const { error: itemsError } = await (supabase as any)
          .from("invoice_analysis_items")
          .insert(rows);

        if (itemsError) throw itemsError;
      }

      return analysis.id as string;
    },

    onSuccess: (id) => {
      toast.success("Análise criada");
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      queryClient.invalidateQueries({ queryKey: ["all-analysis-items"] });
      onDone(id);
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-4">
      {selectedEntity && (
        <div className="rounded-2xl border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">
            Análise será vinculada em
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            {selectedEntity.type === "cnpj" ? (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <UserRound className="h-4 w-4 text-muted-foreground" />
            )}

            {selectedEntity.name} · {selectedEntity.type.toUpperCase()}
          </div>
        </div>
      )}

      <Card className="border-border bg-muted/40">
        <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
          No momento, esta tela trabalha com o texto extraído da fatura. Depois
          podemos evoluir para upload direto de PDF, CSV ou XLSX.
        </CardContent>
      </Card>

      <div>
        <Label>Nome da análise</Label>

        <Input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          placeholder="Ex: Nubank Junho/2026"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Cartão</Label>

          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cartão" />
            </SelectTrigger>

            <SelectContent>
              {cards.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Cadastre um cartão nesta entidade primeiro.
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

        <div>
          <Label>Mês da fatura</Label>

          <Input
            type="month"
            value={faturaMes?.slice(0, 7) ?? ""}
            onChange={(event) =>
              setFaturaMes(event.target.value ? `${event.target.value}-01` : "")
            }
          />
        </div>
      </div>

      <div>
        <Label>Texto da fatura</Label>

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-[240px] font-mono text-xs"
          placeholder="Cole aqui o texto extraído da sua fatura..."
        />
      </div>

      <Button
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="w-full"
      >
        {create.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analisando...
          </>
        ) : (
          <>
            <FileSearch className="mr-2 h-4 w-4" />
            Criar análise
          </>
        )}
      </Button>
    </div>
  );
}