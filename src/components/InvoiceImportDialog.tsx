import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileCheck2,
  FileText,
  Info,
  Loader2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import { supabase } from "@/integrations/supabase/client";
import { brl, ptDate } from "@/lib/format";
import {
  getInvoiceMonthByClosingDay,
  insertTransactionsWithInstallments,
  matchCategory,
  type ImportCategory,
} from "@/lib/invoice-import";
import { parseInvoice, type ParsedInvoiceItem } from "@/lib/invoice.functions";
import { extractTextFromPdf } from "@/lib/pdf/extract-pdf-text";

const IMPORTABLE_TYPES = new Set(["despesa", "iof", "encargo"]);

function normalizeDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function moneyKey(value: number) {
  return Math.abs(Number(value)).toFixed(2);
}

function isPaymentOrCredit(item: ParsedInvoiceItem) {
  return item.valor < 0 || item.tipo === "pagamento" || item.tipo === "credito";
}

function isImportable(item: ParsedInvoiceItem) {
  if (item.valor <= 0) return false;
  if (!item.tipo) return true;
  return IMPORTABLE_TYPES.has(item.tipo);
}

function movementLabel(item: ParsedInvoiceItem) {
  if (item.tipo === "pagamento") return "Pagamento";
  if (item.tipo === "credito") return "Crédito/estorno";
  if (item.tipo === "iof") return "IOF";
  if (item.tipo === "encargo") return "Encargo";
  return "Compra";
}

type Card = {
  id: string;
  entity_id?: string | null;
  nome: string;
  dia_fechamento?: number | null;
};

type Category = ImportCategory & {
  entity_id: string | null;
};

type ExistingTx = {
  descricao: string;
  valor_total: number;
  parcelas: number;
  card_id: string | null;
  data_compra: string;
  parcela_atual_importada?: number | null;
  total_parcelas_importadas?: number | null;
  fatura_mes_importada?: string | null;
};

type Row = ParsedInvoiceItem & {
  selected: boolean;
  duplicate: boolean;
  importable: boolean;
  categoria: string;
};

