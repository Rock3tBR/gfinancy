import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  GitCompareArrows,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import {
  FEATURE_GROUPS,
  FEATURE_LABELS,
  PLAN_CAPS,
  PLAN_FEATURES,
  PLAN_META,
  formatLimit,
  getExportFormats,
  getImportFormats,
  getPlanLevel,
  type Plan,
} from "@/lib/plans";

const PLAN_ICONS: Record<
  Plan,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  free: ShieldCheck,
  pro: Zap,
  premium: Sparkles,
  max: Users,
};

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlanosPage,
});

const plans: Plan[] = ["free", "pro", "premium", "max"];

function PlanosPage() {
  const { plan, startCheckout, openBillingPortal } = usePlan();

  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null);

  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const [selectedComparisonPlans, setSelectedComparisonPlans] = useState<
    Plan[]
  >(["pro", "premium"]);

  const currentPlanMeta = PLAN_META[plan];
  const currentCaps = PLAN_CAPS[plan];
  const CurrentPlanIcon = PLAN_ICONS[plan];

  const comparedPlans = useMemo(() => {
    return plans.filter((item) => selectedComparisonPlans.includes(item));
  }, [selectedComparisonPlans]);

  async function runCheckout(selectedPlan: Plan) {
    try {
      setLoadingPlan(selectedPlan);
      await startCheckout(selectedPlan);
    } finally {
      setLoadingPlan(null);
    }
  }

  function handleSelectPlan(selectedPlan: Plan) {
    const isDowngrade = getPlanLevel(selectedPlan) < getPlanLevel(plan);

    if (isDowngrade) {
      setDowngradeTarget(selectedPlan);
      return;
    }

    void runCheckout(selectedPlan);
  }

  function confirmDowngrade() {
    if (!downgradeTarget) return;

    const target = downgradeTarget;

    setDowngradeTarget(null);
    void runCheckout(target);
  }

  function toggleComparisonPlan(selectedPlan: Plan) {
    setSelectedComparisonPlans((current) => {
      if (current.includes(selectedPlan)) {
        return current.filter((item) => item !== selectedPlan);
      }

      return [...current, selectedPlan];
    });
  }

  function selectAllPlans() {
    setSelectedComparisonPlans([...plans]);
  }

  function clearComparisonPlans() {
    setSelectedComparisonPlans([]);
  }

  function confirmComparison() {
    if (selectedComparisonPlans.length < 2) return;

    setComparisonVisible(true);
    setCompareDialogOpen(false);

    window.setTimeout(() => {
      document.getElementById("comparacao-planos")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border bg-card shadow-sm">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
          <div>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Planos GFINANCY
            </Badge>

            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Escolha o plano ideal para controlar suas finanças.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Comece grátis, evolua para faturas e relatórios, desbloqueie IA no
              Premium e use o Max para controlar CPF, CNPJs, família e
              permissões.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoCard
                icon={WalletCards}
                title="Controle pessoal"
                description="Cartões, faturas, gastos, categorias e relatórios."
              />

              <InfoCard
                icon={Zap}
                title="IA financeira"
                description="Análise de fatura, previsões e mapas de gastos."
              />

              <InfoCard
                icon={Users}
                title="Família e negócios"
                description="CPF, CNPJs, membros e permissões no plano Max."
              />
            </div>
          </div>

          <div className="rounded-[28px] border bg-background p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Seu plano atual
            </p>

            <div className="mt-4 flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: `${currentPlanMeta.color}18`,
                }}
              >
                <CurrentPlanIcon
                  className="h-5 w-5"
                  style={{ color: currentPlanMeta.color }}
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-foreground">
                  {currentPlanMeta.name}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {currentPlanMeta.tagline}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <MiniLimit
                label="Cartões"
                value={formatLimit(currentCaps.maxCards)}
              />

              <MiniLimit
                label="Transações"
                value={formatLimit(currentCaps.maxTxPerMonth)}
              />

              <MiniLimit
                label="CPF"
                value={formatLimit(currentCaps.maxCpfEntities)}
              />

              <MiniLimit
                label="CNPJs"
                value={formatLimit(currentCaps.maxCnpjEntities)}
              />

              <MiniLimit
                label="Membros"
                value={formatLimit(currentCaps.maxMembers)}
              />

              <MiniLimit
                label="PDF"
                value={currentCaps.pdfExport ? "Sim" : "Não"}
              />
            </div>

            <div className="mt-5 rounded-2xl border bg-card p-4 text-sm leading-6 text-muted-foreground shadow-sm">
              {plan === "free"
                ? "Assine via checkout seguro. Depois da assinatura, você pode gerenciar cobranças e cancelar quando quiser."
                : "Sua assinatura está ativa. Gerencie forma de pagamento, troque de plano ou cancele quando quiser."}
            </div>

            {plan !== "free" && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full rounded-2xl"
                onClick={() => openBillingPortal()}
              >
                Gerenciar assinatura
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Planos disponíveis
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Escolha um plano ou compare somente as opções que desejar.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full px-5"
          onClick={() => setCompareDialogOpen(true)}
        >
          <GitCompareArrows className="mr-2 h-4 w-4" />
          Comparar planos
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        {plans.map((selectedPlan) => {
          const meta = PLAN_META[selectedPlan];
          const caps = PLAN_CAPS[selectedPlan];

          const isCurrent = selectedPlan === plan;
          const isRecommended =
            selectedPlan === "pro" || Boolean(meta.recommended);
          const isMax = selectedPlan === "max";
          const isPremium = selectedPlan === "premium";
          const isDowngrade = getPlanLevel(selectedPlan) < getPlanLevel(plan);
          const isUpgrade = getPlanLevel(selectedPlan) > getPlanLevel(plan);
          const loading = loadingPlan === selectedPlan;
          const PlanIcon = PLAN_ICONS[selectedPlan];

          return (
            <Card
              key={selectedPlan}
              className={[
                "relative overflow-hidden rounded-[30px] border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                isRecommended ? "border-primary/50 ring-4 ring-primary/10" : "",
                isCurrent ? "border-emerald-500/50 bg-muted/20" : "",
                isMax ? "border-amber-500/40" : "",
              ].join(" ")}
            >
              {isRecommended && (
                <div className="absolute right-4 top-4 z-10">
                  <Badge className="rounded-full">
                    <Crown className="mr-1.5 h-3.5 w-3.5" />
                    Mais escolhido
                  </Badge>
                </div>
              )}

              {isMax && !isRecommended && (
                <div className="absolute right-4 top-4 z-10">
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/40 text-amber-600"
                  >
                    Família
                  </Badge>
                </div>
              )}

              <div
                className="h-1.5"
                style={{ backgroundColor: meta.color }}
              />

              <CardContent className="flex h-full flex-col p-5">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: `${meta.color}18`,
                    color: meta.color,
                  }}
                >
                  <PlanIcon className="h-5 w-5" />
                </div>

                <div className="mt-5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">
                      {meta.name}
                    </h3>

                    {(isPremium || isMax) && (
                      <Crown className="h-4 w-4 text-amber-500" />
                    )}

                    {isCurrent && (
                      <Badge
                        variant="outline"
                        className="ml-auto rounded-full border-emerald-500/40 text-emerald-600"
                      >
                        Atual
                      </Badge>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {meta.tagline}
                  </p>

                  <p className="mt-3 min-h-[60px] text-sm leading-6 text-muted-foreground">
                    {meta.description}
                  </p>

                  <div className="mt-5">
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {meta.price}
                    </p>
                  </div>
                </div>

                <div className="my-5 h-px bg-border" />

                <div className="mb-5 grid grid-cols-2 gap-2">
                  <LimitBox
                    label="Cartões"
                    value={formatLimit(caps.maxCards)}
                  />

                  <LimitBox
                    label="Transações"
                    value={formatLimit(caps.maxTxPerMonth)}
                  />

                  <LimitBox
                    label="CPF"
                    value={formatLimit(caps.maxCpfEntities)}
                  />

                  <LimitBox
                    label="CNPJs"
                    value={formatLimit(caps.maxCnpjEntities)}
                  />

                  <LimitBox
                    label="Membros"
                    value={formatLimit(caps.maxMembers)}
                  />

                  <LimitBox
                    label="Exportação"
                    value={
                      caps.pdfExport
                        ? "PDF/CSV"
                        : caps.csvExport
                          ? "CSV"
                          : "Não"
                    }
                  />
                </div>

                <ul className="mb-6 flex-1 space-y-3">
                  {PLAN_FEATURES[selectedPlan].map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${meta.color}18`,
                          color: meta.color,
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>

                      <span className="leading-5 text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Button
                    type="button"
                    disabled={isCurrent || loadingPlan !== null}
                    variant={isRecommended ? "default" : "outline"}
                    className="w-full rounded-2xl"
                    onClick={() => handleSelectPlan(selectedPlan)}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : isCurrent ? (
                      "Plano atual"
                    ) : isDowngrade ? (
                      <>
                        Alterar para {meta.name}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : isUpgrade ? (
                      <>
                        Escolher {meta.name}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Escolher {meta.name}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {comparisonVisible && comparedPlans.length >= 2 && (
        <section
          id="comparacao-planos"
          className="scroll-mt-24 overflow-hidden rounded-[30px] border bg-card shadow-sm"
        >
          <div className="flex flex-col gap-4 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge
                variant="outline"
                className="rounded-full border-primary/30 bg-primary/5 text-primary"
              >
                Comparação selecionada
              </Badge>

              <h2 className="mt-3 text-xl font-bold text-foreground">
                Recursos dos planos escolhidos.
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Você está comparando {comparedPlans.length} planos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setCompareDialogOpen(true)}
              >
                Alterar seleção
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => setComparisonVisible(false)}
              >
                Fechar comparação
              </Button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[220px] p-4 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recurso
                  </th>

                  {comparedPlans.map((selectedPlan) => {
                    const meta = PLAN_META[selectedPlan];
                    const isCurrent = selectedPlan === plan;

                    return (
                      <th
                        key={selectedPlan}
                        className={[
                          "p-4 text-left align-bottom",
                          isCurrent ? "bg-primary/[0.06]" : "",
                        ].join(" ")}
                      >
                        <div
                          className="text-sm font-bold"
                          style={{ color: meta.color }}
                        >
                          {meta.name}
                        </div>

                        <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                          {meta.price}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                <ComparisonSectionRow
                  title="Limites"
                  columnCount={comparedPlans.length}
                />

                <ComparisonRow
                  label="Cartões"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={(selectedPlan) =>
                    formatLimit(PLAN_CAPS[selectedPlan].maxCards)
                  }
                />

                <ComparisonRow
                  label="Transações por mês"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={(selectedPlan) =>
                    formatLimit(PLAN_CAPS[selectedPlan].maxTxPerMonth)
                  }
                />

                <ComparisonRow
                  label="CPF"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={(selectedPlan) =>
                    formatLimit(PLAN_CAPS[selectedPlan].maxCpfEntities)
                  }
                />

                <ComparisonRow
                  label="CNPJs"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={(selectedPlan) =>
                    formatLimit(PLAN_CAPS[selectedPlan].maxCnpjEntities)
                  }
                />

                <ComparisonRow
                  label="Membros"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={(selectedPlan) =>
                    formatLimit(PLAN_CAPS[selectedPlan].maxMembers)
                  }
                />

                <ComparisonSectionRow
                  title="Faturas e relatórios"
                  columnCount={comparedPlans.length}
                />

                <ComparisonRow
                  label="Formatos de importação"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={getImportFormats}
                />

                <ComparisonRow
                  label="Exportação"
                  currentPlan={plan}
                  comparedPlans={comparedPlans}
                  getValue={getExportFormats}
                />

                {FEATURE_GROUPS[0].keys.map((key) => (
                  <ComparisonRow
                    key={key}
                    label={FEATURE_LABELS[key]}
                    currentPlan={plan}
                    comparedPlans={comparedPlans}
                    getValue={(selectedPlan) =>
                      PLAN_CAPS[selectedPlan][key]
                    }
                  />
                ))}

                <ComparisonSectionRow
                  title="Dashboard e inteligência"
                  columnCount={comparedPlans.length}
                />

                {FEATURE_GROUPS[1].keys.map((key) => (
                  <ComparisonRow
                    key={key}
                    label={FEATURE_LABELS[key]}
                    currentPlan={plan}
                    comparedPlans={comparedPlans}
                    getValue={(selectedPlan) =>
                      PLAN_CAPS[selectedPlan][key]
                    }
                  />
                ))}

                <ComparisonSectionRow
                  title="Família e negócios"
                  columnCount={comparedPlans.length}
                />

                {FEATURE_GROUPS[2].keys.map((key) => (
                  <ComparisonRow
                    key={key}
                    label={FEATURE_LABELS[key]}
                    currentPlan={plan}
                    comparedPlans={comparedPlans}
                    getValue={(selectedPlan) =>
                      PLAN_CAPS[selectedPlan][key]
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border bg-card shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground">Comece simples</h3>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use o plano grátis para validar seu controle financeiro básico sem
              custo.
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground">
              Evolua para faturas
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              O plano Pro libera importação, análise de faturas, alertas e
              relatórios.
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground">
              Use inteligência e multi-conta
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Premium adiciona IA. Max adiciona família, CPF, CNPJs e
              permissões.
            </p>
          </CardContent>
        </Card>
      </section>

      <PaymentTestModeBanner />

      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comparar planos</DialogTitle>

            <DialogDescription>
              Selecione pelo menos dois planos ou escolha todos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={selectAllPlans}
            >
              Selecionar todos
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={clearComparisonPlans}
            >
              Limpar seleção
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((selectedPlan) => {
              const meta = PLAN_META[selectedPlan];
              const PlanIcon = PLAN_ICONS[selectedPlan];
              const selected =
                selectedComparisonPlans.includes(selectedPlan);

              return (
                <button
                  key={selectedPlan}
                  type="button"
                  className={[
                    "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40",
                  ].join(" ")}
                  onClick={() => toggleComparisonPlan(selectedPlan)}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${meta.color}18`,
                      color: meta.color,
                    }}
                  >
                    <PlanIcon className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-foreground">
                      {meta.name}
                    </span>

                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {meta.price}
                    </span>
                  </span>

                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    ].join(" ")}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedComparisonPlans.length < 2 && (
            <p className="text-sm text-[#FF4D5E]">
              Selecione pelo menos dois planos para continuar.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setCompareDialogOpen(false)}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              className="rounded-2xl"
              disabled={selectedComparisonPlans.length < 2}
              onClick={confirmComparison}
            >
              <GitCompareArrows className="mr-2 h-4 w-4" />
              Comparar selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={downgradeTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setDowngradeTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF4D5E]/10">
              <AlertTriangle className="h-5 w-5 text-[#FF4D5E]" />
            </div>

            <DialogTitle className="mt-3">
              {downgradeTarget === "free"
                ? "Cancelar assinatura?"
                : `Alterar para o plano ${
                    downgradeTarget
                      ? PLAN_META[downgradeTarget].name
                      : ""
                  }?`}
            </DialogTitle>

            <DialogDescription className="pt-1 text-sm leading-6">
              {downgradeTarget === "free"
                ? "Ao mudar para o plano Grátis você perde acesso aos recursos do seu plano atual. Você será direcionado ao portal de cobrança para confirmar o cancelamento."
                : `Você está prestes a rebaixar do plano ${
                    currentPlanMeta.name
                  } para o ${
                    downgradeTarget
                      ? PLAN_META[downgradeTarget].name
                      : ""
                  }. Alguns recursos e limites deixarão de estar disponíveis.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setDowngradeTarget(null)}
            >
              Manter plano atual
            </Button>

            <Button
              type="button"
              className="rounded-2xl bg-[#FF4D5E] text-white hover:bg-[#FF4D5E]/90"
              onClick={confirmDowngrade}
            >
              {downgradeTarget === "free"
                ? "Continuar cancelamento"
                : "Continuar alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComparisonSectionRow({
  title,
  columnCount,
}: {
  title: string;
  columnCount: number;
}) {
  return (
    <tr>
      <td
        colSpan={columnCount + 1}
        className="bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </td>
    </tr>
  );
}

function ComparisonRow({
  label,
  currentPlan,
  comparedPlans,
  getValue,
}: {
  label: string;
  currentPlan: Plan;
  comparedPlans: Plan[];
  getValue: (selectedPlan: Plan) => string | boolean;
}) {
  return (
    <tr className="border-b border-border/60 last:border-b-0">
      <td className="p-4 text-sm text-muted-foreground">{label}</td>

      {comparedPlans.map((selectedPlan) => {
        const value = getValue(selectedPlan);
        const isCurrent = selectedPlan === currentPlan;

        return (
          <td
            key={selectedPlan}
            className={[
              "p-4 text-sm",
              isCurrent
                ? "bg-primary/[0.06] font-semibold text-foreground"
                : "text-foreground",
            ].join(" ")}
          >
            {typeof value === "boolean" ? (
              value ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground/40" />
              )
            ) : (
              value
            )}
          </td>
        );
      })}
    </tr>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />

      <div className="mt-3 text-sm font-bold text-foreground">{title}</div>

      <div className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

function MiniLimit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>

      <div className="mt-1 truncate text-sm font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}

function LimitBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 truncate text-sm font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}
