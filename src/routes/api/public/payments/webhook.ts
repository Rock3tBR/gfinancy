import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

type PlanTier = "free" | "pro" | "premium" | "max";

function priceToPlan(priceLookup: string | null | undefined): PlanTier | null {
  switch (priceLookup) {
    case "pro_monthly":
      return "pro";
    case "premium_monthly":
      return "premium";
    case "max_monthly":
      return "max";
    default:
      return null;
  }
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertFromSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("Webhook: missing userId in subscription metadata");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceLookup =
    item?.price?.lookup_key ??
    item?.price?.metadata?.lovable_external_id ??
    null;

  const status = subscription.status as string;
  const isActive =
    status === "active" || status === "trialing" || status === "past_due";
  const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;

  const mappedPlan = priceToPlan(priceLookup);
  const plan: PlanTier =
    isActive && mappedPlan ? mappedPlan : "free";

  const periodStart =
    item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        status,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        price_id: priceLookup,
        current_period_start: isoFromUnix(periodStart),
        current_period_end: isoFromUnix(periodEnd),
        cancel_at_period_end: cancelAtPeriodEnd,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: "free",
        status: "canceled",
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        cancel_at_period_end: false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
}

async function handleAddonSubscription(subscription: any, env: StripeEnv) {
  const addonPriceId = process.env.STRIPE_EXTRA_ENTITY_SLOT_PRICE_ID;
  if (!addonPriceId) return;

  const items: any[] = subscription.items?.data ?? [];
  const addonItem = items.find((it) => it?.price?.id === addonPriceId);
  if (!addonItem) return;

  const userId =
    subscription.metadata?.userId ?? addonItem?.metadata?.userId ?? null;
  if (!userId) {
    console.error("Addon webhook: missing userId in metadata");
    return;
  }

  const status = subscription.status as string;
  const periodStart =
    addonItem?.current_period_start ?? subscription.current_period_start;
  const periodEnd =
    addonItem?.current_period_end ?? subscription.current_period_end;

  await getSupabase()
    .from("user_plan_addons")
    .upsert(
      {
        user_id: userId,
        addon_key: "extra_entity_slot",
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: addonItem.id,
        stripe_price_id: addonPriceId,
        quantity: addonItem.quantity ?? 1,
        status,
        current_period_start: isoFromUnix(periodStart),
        current_period_end: isoFromUnix(periodEnd),
        cancel_at_period_end: subscription.cancel_at_period_end === true,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_item_id" },
    );
}

async function handleAddonSubscriptionDeleted(
  subscription: any,
  _env: StripeEnv,
) {
  await getSupabase()
    .from("user_plan_addons")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

function isAddonSubscription(subscription: any): boolean {
  const addonPriceId = process.env.STRIPE_EXTRA_ENTITY_SLOT_PRICE_ID;
  if (!addonPriceId) return false;
  const items: any[] = subscription.items?.data ?? [];
  return items.some((it) => it?.price?.id === addonPriceId);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      if (isAddonSubscription(sub)) {
        await handleAddonSubscription(sub, env);
      } else {
        await upsertFromSubscription(sub, env);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      if (isAddonSubscription(sub)) {
        await handleAddonSubscriptionDeleted(sub, env);
      } else {
        await handleSubscriptionDeleted(sub, env);
      }
      break;
    }
    default:
      break;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook: invalid env parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
