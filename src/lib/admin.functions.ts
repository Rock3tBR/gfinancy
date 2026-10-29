import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { targetUserId: string }) => {
    if (!data?.targetUserId || typeof data.targetUserId !== "string") {
      throw new Error("targetUserId é obrigatório.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is a global admin
    const { data: isAdmin, error: adminErr } = await supabase.rpc(
      "is_global_admin",
      { check_user_id: userId },
    );
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Acesso negado.");

    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir sua própria conta por aqui.");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(
      data.targetUserId,
    );
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_user_id: userId,
      target_user_id: data.targetUserId,
      action: "user_deleted",
      metadata: { deleted_at: new Date().toISOString() },
    });

    return { ok: true };
  });
