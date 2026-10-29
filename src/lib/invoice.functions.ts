import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  text: z.string().min(1).max(200000),
});

export type ParsedInvoiceItem = {
  descricao: string;
  data: string; // YYYY-MM-DD
  valor: number; // positivo=despesa, negativo=pagamento/crédito
  parcela_atual: number | null;
  total_parcelas: number | null;
  tipo?: "despesa" | "pagamento" | "credito" | "iof" | "encargo" | null;
  cartao_last4?: string | null;
};

export type ParseInvoiceResult = {
  items: ParsedInvoiceItem[];
  fatura_mes: string | null;
  total_fatura: number | null;
  total_pagamentos: number | null;
  total_despesas: number | null;
  fechamento: string | null;
  vencimento: string | null;
  inicio_periodo: string | null;
  fim_periodo: string | null;
  soma_itens: number;
  divergencia: number | null;
  error: string | null;
};

function emptyResult(error: string): ParseInvoiceResult {
  return {
    items: [],
    fatura_mes: null,
    total_fatura: null,
    total_pagamentos: null,
    total_despesas: null,
    fechamento: null,
    vencimento: null,
    inicio_periodo: null,
    fim_periodo: null,
    soma_itens: 0,
    divergencia: null,
    error,
  };
}

export const parseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ParseInvoiceResult> => {
    // SECURITY / PLAN AUDIT FIX: importação e análise de fatura via IA são
    // recursos pagos (invoice_import / invoice_analysis). O front-end já
    // esconde a UI para o plano Free (FeatureGate / usePlan), mas o
    // servidor não validava nada — qualquer usuário autenticado podia
    // chamar este server function diretamente e consumir a IA de graça.
    // Reforça a checagem aqui, no servidor, antes de gastar créditos de IA.
    const { supabase, userId } = context;
    const { data: planData, error: planErr } = await supabase.rpc(
      "get_user_plan",
      { p_user_id: userId },
    );
    if (planErr) {
      return emptyResult(planErr.message);
    }
    const plan = (planData as string | null) ?? "free";
    if (plan === "free") {
      return emptyResult(
        "Recurso disponível apenas nos planos Pro/Premium.",
      );
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        items: [],
        fatura_mes: null,
        total_fatura: null,
        total_pagamentos: null,
        total_despesas: null,
        fechamento: null,
        vencimento: null,
        inicio_periodo: null,
        fim_periodo: null,
        soma_itens: 0,
        divergencia: null,
        error: "LOVABLE_API_KEY ausente",
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const system = `Você é um extrator ESTRITO de lançamentos de faturas de cartão de crédito em português (Santander, Nubank, Itaú, Bradesco, etc). Responda APENAS chamando a função register_purchases.

REGRAS OBRIGATÓRIAS:
1. Extraia CADA LINHA da fatura como um item separado. NUNCA agrupe, some ou consolide lançamentos, mesmo que tenham a mesma data, descrição ou valor. Se aparecerem duas linhas "MERCADO*BRRELOGIOS" no mesmo dia com valores diferentes, devolva dois itens distintos.
2. Leia TODAS as seções: "Despesas", "Compras nacionais", "Compras internacionais", "Parcelamentos", "Pagamento e demais créditos", "IOF", "Encargos", "Anuidade", "Serviços". Não pule seção alguma.
3. Não invente linhas. Não interprete totais/subtotais como lançamentos.
4. Valor: use exatamente o que consta na fatura em reais como number decimal (ex.: 20.73). Nunca divida pelo número de parcelas. Se aparecer "PARC 2/12 R$ 100,00" o valor é 100.00 (o valor da parcela cobrado nesta fatura), NÃO 100*12.
5. Sinal e classificação do valor:
   - Linhas das seções Despesas, Compras, Parcelamentos, IOF, Encargos, Anuidade e Serviços => valor POSITIVO.
   - Linhas das seções Pagamento e Demais Créditos, Pagamentos, Créditos, Estornos e Ajustes a favor => valor NEGATIVO.
   - Uma descrição contendo PAGAMENTO DE FATURA nunca é compra: tipo=pagamento e valor negativo.
   - Estorno, crédito recebido, cashback e ajuste a favor nunca são despesas: tipo=credito e valor negativo.
6. Data: YYYY-MM-DD. Se a fatura mostrar DD/MM, complete com o ano da fatura. A data normalmente é o primeiro campo da linha, logo antes da descrição. Sequências NN/NN localizadas depois da descrição geralmente são parcelas, não datas. Se a linha não tiver data, use ${today}.
7. Parcelas: se a linha indicar "2/12", "PARC 02/12", "2 DE 12" => parcela_atual=2, total_parcelas=12. Caso contrário null. ATENÇÃO: em linhas como "14/05 AMAZON MARKETPLACE 02/09 37,89", 14/05 é a data da compra e 02/09 é a parcela. Nunca troque esses dois campos nem transforme 02/09 em data.
8. Descrição: limpe prefixos irrelevantes (@, *, códigos numéricos de autorização), mas mantenha o nome do estabelecimento reconhecível. NUNCA renomeie para categorias genéricas ("Relógio", "Streaming"). Preserve o texto original do estabelecimento.
9. cartao_last4: se o bloco/seção estiver rotulado com os 4 últimos dígitos de um cartão adicional (ex.: "Final 1234"), preencha esse campo com esses 4 dígitos para todas as linhas daquele bloco. Caso contrário null.
10. tipo: classifique como "despesa" | "pagamento" | "credito" | "iof" | "encargo".
11. Mês da fatura: preencha fatura_mes no formato YYYY-MM-01. Use o mês/ano da fatura ou do vencimento, NÃO o mês da compra. Exemplo: vencimento 12/07/2026 => fatura_mes="2026-07-01".
12. Totais: preencha total_fatura (valor total a pagar), total_pagamentos (soma da seção Pagamentos e demais créditos, sempre positivo aqui) e total_despesas (soma das despesas do período), quando aparecerem na fatura. Se não encontrar, use null.
13. Datas oficiais: extraia fechamento, vencimento, inicio_periodo e fim_periodo no formato YYYY-MM-DD. O período costuma aparecer como "Período das compras DD/MM/AA a DD/MM/AA". Quando a fatura disser "compras e pagamentos realizados até DD/MM", essa data pode ser usada como fechamento/fim_periodo. Não invente datas ausentes; use null.

NÃO responda em texto. Sempre chame register_purchases.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: data.text },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "register_purchases",
                description: "Registra a lista de lançamentos extraídos da fatura, item por item, sem agrupar.",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          descricao: { type: "string" },
                          data: { type: "string" },
                          valor: { type: "number" },
                          parcela_atual: { type: ["integer", "null"] },
                          total_parcelas: { type: ["integer", "null"] },
                          tipo: {
                            type: ["string", "null"],
                            enum: ["despesa", "pagamento", "credito", "iof", "encargo", null],
                          },
                          cartao_last4: { type: ["string", "null"] },
                        },
                        required: ["descricao", "data", "valor"],
                        additionalProperties: false,
                      },
                    },
                    fatura_mes: { type: ["string", "null"] },
                    total_fatura: { type: ["number", "null"] },
                    total_pagamentos: { type: ["number", "null"] },
                    total_despesas: { type: ["number", "null"] },
                    fechamento: { type: ["string", "null"] },
                    vencimento: { type: ["string", "null"] },
                    inicio_periodo: { type: ["string", "null"] },
                    fim_periodo: { type: ["string", "null"] },
                  },
                  required: ["items"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "register_purchases" } },
        }),
      });

      if (res.status === 429)
        return {
          items: [],
          fatura_mes: null,
          total_fatura: null,
          total_pagamentos: null,
          total_despesas: null,
          fechamento: null,
          vencimento: null,
          inicio_periodo: null,
          fim_periodo: null,
          soma_itens: 0,
          divergencia: null,
          error: "Limite de uso da IA atingido. Tente novamente em instantes.",
        };
      if (res.status === 402)
        return {
          items: [],
          fatura_mes: null,
          total_fatura: null,
          total_pagamentos: null,
          total_despesas: null,
          fechamento: null,
          vencimento: null,
          inicio_periodo: null,
          fim_periodo: null,
          soma_itens: 0,
          divergencia: null,
          error: "Créditos de IA esgotados. Adicione créditos nas configurações.",
        };
      if (!res.ok) {
        const t = await res.text();
        return {
          items: [],
          fatura_mes: null,
          total_fatura: null,
          total_pagamentos: null,
          total_despesas: null,
          fechamento: null,
          vencimento: null,
          inicio_periodo: null,
          fim_periodo: null,
          soma_itens: 0,
          divergencia: null,
          error: `IA respondeu ${res.status}: ${t.slice(0, 200)}`,
        };
      }

      const json = await res.json();
      const call = json.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = call?.function?.arguments;
      if (!argsStr)
        return {
          items: [],
          fatura_mes: null,
          total_fatura: null,
          total_pagamentos: null,
          total_despesas: null,
          fechamento: null,
          vencimento: null,
          inicio_periodo: null,
          fim_periodo: null,
          soma_itens: 0,
          divergencia: null,
          error: "Não consegui extrair compras da fatura.",
        };
      const parsed = JSON.parse(argsStr);

      const items: ParsedInvoiceItem[] = (parsed.items || [])
        .map((i: Record<string, unknown>) => {
          const descricao = String(i.descricao || "").trim();
          const normalizedDescription = descricao
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

          let valor = Number(i.valor || 0);
          let tipo = (i.tipo as ParsedInvoiceItem["tipo"]) ?? null;

          const looksLikePayment =
            normalizedDescription.includes("pagamento de fatura") ||
            normalizedDescription.startsWith("pagamento fatura") ||
            normalizedDescription.includes("pagamento recebido");

          const looksLikeCredit =
            normalizedDescription.includes("estorno") ||
            normalizedDescription.includes("credito") ||
            normalizedDescription.includes("cashback") ||
            normalizedDescription.includes("ajuste a favor");

          if (looksLikePayment || tipo === "pagamento") {
            tipo = "pagamento";
            valor = -Math.abs(valor);
          } else if (looksLikeCredit || tipo === "credito") {
            tipo = "credito";
            valor = -Math.abs(valor);
          } else {
            tipo = tipo ?? "despesa";
            valor = Math.abs(valor);
          }

          return {
            descricao,
            data: String(i.data || today),
            valor: Number(valor.toFixed(2)),
            parcela_atual:
              i.parcela_atual == null ? null : Number(i.parcela_atual),
            total_parcelas:
              i.total_parcelas == null ? null : Number(i.total_parcelas),
            tipo,
            cartao_last4:
              i.cartao_last4 == null
                ? null
                : String(i.cartao_last4).replace(/\D/g, "").slice(-4) || null,
          };
        })
        .filter((i: ParsedInvoiceItem) => i.descricao && i.valor !== 0);

      const rawInvoiceMonth =
        parsed.fatura_mes == null ? null : String(parsed.fatura_mes).trim();

      const fatura_mes =
        rawInvoiceMonth && /^\d{4}-\d{2}-(?:01|\d{2})$/.test(rawInvoiceMonth)
          ? `${rawInvoiceMonth.slice(0, 7)}-01`
          : null;

      const soma_itens = Number(items.reduce((acc, i) => acc + i.valor, 0).toFixed(2));
      const total_fatura = parsed.total_fatura == null ? null : Number(parsed.total_fatura);
      const total_pagamentos = parsed.total_pagamentos == null ? null : Number(parsed.total_pagamentos);
      const total_despesas = parsed.total_despesas == null ? null : Number(parsed.total_despesas);

      const normalizeDate = (value: unknown): string | null => {
        if (value == null) return null;
        const raw = String(value).trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
      };

      const fechamento = normalizeDate(parsed.fechamento);
      const vencimento = normalizeDate(parsed.vencimento);
      const inicio_periodo = normalizeDate(parsed.inicio_periodo);
      const fim_periodo = normalizeDate(parsed.fim_periodo);

      let divergencia: number | null = null;
      if (total_despesas != null) {
        const somaDespesas = items.filter((i) => i.valor > 0).reduce((a, b) => a + b.valor, 0);
        divergencia = Number((somaDespesas - total_despesas).toFixed(2));
      } else if (total_fatura != null) {
        divergencia = Number((soma_itens - total_fatura).toFixed(2));
      }

      return {
        items,
        fatura_mes,
        total_fatura,
        total_pagamentos,
        total_despesas,
        fechamento,
        vencimento,
        inicio_periodo,
        fim_periodo,
        soma_itens,
        divergencia,
        error: null,
      };
    } catch (e) {
      console.error("parseInvoice error", e);
      return {
        items: [],
        fatura_mes: null,
        total_fatura: null,
        total_pagamentos: null,
        total_despesas: null,
        fechamento: null,
        vencimento: null,
        inicio_periodo: null,
        fim_periodo: null,
        soma_itens: 0,
        divergencia: null,
        error: e instanceof Error ? e.message : "Erro desconhecido",
      };
    }
  });