type InvoiceImportDialogProps = {
  cards: Card[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function InvoiceImportDialog({
  cards,
  open: openProp,
  onOpenChange,
}: InvoiceImportDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const parseFn = useServerFn(parseInvoice);
  const { selectedEntityId, selectedEntity } = useFinancialEntity();

  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [cardId, setCardId] = useState("");
  const [text, setText] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState<string | null>(null);
  const [invoiceSummary, setInvoiceSummary] = useState<{
    total_fatura: number | null;
    total_pagamentos: number | null;
    total_despesas: number | null;
    fechamento: string | null;
    vencimento: string | null;
    inicio_periodo: string | null;
    fim_periodo: string | null;
  } | null>(null);

  const selectedCard = cards.find((card) => card.id === cardId);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", user?.id, selectedEntityId],
    enabled: Boolean(user && selectedEntityId && open),
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

  const { data: existingTxs = [] } = useQuery({
    queryKey: ["existing-credit-tx", user?.id, selectedEntityId, cardId],
    enabled: Boolean(user && selectedEntityId && cardId && open),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("descricao,valor_total,parcelas,card_id,data_compra,parcela_atual_importada,total_parcelas_importadas,fatura_mes_importada")
        .eq("user_id", user!.id)
        .eq("entity_id", selectedEntityId)
        .eq("tipo", "credito")
        .eq("card_id", cardId);

      if (error) throw error;
      return (data ?? []) as ExistingTx[];
    },
  });

  function resetDialog() {
    setText("");
    setLoadedFileName(null);
    setRows(null);
    setInvoiceMonth(null);
    setInvoiceSummary(null);
    setCardId("");
  }

  async function onFile(file: File) {
    try {
      setIsReadingFile(true);
      const fileName = file.name.toLowerCase();

      if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
        setText(await extractTextFromPdf(file));
        setLoadedFileName(file.name);
        setRows(null);
        toast.success("Dados da fatura carregados.");
        return;
      }

      if (
        file.type.startsWith("text/") ||
        fileName.endsWith(".csv") ||
        fileName.endsWith(".txt")
      ) {
        setText(await file.text());
        setLoadedFileName(file.name);
        setRows(null);
        toast.success("Dados da fatura carregados.");
        return;
      }

      toast.error("Envie um arquivo PDF, TXT ou CSV.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsReadingFile(false);
    }
  }

  const parseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }
      if (!text.trim()) {
        throw new Error("Selecione um arquivo ou cole o texto da fatura.");
      }
      if (!cardId) {
        throw new Error("Selecione o cartão.");
      }

      const result = await parseFn({ data: { text } });
      if (result.error) throw new Error(result.error);
      return result;
    },

    onSuccess: (result) => {
      const items = result.items;
      setInvoiceMonth(result.fatura_mes);
      setInvoiceSummary({
        total_fatura: result.total_fatura,
        total_pagamentos: result.total_pagamentos,
        total_despesas: result.total_despesas,
        fechamento: result.fechamento,
        vencimento: result.vencimento,
        inicio_periodo: result.inicio_periodo,
        fim_periodo: result.fim_periodo,
      });
      const newRows: Row[] = items.map((item) => {
        const importable = isImportable(item);
        // `row.valor` mantém o valor da PARCELA (o que aparece na fatura),
        // para exibição e para o total conferir com o total_despesas da
        // fatura. Ao inserir em transactions, multiplicamos por
        // total_parcelas para armazenar o valor total da compra — que é o
        // que FaturasOverviewPanel espera para projetar as próximas
        // faturas (ele divide valor_total ÷ parcelas).
        const amount = Math.abs(Number(item.valor));
        const totalParcelas = Number(item.total_parcelas ?? 1) || 1;
        const parcelaAtual = Number(item.parcela_atual ?? 1) || 1;

        const duplicate =
          importable &&
          existingTxs.some(
            (tx) =>
              normalizeDescription(tx.descricao) ===
                normalizeDescription(item.descricao) &&
              moneyKey(tx.valor_total) === moneyKey(amount) &&
              tx.data_compra === item.data &&
              Number(
                tx.total_parcelas_importadas ?? tx.parcelas ?? 1,
              ) === totalParcelas &&
              Number(tx.parcela_atual_importada ?? 1) === parcelaAtual &&
              (invoiceMonth == null ||
                tx.fatura_mes_importada == null ||
                tx.fatura_mes_importada === invoiceMonth),
          );

        return {
          ...item,
          valor: amount,
          importable,
          duplicate,
          selected: importable && !duplicate,
          categoria: importable
            ? matchCategory(item.descricao, categories)
            : "",
        };
      });



      setRows(newRows);

      const importableCount = newRows.filter((row) => row.importable).length;
      const ignoredCount = newRows.length - importableCount;

      toast.success(
        `${importableCount} compras encontradas${
          ignoredCount ? ` · ${ignoredCount} pagamentos/créditos ignorados` : ""
        }`,
      );
    },

    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!selectedEntityId) {
        throw new Error("Nenhuma entidade financeira selecionada.");
      }
      if (!rows) throw new Error("Analise a fatura antes de importar.");
      if (!cardId || !selectedCard) throw new Error("Selecione o cartão.");

      const selectedRows = rows.filter(
        (row) => row.selected && row.importable && !row.duplicate,
      );

      if (!selectedRows.length) {
        throw new Error("Nenhuma compra válida foi selecionada.");
      }

      const invalidRows = selectedRows.filter(
        (row) => !Number.isFinite(row.valor) || row.valor <= 0,
      );

      if (invalidRows.length) {
        throw new Error(
          "A seleção contém pagamento, crédito, estorno ou valor inválido.",
        );
      }

      if (!invoiceMonth) {
        toast.warning(
          "Não foi possível identificar o mês da fatura. As parcelas serão calculadas pela data da compra.",
        );
      }

      // A importação preserva o valor e a posição da parcela que aparecem
      // na fatura. Os campos *_importada são criados pela migration
      // 20260715143000_fix_imported_invoice_installment_values.sql.
      const transactionRows = selectedRows.map((row) => {
        const parcelaValor = Number(
          Math.abs(Number(row.valor)).toFixed(2),
        );
        const totalParcelas = Number(row.total_parcelas ?? 1) || 1;
        const parcelaAtual = Number(row.parcela_atual ?? 1) || 1;

        return {
          user_id: user.id,
          entity_id: selectedEntityId,
          tipo: "credito" as const,
          descricao: row.descricao.trim(),
          categoria: row.categoria || null,
          valor_total: parcelaValor,
          data_compra: row.data,
          parcelas: totalParcelas,
          card_id: cardId,
          parcela_atual_importada: parcelaAtual,
          total_parcelas_importadas: totalParcelas,
          fatura_mes_importada: invoiceMonth,
        };
      });


      const closingDay = Number(selectedCard.dia_fechamento || 31);

      return insertTransactionsWithInstallments(supabase as any, {
        userId: user.id,
        entityId: selectedEntityId,
        rows: transactionRows,
        // Quando o PDF informa a competência, ela é a fonte de verdade.
        // O cálculo pelo dia fixo do cartão fica apenas como fallback.
        computeFaturaMes: (transaction) =>
          invoiceMonth ??
          getInvoiceMonthByClosingDay(transaction.data_compra, closingDay),
      }).then(async (count) => {
        if (invoiceMonth) {
          const invoicePayload = {
            user_id: user.id,
            entity_id: selectedEntityId,
            card_id: cardId,
            fatura_mes: invoiceMonth,
            valor_total: invoiceSummary?.total_fatura ?? null,
            total_despesas: invoiceSummary?.total_despesas ?? null,
            total_pagamentos: invoiceSummary?.total_pagamentos ?? null,
            fechamento: invoiceSummary?.fechamento ?? null,
            vencimento: invoiceSummary?.vencimento ?? null,
            inicio_periodo: invoiceSummary?.inicio_periodo ?? null,
            fim_periodo: invoiceSummary?.fim_periodo ?? null,
            origem: "importada_pdf",
          };

          const { error: invoiceError } = await (supabase as any)
            .from("invoices")
            .upsert(invoicePayload, { onConflict: "card_id,fatura_mes" });

          if (invoiceError) throw invoiceError;
        }

        return count;
      });
    },

    onSuccess: async (count) => {
      toast.success(`${count} compras importadas`);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["txs"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-month-count"] }),
        queryClient.invalidateQueries({ queryKey: ["insts"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["cards"] }),
        queryClient.invalidateQueries({ queryKey: ["home-txs"] }),
        queryClient.invalidateQueries({ queryKey: ["home-installments"] }),
        queryClient.invalidateQueries({ queryKey: ["home-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["txs-cat"] }),
      ]);

      setOpen(false);
      resetDialog();
    },

    onError: (error: Error) => toast.error(error.message),
  });

  const summary = useMemo(() => {
    const all = rows ?? [];
    const selected = all.filter((row) => row.selected && row.importable);

    return {
      selectedCount: selected.length,
      totalCount: all.length,
      importableCount: all.filter((row) => row.importable).length,
      ignoredCount: all.filter((row) => !row.importable).length,
      duplicateCount: all.filter((row) => row.duplicate).length,
      total: selected.reduce((sum, row) => sum + Number(row.valor), 0),
    };
  }, [rows]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
        >
          <FileText className="mr-2 h-4 w-4" />
          Importar fatura
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Importar fatura</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(92vh-78px)] overflow-y-auto px-6 py-5">
          {!selectedEntityId || !selectedEntity ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
              Selecione uma entidade financeira no topo da tela antes de
              importar uma fatura.
            </div>
          ) : !rows ? (
            <div className="space-y-5">
              <div className="rounded-2xl border bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground">
                  Importação será vinculada em
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  {selectedEntity.type === "cnpj" ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  )}
                  {selectedEntity.name} · {selectedEntity.type.toUpperCase()}
                </div>
              </div>

              <div className="space-y-2">
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

              <div className="space-y-2">
                <Label>Arquivo PDF, TXT, CSV ou texto da fatura</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-accent">
                    {isReadingFile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isReadingFile ? "Lendo arquivo..." : "Selecionar arquivo"}
                    <input
                      type="file"
                      accept=".pdf,application/pdf,.txt,.csv,text/plain,text/csv"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void onFile(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <span className="text-xs text-muted-foreground">
                    PDFs com texto selecionável são lidos automaticamente.
                  </span>
                </div>

                {loadedFileName && text.trim() ? (
                  <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/[0.025] px-6 py-8">
                    <button
                      type="button"
                      onClick={() => {
                        setText("");
                        setLoadedFileName(null);
                        setRows(null);
                      }}
                      className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                      aria-label="Remover arquivo carregado"
                      title="Remover arquivo"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D9FF66] text-black shadow-[0_0_30px_rgba(217,255,102,0.12)]">
                        <FileCheck2 className="h-8 w-8" strokeWidth={1.8} />
                      </div>

                      <h3 className="mt-5 text-base font-black text-foreground">
                        Dados da fatura carregados!
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Os itens foram identificados e estão prontos para
                        análise.
                      </p>

                      <div className="mt-4 max-w-full rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-muted-foreground">
                        <span className="block max-w-[300px] truncate">
                          {loadedFileName}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Textarea
                    className="min-h-[150px] font-mono text-xs"
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      setLoadedFileName(null);
                      setRows(null);
                    }}
                    placeholder="Ou cole aqui o texto da fatura..."
                  />
                )}
              </div>

              <Button
                onClick={() => parseMutation.mutate()}
                disabled={
                  parseMutation.isPending ||
                  isReadingFile ||
                  !text.trim() ||
                  !cardId
                }
                className="h-12 w-full rounded-xl font-black"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisando fatura...
                  </>
                ) : loadedFileName ? (
                  "Continuar para análise"
                ) : (
                  "Analisar fatura"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    Selecionadas
                  </div>
                  <div className="mt-1 font-bold">
                    {summary.selectedCount} de {summary.importableCount}
                  </div>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Ignoradas</div>
                  <div className="mt-1 font-bold">{summary.ignoredCount}</div>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    Total a importar
                  </div>
                  <div className="mt-1 font-bold text-[#D9FF66]">
                    {brl(summary.total)}
                  </div>
                </div>
              </div>

              {summary.ignoredCount > 0 && (
                <div className="flex gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  <span className="text-muted-foreground">
                    Pagamentos, créditos e estornos aparecem na lista para
                    conferência, mas ficam desmarcados e não serão importados
                    como despesas.
                  </span>
                </div>
              )}

              <div className="max-h-[440px] overflow-y-auto rounded-2xl border">
                {rows.map((row, index) => {
                  const ignored = !row.importable;

                  return (
                    <div
                      key={`${row.data}-${row.descricao}-${index}`}
                      className={`flex items-start gap-3 border-b p-3 last:border-b-0 ${
                        ignored ? "bg-muted/20 opacity-70" : ""
                      }`}
                    >
                      <Checkbox
                        checked={row.selected}
                        disabled={ignored || row.duplicate}
                        onCheckedChange={(value) =>
                          setRows((currentRows) =>
                            currentRows!.map((current, currentIndex) =>
                              currentIndex === index
                                ? { ...current, selected: Boolean(value) }
                                : current,
                            ),
                          )
                        }
                        className="mt-1"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {row.descricao}
                          </span>

                          <Badge
                            variant={ignored ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {movementLabel(row)}
                          </Badge>

                          {row.duplicate && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Já cadastrada
                            </Badge>
                          )}

                          {row.total_parcelas && row.total_parcelas > 1 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {row.parcela_atual ?? "?"}/{row.total_parcelas}
                            </Badge>
                          )}

                          {row.categoria && (
                            <Badge variant="outline" className="text-[10px]">
                              {row.categoria}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{ptDate(row.data)}</span>
                          {ignored && (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Não será
                              importado
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`shrink-0 text-sm font-bold ${
                          isPaymentOrCredit(row)
                            ? "text-blue-400"
                            : "text-foreground"
                        }`}
                      >
                        {isPaymentOrCredit(row) ? "−" : ""}
                        {brl(Math.abs(Number(row.valor)))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {summary.duplicateCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {summary.duplicateCount} lançamento(s) já cadastrado(s) foram
                  desmarcados automaticamente.
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRows(null)}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={
                    importMutation.isPending || summary.selectedCount === 0
                  }
                  className="flex-1"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    `Importar ${summary.selectedCount} selecionada${
                      summary.selectedCount === 1 ? "" : "s"
                    }`
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
