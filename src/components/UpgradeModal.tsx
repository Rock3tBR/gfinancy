import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Check,
  Crown,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  FEATURE_UPGRADE_COPY,
  PLAN_FEATURES,
  PLAN_META,
  getPlanLevel,
  type BooleanFeature,
  type Plan,
} from "@/lib/plans";

type UpgradeModalProps = {
  open: boolean;
  reason?: string;
  feature?: BooleanFeature;
  currentPlan: Plan;
  onClose: () => void;
  onSelect: (plan: Plan) => void | Promise<void>;
};

const plans: Plan[] = ["free", "pro", "premium", "max"];

export function UpgradeModal({
  open,
  reason,
  feature,
  currentPlan,
  onClose,
  onSelect,
}: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  const featureCopy = feature ? FEATURE_UPGRADE_COPY[feature] : null;

  const recommendedPlan = useMemo<Plan>(() => {
    if (featureCopy?.recommendedPlan) {
      return featureCopy.recommendedPlan;
    }

    return "pro";
  }, [featureCopy]);

  const modalTitle =
    featureCopy?.title ?? "Desbloqueie recursos avançados";

  const modalDescription =
    reason ??
    featureCopy?.description ??
    "Escolha um plano para liberar recursos premium, automatizar sua organização financeira e gerar relatórios completos.";

  async function handleSelect(plan: Plan) {
    try {
      setLoadingPlan(plan);
      await onSelect(plan);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-slate-200 p-0 shadow-2xl">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <DialogHeader>
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Upgrade de plano
            </div>

            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-950">
              {modalTitle}
            </DialogTitle>

            <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
              {modalDescription}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          {plans.map((plan) => {
            const meta = PLAN_META[plan];
            const isCurrent = plan === currentPlan;
            const isRecommended = plan === recommendedPlan || meta.recommended;
            const isDowngrade =
              getPlanLevel(plan) < getPlanLevel(currentPlan);

            return (
              <div
                key={plan}
                className={[
                  "relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all",
                  isRecommended
                    ? "border-slate-950 ring-2 ring-slate-950"
                    : "border-slate-200",
                  isCurrent ? "bg-slate-50" : "hover:-translate-y-0.5 hover:shadow-md",
                ].join(" ")}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-5">
                    <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                      Mais recomendado
                    </Badge>
                  </div>
                )}

                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-950">
                        {meta.name}
                      </h3>

                      {plan === "premium" && (
                        <Crown className="h-4 w-4 text-amber-500" />
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {meta.tagline}
                    </p>
                  </div>

                  {isCurrent && (
                    <Badge variant="secondary" className="whitespace-nowrap">
                      Atual
                    </Badge>
                  )}
                </div>

                <div className="mb-1 flex items-end gap-1">
                  <span className="text-3xl font-bold tracking-tight text-slate-950">
                    {meta.price}
                  </span>
                </div>

                {"description" in meta && (
                  <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                    {meta.description}
                  </p>
                )}

                <div className="my-5 h-px bg-slate-200" />

                <ul className="mb-6 flex-1 space-y-3 text-sm">
                  {PLAN_FEATURES[plan].map((featureText) => (
                    <li key={featureText} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </span>

                      <span className="leading-5 text-slate-700">
                        {featureText}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  disabled={isCurrent || loadingPlan !== null}
                  variant={isRecommended ? "default" : "outline"}
                  className={[
                    "w-full",
                    isRecommended
                      ? "bg-slate-950 text-white hover:bg-slate-800"
                      : "",
                  ].join(" ")}
                  onClick={() => handleSelect(plan)}
                >
                  {loadingPlan === plan ? (
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
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Escolher {meta.name}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-center text-xs leading-5 text-slate-500">
            Ambiente de testes: a seleção atualiza o plano no sistema, mas ainda
            não realiza cobrança real.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
