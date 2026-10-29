import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function tokenize(expression: string) {
  const normalized = expression
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s/g, "");

  const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];

  if (tokens.join("") !== normalized) {
    throw new Error("Expressão inválida");
  }

  return tokens;
}

function calculateExpression(expression: string) {
  const tokens = tokenize(expression);
  let position = 0;

  function parseExpression(): number {
    let value = parseTerm();

    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();

    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const right = parseFactor();

      if (operator === "/" && right === 0) {
        throw new Error("Não é possível dividir por zero");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function parseFactor(): number {
    const token = tokens[position++];

    if (token === "-") return -parseFactor();

    if (token === "(") {
      const value = parseExpression();
      if (tokens[position++] !== ")") throw new Error("Parêntese não fechado");
      return value;
    }

    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Expressão inválida");
    return value;
  }

  if (tokens.length === 0) return 0;

  const value = parseExpression();
  if (position !== tokens.length || !Number.isFinite(value)) {
    throw new Error("Expressão inválida");
  }

  return value;
}

export function HomeCalculatorWidget() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [hasError, setHasError] = useState(false);

  const keys = useMemo(
    () => [
      "C", "(", ")", "÷",
      "7", "8", "9", "×",
      "4", "5", "6", "-",
      "1", "2", "3", "+",
      "0", ",", "⌫", "=",
    ],
    [],
  );

  function press(key: string) {
    if (key === "C") {
      setExpression("");
      setResult("0");
      setHasError(false);
      return;
    }

    if (key === "⌫") {
      setExpression((current) => current.slice(0, -1));
      setHasError(false);
      return;
    }

    if (key === "=") {
      try {
        const value = calculateExpression(expression);
        setResult(
          value.toLocaleString("pt-BR", {
            maximumFractionDigits: 8,
          }),
        );
        setHasError(false);
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Erro");
        setHasError(true);
      }
      return;
    }

    setExpression((current) => `${current}${key}`);
    setHasError(false);
  }

  return (
    <Card className="h-full min-h-[390px] overflow-hidden rounded-[24px] sm:rounded-[28px] border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="h-1 bg-[#D9FF66]" />

      <CardContent className="flex h-full min-h-0 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black">Calculadora</h3>
            <p className="mt-1 text-sm text-white/45">Cálculos rápidos</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9FF66]/25 bg-[#D9FF66]/10 text-[#D9FF66]">
            <Calculator className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-right">
          <div className="h-5 truncate text-xs text-white/35">
            {expression || "0"}
          </div>
          <div className={`mt-1 truncate text-2xl font-black ${hasError ? "text-red-400" : "text-white"}`}>
            {result}
          </div>
        </div>

        <div className="mt-3 grid flex-1 grid-cols-4 gap-2">
          {keys.map((key) => {
            const operator = ["÷", "×", "-", "+", "="].includes(key);

            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className={`flex min-h-11 items-center justify-center rounded-xl border text-sm font-bold transition active:scale-95 ${
                  operator
                    ? "border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66] hover:bg-[#D9FF66]/15"
                    : "border-white/10 bg-white/[0.045] text-white/75 hover:bg-white/[0.09]"
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
