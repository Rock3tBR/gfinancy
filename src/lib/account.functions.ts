import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USER_TABLES = [
  "invoice_analysis_items",
  "invoice_analyses",
  "installments",
  "invoices",
  "transactions",
  "gastos_fixos",
  "recurring_expenses",
  "payment_schedule",
  "notifications",
  "custom_widgets",
  "home_profiles",
  "ui_preferences",
  "cards",
  "categories",
  "entity_members",
  "user_plan_addons",
  "subscriptions",
  "plan_overrides",
  "profiles",
] as const;

/**
 * LGPD Art. 18, VI — eliminação dos dados pessoais do titular.
 * Remove todos os dados do usuário autenticado e a própria conta.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    for (const table of USER_TABLES) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("user_id", userId);

      if (error) throw new Error(`${table}: ${error.message}`);
    }

    const { error: entErr } = await supabaseAdmin
      .from("financial_entities")
      .delete()
      .eq("owner_user_id", userId);

    if (entErr) throw new Error(`financial_entities: ${entErr.message}`);

    const { error: delErr } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
