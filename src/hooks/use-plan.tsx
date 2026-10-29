import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  PLAN_CAPS,
  PLAN_PRICE_IDS,
  FEATURE_UPGRADE_COPY,
  canUseFeature,
  getPlanLimit,
  hasReachedLimit,
  type BooleanFeature,
  type LimitFeature,
  type Plan,
  type PlanCapabilities,
} from "@/lib/plans";
import { UpgradeModal } from "@/components/UpgradeModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { paymentsConfigured } from "@/lib/stripe";
import { toast } from "sonner";

type UpgradeState = {
  reason: string;
  feature?: BooleanFeature;
} | null;

type PlanContextValue = {
  plan: Plan;
  loading: boolean;
  caps: PlanCapabilities;

  canUse: (feature: BooleanFeature) => boolean;
  requireFeature: (
    feature: BooleanFeature,
    opts?: { reason?: string }
  ) => boolean;

  getLimit: (limit: LimitFeature) => number;
  reachedLimit: (limit: LimitFeature, currentValue: number) => boolean;

  setPlan: (plan: Plan) => Promise<void>;
  openUpgrade: (reason?: string, feature?: BooleanFeature) => void;
  startCheckout: (plan: Plan) => Promise<void>;
  openBillingPortal: () => Promise<void>;
};

const PlanCtx = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [upgradeState, setUpgradeState] = useState<UpgradeState>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Use RPC get_user_plan so admin master + manual overrides + Stripe are respected
      const { data: planData, error: planErr } = await (supabase as any).rpc(
        "get_user_plan",
        { p_user_id: user!.id }
      );
      if (planErr) throw planErr;

      const resolvedPlan = ((planData as string | null) ?? "free") as Plan;

      // Ensure a baseline subscription row exists (kept for legacy queries)
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!sub) {
        await supabase
          .from("subscriptions")
          .insert({ user_id: user!.id, plan: "free" });
      }

      return { plan: resolvedPlan };
    },
    staleTime: 1000 * 30,
  });

  const plan: Plan = data?.plan ?? "free";
  const caps = PLAN_CAPS[plan];

  const setPlanMutation = useMutation({
    mutationFn: async (newPlan: Plan) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase.from("subscriptions").upsert(
        { user_id: user.id, plan: newPlan },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["subscription", user?.id],
      });
      toast.success("Plano atualizado.");
      setUpgradeState(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar o plano.");
    },
  });

  const canUse = useCallback(
    (feature: BooleanFeature) => canUseFeature(plan, feature),
    [plan]
  );
  const getLimit = useCallback(
    (limit: LimitFeature) => getPlanLimit(plan, limit),
    [plan]
  );
  const reachedLimit = useCallback(
    (limit: LimitFeature, currentValue: number) =>
      hasReachedLimit(plan, limit, currentValue),
    [plan]
  );

  const openUpgrade = useCallback(
    (reason?: string, feature?: BooleanFeature) => {
      let finalReason = reason;
      if (!finalReason && feature) {
        finalReason = FEATURE_UPGRADE_COPY[feature].description;
      }
      setUpgradeState({
        reason:
          finalReason ??
          "Este recurso está disponível em planos pagos.",
        feature,
      });
    },
    []
  );

  const requireFeature = useCallback(
    (feature: BooleanFeature, opts?: { reason?: string }) => {
      if (canUse(feature)) return true;
      openUpgrade(opts?.reason, feature);
      return false;
    },
    [canUse, openUpgrade]
  );

  const setPlan = useCallback(
    async (newPlan: Plan) => {
      await setPlanMutation.mutateAsync(newPlan);
    },
    [setPlanMutation]
  );

  const openBillingPortal = useCallback(async () => {
    if (!paymentsConfigured()) {
      toast.error("Pagamentos ainda não configurados neste ambiente.");
      return;
    }
    try {
      const { createBillingPortalSession } = await import(
        "@/lib/payments.functions"
      );
      const { getStripeEnvironment } = await import("@/lib/stripe");
      const result = await createBillingPortalSession({
        data: {
          returnUrl: window.location.href,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // "Nenhuma assinatura ativa encontrada" vem do backend quando não existe
      // uma assinatura Stripe real associada ao usuário — normalmente porque
      // o plano atual foi concedido manualmente (admin master / override),
      // e não por uma compra de verdade. Nesse caso não existe cobrança para
      // gerenciar, então a mensagem padrão do Stripe só confundiria o usuário.
      if (message.includes("Nenhuma assinatura ativa")) {
        toast.error(
          "Seu plano atual não está vinculado a uma assinatura via cartão (foi concedido manualmente ou por acesso administrativo). Não há cobrança para gerenciar."
        );
        return;
      }
      toast.error(message || "Não foi possível abrir o portal.");
    }
  }, []);

  const startCheckout = useCallback(
    async (targetPlan: Plan) => {
      if (targetPlan === "free") {
        if (plan === "free") return;
        await openBillingPortal();
        return;
      }
      const priceId = PLAN_PRICE_IDS[targetPlan];
      if (!priceId) {
        toast.error("Plano indisponível.");
        return;
      }
      if (!paymentsConfigured()) {
        toast.error("Pagamentos ainda não configurados neste ambiente.");
        return;
      }
      setUpgradeState(null);
      setCheckoutPriceId(priceId);
    },
    [plan, openBillingPortal]
  );

  const contextValue: PlanContextValue = useMemo(
    () => ({
      plan,
      loading: isLoading,
      caps,
      canUse,
      requireFeature,
      getLimit,
      reachedLimit,
      setPlan,
      openUpgrade,
      startCheckout,
      openBillingPortal,
    }),
    [
      plan,
      isLoading,
      caps,
      canUse,
      requireFeature,
      getLimit,
      reachedLimit,
      setPlan,
      openUpgrade,
      startCheckout,
      openBillingPortal,
    ]
  );

  return (
    <PlanCtx.Provider value={contextValue}>
      {children}

      <UpgradeModal
        open={upgradeState !== null}
        reason={upgradeState?.reason ?? ""}
        feature={upgradeState?.feature}
        currentPlan={plan}
        onClose={() => setUpgradeState(null)}
        onSelect={async (selectedPlan) => {
          await startCheckout(selectedPlan);
        }}
      />

      <Dialog
        open={checkoutPriceId !== null}
        onOpenChange={(isOpen) => !isOpen && setCheckoutPriceId(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle>Assinatura do plano</DialogTitle>
          </DialogHeader>
          <div className="p-2">
            {checkoutPriceId && (
              <StripeEmbeddedCheckout
                priceId={checkoutPriceId}
                returnUrl={`${window.location.origin}/planos?checkout=success`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PlanCtx.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanCtx);
  if (!context) {
    throw new Error("usePlan deve estar dentro de PlanProvider");
  }
  return context;
}
