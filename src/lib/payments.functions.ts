import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({
      email: options.email,
      limit: 1,
    });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createPlanCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) {
        throw new Error("Invalid priceId");
      }
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const { userId, supabase } = context;

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? undefined;

      const prices = await stripe.prices.list({
        lookup_keys: [data.priceId],
      });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, {
        email,
        userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId },
        subscription_data: { metadata: { userId } },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv }) => data,
  )
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    try {
      const { supabase, userId } = context;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.stripe_customer_id) {
        return { error: "Nenhuma assinatura ativa encontrada." };
      }

      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// =====================================================================
// Add-on: 1 CNPJ/CPF (extra_entity_slot) — assinatura recorrente
// =====================================================================
type AddonCheckoutResult =
  | { url: string; mode: "checkout" | "portal" }
  | { error: string };

export const createExtraEntitySlotCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      quantity?: number;
      successUrl: string;
      cancelUrl: string;
      environment: StripeEnv;
    }) => {
      const q = data.quantity ?? 1;
      if (!Number.isInteger(q) || q < 1 || q > 20) {
        throw new Error("Quantidade inválida");
      }
      return { ...data, quantity: q };
    },
  )
  .handler(async ({ data, context }): Promise<AddonCheckoutResult> => {
    try {
      const { supabase, userId } = context;

      // Bloquear Free (Admin Master retorna 'max' via get_user_plan)
      const { data: planData, error: planErr } = await supabase.rpc(
        "get_user_plan",
        { p_user_id: userId },
      );
      if (planErr) return { error: planErr.message };
      const plan = (planData as string | null) ?? "free";
      if (plan === "free") {
        return {
          error:
            "Este add-on está disponível apenas para clientes pagantes.",
        };
      }

      const priceId = process.env.STRIPE_EXTRA_ENTITY_SLOT_PRICE_ID;
      if (!priceId) {
        return {
          error:
            "Add-on não configurado. Contate o suporte (STRIPE_EXTRA_ENTITY_SLOT_PRICE_ID).",
        };
      }

      const stripe = createStripeClient(data.environment);

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? undefined;
      const customerId = await resolveOrCreateCustomer(stripe, {
        email,
        userId,
      });

      // Se já tem add-on ativo, abrir o portal para ajustar quantidade
      const { data: existing } = await supabase
        .from("user_plan_addons")
        .select("stripe_subscription_id, status")
        .eq("user_id", userId)
        .eq("addon_key", "extra_entity_slot")
        .in("status", ["active", "trialing"])
        .limit(1)
        .maybeSingle();

      if (existing?.stripe_subscription_id) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: data.successUrl,
        });
        return { url: portal.url, mode: "portal" };
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: data.quantity,
            adjustable_quantity: { enabled: true, minimum: 1, maximum: 20 },
          },
        ],
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: { userId, addon_key: "extra_entity_slot" },
        subscription_data: {
          metadata: { userId, addon_key: "extra_entity_slot" },
        },
      });

      if (!session.url) return { error: "Stripe não retornou url" };
      return { url: session.url, mode: "checkout" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
