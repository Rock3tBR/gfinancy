// Espelha public.calc_first_fatura_mes do banco (ver migration
// 20260714120000_fix_closing_day_boundary_consistency.sql).
// Regra: compra feita DEPOIS do dia de fechamento entra na fatura do mês
// seguinte; no dia de fechamento ou antes, entra na fatura do mês atual.
// (Antes desta correção, esta função usava `dia >= diaFechamento`, diferente
// da regra `dia > diaFechamento` já usada em src/lib/invoice-import.ts e em
// src/routes/_authenticated/transacoes.tsx — essa divergência fazia uma
// compra feita EXATAMENTE no dia de fechamento cair em faturas diferentes
// dependendo de qual fluxo a criou, o que parecia "o cartão fecha em dias
// diferentes". Agora as três implementações usam a mesma regra.)
export function calcFirstFaturaMes(dataCompra: Date, diaFechamento: number): Date {
  const y = dataCompra.getFullYear();
  const m = dataCompra.getMonth();
  const dia = dataCompra.getDate();
  if (dia > diaFechamento) {
    return new Date(y, m + 1, 1);
  }
  return new Date(y, m, 1);
}

// Retorna o mês da fatura atualmente aberta para um cartão (em referência à data "hoje").
export function faturaAbertaMes(hoje: Date, diaFechamento: number): Date {
  return calcFirstFaturaMes(hoje, diaFechamento);
}

// Retorna a data de vencimento dentro de um mês específico, corrigindo
// (clampando) para o último dia válido do mês quando diaVencimento (ex.: 31)
// não existir nesse mês (ex.: fevereiro ou meses com 30 dias). Sem o clamp,
// `new Date(y, m, 31)` "rola" silenciosamente para o mês seguinte quando o
// mês de referência tem menos de 31 dias.
function vencimentoNoMes(ano: number, mes: number, diaVencimento: number): Date {
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  const diaClampado = Math.min(diaVencimento, ultimoDiaDoMes);
  return new Date(ano, mes, diaClampado);
}

// Data de vencimento da próxima fatura
export function proximoVencimento(hoje: Date, diaFechamento: number, diaVencimento: number): Date {
  const fatura = faturaAbertaMes(hoje, diaFechamento);
  // vencimento é no diaVencimento do mês de fatura (ou no mês seguinte se já passou),
  // clampado para o último dia válido do mês quando diaVencimento não existir nele.
  let venc = vencimentoNoMes(fatura.getFullYear(), fatura.getMonth(), diaVencimento);
  if (venc < hoje) {
    venc = vencimentoNoMes(fatura.getFullYear(), fatura.getMonth() + 1, diaVencimento);
  }
  return venc;
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function lastDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
