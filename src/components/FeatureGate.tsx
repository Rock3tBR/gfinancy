import type { ReactNode } from "react";
import { usePlan } from "@/hooks/use-plan";
import {
  FEATURE_LABELS,
  FEATURE_UPGRADE_COPY,
  PLAN_META,
  type BooleanFeature,
} from "@/lib/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, ArrowUpRight } from "lucide-react";

type FeatureGateProps = {
  feature: BooleanFeature;
  reason?: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function FeatureGate({
  feature,
  reason,
  children,
  fallback,
}: FeatureGateProps) {
  const { canUse, openUpgrade } = usePlan();

  if (canUse(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const upgradeCopy = FEATURE_UPGRADE_COPY[feature];
  const recommendedPlan = PLAN_META[upgradeCopy.recommendedPlan];

  const title = upgradeCopy.title;
  const description =
    reason ??
    upgradeCopy.description ??
    "Este recurso está disponível em planos pagos.";

  function handleUpgrade() {
    openUpgrade(description, feature);
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Lock className="h-6 w-6 text-slate-700" />
        </div>

        <div className="mx-auto mb-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {FEATURE_LABELS[feature]}
        </div>

        <h3 className="text-lg font-semibold text-slate-950">
          {title}
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={handleUpgrade}
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            Fazer upgrade para {recommendedPlan.name}
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleUpgrade}
          >
            Ver planos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
