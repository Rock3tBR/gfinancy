import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { adminDeleteUser } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield,
  Loader2,
  RefreshCcw,
  Users,
  CreditCard,
  Receipt,
  Building2,
  Search,
  Crown,
  Trash2,
  RotateCcw,
  History,
  UserCheck,
  Activity,
  Mail,
  Database,
  CalendarClock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type AdminUser = {
  user_id: string;
  email: string | null;
  created_at: string;
  current_plan: string;
  is_manual_override: boolean;
  manual_override_plan: string | null;
  manual_override_reason: string | null;
  manual_override_starts_at: string | null;
  manual_override_ends_at: string | null;
  manual_override_active: boolean;
  entities_count: number;
  cards_count: number;
  transactions_count: number;
};

type DashboardSummary = {
  total_users: number;
  total_entities: number;
  total_cards: number;
  total_transactions: number;
  active_manual_overrides: number;
  users_free: number;
  users_pro: number;
  users_premium: number;
  users_max: number;
};

type AuditLog = {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  max: "Max",
};

const DARK_CARD =
  "border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]";

const DARK_INNER =
  "border-white/10 bg-white/[0.035] text-white";

const OUTLINE_BUTTON =
  "h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]";

const PRIMARY_BUTTON =
  "h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90";

function AdminPage() {
  const { isGlobalAdmin, isLoading, refetch } = useAdmin();

  if (isLoading) {
    return (
      <Card className={DARK_CARD}>
        <CardContent className="flex min-h-[260px] items-center justify-center p-6">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando permissão de Admin Master...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isGlobalAdmin) {
    return (
      <Card className="border-[#FF4D5E]/30 bg-[#FF4D5E]/10 text-white shadow-sm">
        <CardContent className="flex items-start gap-3 p-6">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#FF4D5E]" />

          <div>
            <h1 className="text-lg font-bold text-white">Acesso negado</h1>

            <p className="mt-1 text-sm leading-6 text-white/60">
              Você não possui permissão de Admin Master para acessar esta área.
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`mt-4 ${OUTLINE_BUTTON}`}
              onClick={() => refetch()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Verificar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-5">
      <section className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Badge className="h-10 rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 px-4 text-[#D9FF66] hover:bg-[#D9FF66]/10">
          <Shield className="mr-2 h-4 w-4" />
          Admin Master
        </Badge>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-10 rounded-full border border-white/10 bg-white/[0.045] p-1">
            <TabsTrigger
              value="users"
              className="h-8 rounded-full px-4 text-white/60 data-[state=active]:bg-[#D9FF66] data-[state=active]:text-[#1A1A1A]"
            >
              <Users className="mr-2 h-4 w-4" />
              Usuários
            </TabsTrigger>

            <TabsTrigger
              value="audit"
              className="h-8 rounded-full px-4 text-white/60 data-[state=active]:bg-[#D9FF66] data-[state=active]:text-[#1A1A1A]"
            >
              <History className="mr-2 h-4 w-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="outline"
          className={OUTLINE_BUTTON}
          onClick={() => setRefreshKey((current) => current + 1)}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </section>

      <SummarySection refreshKey={refreshKey} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsContent value="users" className="m-0">
          <UsersSection refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="audit" className="m-0">
          <AuditSection refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummarySection({ refreshKey }: { refreshKey: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-summary", refreshKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "admin_dashboard_summary",
      );

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      return row as DashboardSummary;
    },
  });

  const manualCount = data?.active_manual_overrides ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        icon={Users}
        title="Usuários"
        value={isLoading ? "…" : String(data?.total_users ?? 0)}
        hint={
          data
            ? `${data.users_free} free · ${data.users_pro} pro · ${data.users_premium} premium · ${data.users_max} max`
            : "Carregando..."
        }
        tone="primary"
      />

      <MetricCard
        icon={Building2}
        title="Entidades"
        value={isLoading ? "…" : String(data?.total_entities ?? 0)}
        hint="CPF, CNPJ e carteiras"
        tone="secondary"
      />

      <MetricCard
        icon={CreditCard}
        title="Cartões"
        value={isLoading ? "…" : String(data?.total_cards ?? 0)}
        hint="Cartões cadastrados"
        tone="neutral"
      />

      <MetricCard
        icon={Receipt}
        title="Transações"
        value={isLoading ? "…" : String(data?.total_transactions ?? 0)}
        hint="Movimentações totais"
        tone="success"
      />

      <MetricCard
        icon={Crown}
        title="Planos manuais"
        value={isLoading ? "…" : String(manualCount)}
        hint="Overrides ativos"
        tone="warning"
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  hint,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  hint?: string;
  tone: "primary" | "secondary" | "success" | "warning" | "neutral";
}) {
  const colors = {
    primary: "text-[#D9FF66] bg-[#D9FF66]/10 border-[#D9FF66]/20",
    secondary: "text-[#A88BFF] bg-[#A88BFF]/10 border-[#A88BFF]/20",
    success: "text-[#2ECC71] bg-[#2ECC71]/10 border-[#2ECC71]/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    neutral: "text-white/70 bg-white/[0.045] border-white/10",
  }[tone];

  return (
    <Card className={DARK_CARD}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/55">{title}</p>

          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-full border",
              colors,
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <p className="mt-3 text-3xl font-black text-white">{value}</p>

        {hint && <p className="mt-1 text-xs text-white/38">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function UsersSection({ refreshKey }: { refreshKey: number }) {
  const queryClient = useQueryClient();
  const deleteUserFn = useServerFn(adminDeleteUser);

  const [search, setSearch] = useState("");
  const [planModal, setPlanModal] = useState<AdminUser | null>(null);
  const [deleteModal, setDeleteModal] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-list-users", refreshKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_users");

      if (error) throw error;

      return (data ?? []) as AdminUser[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return users;

    return users.filter(
      (user) =>
        (user.email ?? "").toLowerCase().includes(q) ||
        user.user_id.toLowerCase().includes(q),
    );
  }, [users, search]);

  const disableOverride = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any).rpc(
        "admin_disable_plan_override",
        { target_user_id: userId },
      );

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Plano manual removido.");
      queryClient.invalidateQueries({ queryKey: ["admin-list-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-list-audit-logs"] });
    },

    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      await deleteUserFn({ data: { targetUserId } });
    },

    onSuccess: () => {
      toast.success("Conta excluída com sucesso.");
      setDeleteModal(null);
      queryClient.invalidateQueries({ queryKey: ["admin-list-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-list-audit-logs"] });
    },

    onError: (error: Error) => {
      toast.error(error.message || "Erro ao excluir conta.");
    },
  });

  return (
    <Card className={DARK_CARD}>
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
                <Users className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-lg font-black text-white">
                  Usuários da plataforma
                </h2>

                <p className="text-xs text-white/45">
                  {filtered.length} de {users.length} usuários exibidos
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/38" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por e-mail ou ID..."
                className="h-10 w-full rounded-full border-white/10 bg-white/[0.045] pl-9 text-white placeholder:text-white/35 sm:w-[290px]"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className={OUTLINE_BUTTON}
              onClick={() => refetch()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando usuários...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserCheck className="mx-auto h-8 w-8 text-white/32" />
            <p className="mt-3 text-sm font-bold text-white">
              Nenhum usuário encontrado
            </p>
            <p className="mt-1 text-xs text-white/45">
              Ajuste a busca para visualizar usuários.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((user) => (
              <div
                key={user.user_id}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/[0.025] xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-white/65">
                      <Mail className="h-4 w-4" />
                    </div>

                    <p className="truncate text-sm font-black text-white">
                      {user.email ?? "(sem e-mail)"}
                    </p>

                    <PlanBadge plan={user.current_plan} />

                    {user.is_manual_override && (
                      <Badge className="rounded-full border border-[#A88BFF]/20 bg-[#A88BFF]/10 text-[#A88BFF] hover:bg-[#A88BFF]/10">
                        <Crown className="mr-1 h-3 w-3" />
                        Plano manual
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1">
                      Criado em{" "}
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1">
                      {user.entities_count} entidades
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1">
                      {user.cards_count} cartões
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1">
                      {user.transactions_count} transações
                    </span>
                  </div>

                  {user.is_manual_override && user.manual_override_reason && (
                    <p className="mt-2 text-xs italic text-white/42">
                      Motivo: {user.manual_override_reason}
                      {user.manual_override_ends_at &&
                        ` · Expira em ${new Date(user.manual_override_ends_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className={OUTLINE_BUTTON}
                    onClick={() => setPlanModal(user)}
                  >
                    <Crown className="mr-1.5 h-4 w-4" />
                    Alterar plano
                  </Button>

                  {user.is_manual_override && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={OUTLINE_BUTTON}
                      disabled={disableOverride.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remover plano manual de ${user.email}?`,
                          )
                        ) {
                          disableOverride.mutate(user.user_id);
                        }
                      }}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Remover manual
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-full border-[#FF4D5E]/25 bg-[#FF4D5E]/10 px-5 font-bold text-[#FF4D5E] hover:border-[#FF4D5E]/40 hover:bg-[#FF4D5E]/15 hover:text-[#FF4D5E]"
                    onClick={() => setDeleteModal(user)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Apagar conta
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <PlanOverrideDialog
        user={planModal}
        onClose={() => setPlanModal(null)}
      />

      <DeleteUserDialog
        user={deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={(id) => deleteMutation.mutate(id)}
        loading={deleteMutation.isPending}
      />
    </Card>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const label = PLAN_LABELS[plan] ?? plan;

  const className =
    plan === "max"
      ? "border-[#D9FF66]/25 bg-[#D9FF66]/10 text-[#D9FF66]"
      : plan === "premium"
        ? "border-[#A88BFF]/25 bg-[#A88BFF]/10 text-[#A88BFF]"
        : plan === "pro"
          ? "border-[#3BA3FF]/25 bg-[#3BA3FF]/10 text-[#3BA3FF]"
          : "border-white/10 bg-white/[0.045] text-white/60";

  return (
    <Badge variant="outline" className={`rounded-full ${className}`}>
      {label}
    </Badge>
  );
}

function PlanOverrideDialog({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState("pro");
  const [reason, setReason] = useState("");
  const [durationMonths, setDurationMonths] = useState("3");
  const [neverExpires, setNeverExpires] = useState(false);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const months = Number(durationMonths);

      let endsAt: string | null = null;

      if (!neverExpires) {
        if (!Number.isFinite(months) || months <= 0) {
          throw new Error("Informe uma duração válida em meses.");
        }

        const date = new Date();
        date.setMonth(date.getMonth() + months);
        endsAt = date.toISOString();
      }

      const { error } = await (supabase as any).rpc(
        "admin_upsert_plan_override",
        {
          target_user_id: user.user_id,
          target_plan: plan,
          override_reason: reason || "Concedido pelo admin",
          override_ends_at: endsAt,
        },
      );

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Plano atualizado.");
      queryClient.invalidateQueries({ queryKey: ["admin-list-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-list-audit-logs"] });
      onClose();
    },

    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-[#1A1A1A] text-white">
        <DialogHeader>
          <DialogTitle>Alterar plano manualmente</DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-xs text-white/45">Usuário selecionado</p>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                {user.email}
                <PlanBadge plan={user.current_plan} />
              </div>
            </div>

            <div>
              <Label className="text-xs text-white/55">Novo plano</Label>

              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="mt-1 h-10 rounded-full border-white/10 bg-white/[0.045] px-4 text-white">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="max">Max</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-white/55">Motivo</Label>

              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex: cortesia, teste, parceria..."
                className="mt-1 h-10 rounded-full border-white/10 bg-white/[0.045] px-4 text-white placeholder:text-white/35"
              />
            </div>

            <div>
              <Label className="text-xs text-white/55">Duração</Label>

              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={durationMonths}
                  disabled={neverExpires}
                  onChange={(event) => setDurationMonths(event.target.value)}
                  className="h-10 w-28 rounded-full border-white/10 bg-white/[0.045] px-4 text-white"
                />

                <span className="text-sm text-white/55">meses</span>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-white/55">
                <input
                  type="checkbox"
                  checked={neverExpires}
                  onChange={(event) => setNeverExpires(event.target.checked)}
                />
                Sem prazo de expiração
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={OUTLINE_BUTTON}
                onClick={onClose}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={() => upsert.mutate()}
                disabled={upsert.isPending}
              >
                {upsert.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Aplicar plano"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  onClose,
  onConfirm,
  loading,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const email = user?.email ?? "";
  const canConfirm = confirmText.trim().toLowerCase() === email.toLowerCase();

  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmText("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md border-white/10 bg-[#1A1A1A] text-white">
        <DialogHeader>
          <DialogTitle className="text-[#FF4D5E]">Excluir conta</DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#FF4D5E]/20 bg-[#FF4D5E]/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF4D5E]" />

                <p className="text-sm leading-6 text-white/70">
                  Esta ação é <strong>irreversível</strong>. Todos os dados de{" "}
                  <strong>{user.email}</strong> serão apagados.
                </p>
              </div>
            </div>

            <div>
              <Label className="text-xs text-white/55">
                Para confirmar, digite o e-mail do usuário
              </Label>

              <Input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={email}
                className="mt-1 h-10 rounded-full border-white/10 bg-white/[0.045] px-4 text-white placeholder:text-white/35"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={OUTLINE_BUTTON}
                onClick={onClose}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                disabled={!canConfirm || loading}
                onClick={() => onConfirm(user.user_id)}
                className="h-10 rounded-full border border-[#FF4D5E]/25 bg-[#FF4D5E]/10 px-5 font-bold text-[#FF4D5E] hover:bg-[#FF4D5E]/15 hover:text-[#FF4D5E]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir definitivamente
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditSection({ refreshKey }: { refreshKey: number }) {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-list-audit-logs", refreshKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "admin_list_audit_logs",
        { limit_count: 200 },
      );

      if (error) throw error;

      return (data ?? []) as AuditLog[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return logs;

    return logs.filter((log) => {
      const metadata = log.metadata
        ? JSON.stringify(log.metadata).toLowerCase()
        : "";

      return (
        log.action.toLowerCase().includes(q) ||
        (log.admin_email ?? "").toLowerCase().includes(q) ||
        (log.target_email ?? "").toLowerCase().includes(q) ||
        log.admin_user_id.toLowerCase().includes(q) ||
        (log.target_user_id ?? "").toLowerCase().includes(q) ||
        metadata.includes(q)
      );
    });
  }, [logs, search]);

  return (
    <Card className={DARK_CARD}>
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#A88BFF]/20 bg-[#A88BFF]/10 text-[#A88BFF]">
              <History className="h-4 w-4" />
            </div>

            <div>
              <h2 className="text-lg font-black text-white">
                Logs de auditoria
              </h2>

              <p className="text-xs text-white/45">
                {filtered.length} de {logs.length} eventos exibidos
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/38" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ação, admin ou alvo..."
                className="h-10 w-full rounded-full border-white/10 bg-white/[0.045] pl-9 text-white placeholder:text-white/35 sm:w-[300px]"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className={OUTLINE_BUTTON}
              onClick={() => refetch()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando auditoria...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Database className="mx-auto h-8 w-8 text-white/32" />
            <p className="mt-3 text-sm font-bold text-white">
              Nenhum log encontrado
            </p>
            <p className="mt-1 text-xs text-white/45">
              Tente outra busca ou atualize a página.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((log) => (
              <details
                key={log.id}
                className="group p-5 transition-colors open:bg-white/[0.02] hover:bg-white/[0.025]"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66] hover:bg-[#D9FF66]/10">
                        <Activity className="mr-1 h-3 w-3" />
                        {log.action}
                      </Badge>

                      <span className="flex items-center gap-1 text-xs text-white/45">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-white/50">
                      Admin: {log.admin_email ?? log.admin_user_id}
                      {log.target_email && ` · Alvo: ${log.target_email}`}
                    </p>
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-bold text-white/45 group-open:text-[#D9FF66]">
                    Ver detalhes
                  </span>
                </summary>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 text-[11px] leading-relaxed text-white/55">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
