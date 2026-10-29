// Lógica compartilhada de importação/lançamento de fatura, usada tanto por
// InvoiceImportDialog.tsx (importação de fatura por texto/arquivo, com
// detecção de duplicadas) quanto por AnaliseFaturaPanel.tsx (análise de
// fatura item a item, com categorização e finalidade manuais).
//
// Extraído para evitar duplicação de: matching de categoria por palavra-chave,
// cálculo do mês de fatura a partir do dia de fechamento do cartão, e o
// insert de transactions + installments correspondentes. A UI e os fluxos de
// cada tela permanecem distintos — apenas a lógica não-visual foi unificada.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportCategory = {
  id: string;
  entity_id?: string | null;
  nome: string;
  keywords: string[] | null;
};

/**
 * Retorna o nome da primeira categoria cujas keywords batem (case-insensitive,
 * substring) com a descrição informada. Retorna string vazia se nenhuma bater.
 */
export function matchCategory(
  descricao: string,
  categories: ImportCategory[]
): string {
  const normalized = descricao.toLowerCase();

  for (const category of categories) {
    if (
      category.keywords?.some(
        (keyword) => keyword && normalized.includes(keyword.toLowerCase())
      )
    ) {
      return category.nome;
    }
  }

  return "";
}

export function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/**
 * Calcula o mês da fatura (sempre dia 01) para uma compra, dado o dia de
 * fechamento do cartão. Mesma regra usada em public.calc_first_fatura_mes
 * (ver migration 20260714120000_fix_closing_day_boundary_consistency.sql):
 * compra feita DEPOIS do dia de fechamento entra na fatura do mês seguinte;
 * no dia de fechamento ou antes, entra na fatura do mês corrente. Regra
 * unificada com `calcFirstFaturaMes` (src/lib/fatura.ts) e com a cópia local
 * em src/routes/_authenticated/transacoes.tsx — antes desta correção, esta
 * função usava `>` enquanto o banco usava `>=`, fazendo uma compra feita
 * exatamente no dia de fechamento cair em faturas diferentes dependendo de
 * qual fluxo a criou (importação vs. lançamento manual/gasto fixo).
 */
export function getInvoiceMonthByClosingDay(
  purchaseDateString: string,
  closingDay: number
): string {
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

  return ymd(invoiceMonth);
}

export type NewTransactionRow = {
  user_id: string;
  entity_id: string;
  tipo: "credito";
  descricao: string;
  categoria: string | null;
  valor_total: number;
  data_compra: string;
  parcelas: number;
  card_id: string;
  parcela_atual_importada?: number | null;
  total_parcelas_importadas?: number | null;
  fatura_mes_importada?: string | null;
};

export type CreatedTransaction = {
  id: string;
  card_id: string;
  data_compra: string;
  valor_total: number;
  parcela_atual_importada?: number | null;
  total_parcelas_importadas?: number | null;
  fatura_mes_importada?: string | null;
};

/**
 * Insere as transações informadas e, para cada uma, uma installment
 * correspondente (numero_parcela/total_parcelas fixos em 1 — cada linha
 * importada já representa o valor cobrado nesta fatura, não o valor total
 * parcelado). O fatura_mes de cada installment é calculado via
 * `computeFaturaMes` (permite que cada chamador decida a estratégia: a
 * partir do dia de fechamento do cartão, ou usando um mês de fatura fixo
 * já escolhido pelo usuário).
 *
 * Lança (throw) em caso de erro do Supabase, para ser tratado pelo
 * `onError` da mutation de cada tela chamadora.
 */
export async function insertTransactionsWithInstallments(
  supabase: SupabaseClient,
  {
    userId,
    entityId,
    rows,
    computeFaturaMes,
  }: {
    userId: string;
    entityId: string;
    rows: NewTransactionRow[];
    computeFaturaMes: (transaction: CreatedTransaction) => string;
  }
): Promise<number> {
  if (!rows.length) return 0;

  const { data: createdTransactions, error } = await supabase
    .from("transactions")
    .insert(rows)
    .select("id,card_id,data_compra,valor_total,parcela_atual_importada,total_parcelas_importadas,fatura_mes_importada");

  if (error) throw error;

  const created = (createdTransactions ?? []) as CreatedTransaction[];

  if (created.length) {
    const { error: cleanupError } = await supabase
      .from("installments")
      .delete()
      .in("transaction_id", created.map((transaction) => transaction.id));

    if (cleanupError) throw cleanupError;
  }

  const installmentRows = created.flatMap((transaction) => {
    const importedCurrentInstallment = Math.max(
      1,
      Number(transaction.parcela_atual_importada ?? 1),
    );

    const importedTotalInstallments = Math.max(
      importedCurrentInstallment,
      Number(transaction.total_parcelas_importadas ?? 1),
    );

    const firstInvoiceMonth =
      transaction.fatura_mes_importada ?? computeFaturaMes(transaction);

    const isImportedInstallment = Boolean(
      transaction.fatura_mes_importada ||
        transaction.parcela_atual_importada ||
        transaction.total_parcelas_importadas,
    );

    const installmentsToCreate = isImportedInstallment
      ? importedTotalInstallments - importedCurrentInstallment + 1
      : 1;

    return Array.from({ length: installmentsToCreate }, (_, index) => {
      const baseDate = new Date(`${firstInvoiceMonth.slice(0, 10)}T00:00:00`);
      const invoiceMonth = addMonths(baseDate, index);

      return {
        user_id: userId,
        entity_id: entityId,
        transaction_id: transaction.id,
        card_id: transaction.card_id,
        fatura_mes: ymd(invoiceMonth),
        data_compra: transaction.data_compra,
        valor: Number(transaction.valor_total),
        numero_parcela: isImportedInstallment
          ? importedCurrentInstallment + index
          : 1,
        total_parcelas: isImportedInstallment
          ? importedTotalInstallments
          : 1,
      };
    });
  });

  if (installmentRows.length) {
    const { error: installmentsError } = await supabase
      .from("installments")
      .insert(installmentRows);

    if (installmentsError) throw installmentsError;
  }

  return rows.length;
}
