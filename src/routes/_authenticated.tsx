import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlanProvider, usePlan } from "@/hooks/use-plan";
import { useAdmin } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";
import { FinancialEntityProvider } from "@/hooks/use-financial-entity";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  Bell,
  ChevronDown,
  CreditCard,
  Crown,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Moon,
  Receipt,
  Search,
  Shield,
  Sun,
  Tag,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const PALETTE = {
  primary: "#D9FF66",
  secondary: "#A88BFF",
  tertiary: "#2ECC71",
  neutral: "#1A1A1A",
};

const DARK_THEME_VARS = {
  "--fp-primary": PALETTE.primary,
  "--fp-secondary": PALETTE.secondary,
  "--fp-tertiary": PALETTE.tertiary,
  "--fp-neutral": PALETTE.neutral,
  "--fp-bg": "#0F0F0F",
  "--fp-surface": "#1A1A1A",
  "--fp-surface-soft": "#202020",
  "--fp-elevated": "#232323",
  "--fp-text": "#F5F5F5",
  "--fp-muted": "rgba(245,245,245,0.58)",
  "--fp-muted-2": "rgba(245,245,245,0.38)",
  "--fp-border": "rgba(255,255,255,0.10)",
  "--fp-border-strong": "rgba(255,255,255,0.18)",
  "--fp-danger": "#FF4D5E",
  "--fp-info": "#3BA3FF",
};

const LIGHT_THEME_VARS = {
  "--fp-primary": PALETTE.primary,
  "--fp-secondary": PALETTE.secondary,
  "--fp-tertiary": PALETTE.tertiary,
  "--fp-neutral": PALETTE.neutral,
  "--fp-bg": "#F0EFED",
  "--fp-surface": "#FFFFFF",
  "--fp-surface-soft": "#F7F6F4",
  "--fp-elevated": "#FFFFFF",
  "--fp-text": "#1A1A1A",
  "--fp-muted": "rgba(26,26,26,0.58)",
  "--fp-muted-2": "rgba(26,26,26,0.38)",
  "--fp-border": "rgba(26,26,26,0.10)",
  "--fp-border-strong": "rgba(26,26,26,0.18)",
  "--fp-danger": "#C91F37",
  "--fp-info": "#2563EB",
};

type AppPlan = "free" | "pro" | "premium" | "max";

type AppRoute =
  | "/"
  | "/admin"
  | "/entidades"
  | "/cartoes"
  | "/faturas"
  | "/transacoes"
  | "/categorias"
  | "/widgets"
  | "/planos"
  | "/perfil";

type NavItem = {
  to: AppRoute;
  label: string;
  icon: ComponentType<{ className?: string }>;
  requiredPlans?: AppPlan[];
  menuOnly?: boolean;
};

const ALL_PLANS: AppPlan[] = ["free", "pro", "premium", "max"];

const BASE_NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Início",
    icon: LayoutDashboard,
    requiredPlans: ALL_PLANS,
  },
  {
    to: "/transacoes",
    label: "Transações",
    icon: Receipt,
    requiredPlans: ALL_PLANS,
  },
  {
    to: "/faturas",
    label: "Faturas",
    icon: FileText,
    requiredPlans: ALL_PLANS,
  },
  {
    to: "/cartoes",
    label: "Cartões",
    icon: CreditCard,
    requiredPlans: ALL_PLANS,
  },
  {
    to: "/entidades",
    label: "Entidades",
    icon: WalletCards,
    requiredPlans: ALL_PLANS,
    menuOnly: true,
  },
  {
    to: "/categorias",
    label: "Categorias",
    icon: Tag,
    requiredPlans: ALL_PLANS,
  },
  {
    to: "/widgets",
    label: "Widgets",
    icon: LayoutTemplate,
    requiredPlans: ALL_PLANS,
  },
];

const ADMIN_NAV_ITEM: NavItem = {
  to: "/admin",
  label: "Admin",
  icon: Shield,
  menuOnly: true,
};

function normalizePlan(plan: string): AppPlan {
  if (plan === "pro" || plan === "premium" || plan === "max") {
    return plan;
  }

  return "free";
}

function canAccessPath(
  pathname: string,
  plan: AppPlan,
  isGlobalAdmin: boolean
) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return isGlobalAdmin;
  }

  const matchedItem = BASE_NAV_ITEMS.find((item) => {
    if (item.to === "/") return pathname === "/";
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  });

  if (!matchedItem) return true;
  if (!matchedItem.requiredPlans) return true;

  return matchedItem.requiredPlans.includes(plan);
}

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          background: "var(--fp-bg, #0F0F0F)",
          color: "var(--fp-text, #F5F5F5)",
        }}
      >
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm shadow-2xl backdrop-blur">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <PlanProvider>
      <FinancialEntityProvider>
        <Shell />
      </FinancialEntityProvider>
    </PlanProvider>
  );
}

function Shell() {
  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const { user } = useAuth();
  const { plan, canUse } = usePlan();
  const { isGlobalAdmin, isLoading: adminLoading } = useAdmin();

  const currentPlan: AppPlan = isGlobalAdmin ? "max" : normalizePlan(plan);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const visibleBaseNavItems = useMemo(() => {
    return BASE_NAV_ITEMS.filter((item) => {
      if (!item.requiredPlans) return true;
      return item.requiredPlans.includes(currentPlan);
    });
  }, [currentPlan]);

  const allNavItems = useMemo(() => {
    if (adminLoading || !isGlobalAdmin) {
      return visibleBaseNavItems;
    }

    return [ADMIN_NAV_ITEM, ...visibleBaseNavItems];
  }, [adminLoading, isGlobalAdmin, visibleBaseNavItems]);

  const topNavItems = allNavItems.filter((item) => !item.menuOnly);
  const menuNavItems = allNavItems.filter((item) => item.menuOnly);

  useEffect(() => {
    if (adminLoading) return;

    const canAccess = canAccessPath(pathname, currentPlan, isGlobalAdmin);

    if (canAccess) return;

    toast("Seu plano atual não permite acessar essa área.");
    navigate({ to: "/planos" });
  }, [adminLoading, currentPlan, isGlobalAdmin, navigate, pathname]);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";

    const saved = window.localStorage.getItem("fintechpro-theme");

    if (saved === "dark" || saved === "light") return saved;

    return "dark";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const vars = theme === "dark" ? DARK_THEME_VARS : LIGHT_THEME_VARS;

    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.classList.toggle("dark", theme === "dark");

    if (typeof window !== "undefined") {
      window.localStorage.setItem("fintechpro-theme", theme);
    }
  }, [theme]);

  function isRouteActive(to: AppRoute) {
    if (to === "/") return pathname === "/";

    return pathname === to || pathname.startsWith(`${to}/`);
  }

  function handleGlobalSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const query = globalSearch.trim();

    if (!query) {
      setSearchOpen(false);
      return;
    }

    navigate({
      to: "/transacoes",
      search: {
        q: query,
      } as any,
    });

    setSearchOpen(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Eduardo";

  const avatarInitial = userName.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div
      className="min-h-screen min-w-0 overflow-x-clip font-sans"
      style={{
        background: "var(--fp-bg)",
        color: "var(--fp-text)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-[-14rem] top-[-14rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--fp-primary) 14%, transparent)" }}
        />
        <div
          className="absolute right-[-18rem] top-20 h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--fp-secondary) 12%, transparent)" }}
        />
        <div
          className="absolute bottom-[-18rem] left-1/2 h-[34rem] w-[34rem] rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--fp-tertiary) 10%, transparent)" }}
        />
      </div>

      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--fp-border)",
          background: "color-mix(in srgb, var(--fp-bg) 92%, transparent)",
        }}
      >
        <div className="ge-app-header-inner mx-auto flex min-h-[72px] max-w-[1800px] items-center gap-4 px-4 py-3 lg:px-7">
          <Link
            to="/"
            className="ge-app-brand mr-2 shrink-0 text-lg font-black tracking-tight"
            style={{ color: "var(--fp-primary)" }}
          >
            GFINANCY
          </Link>

          <nav className="ge-app-header-nav flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {topNavItems.map((item) => {
              const active = isRouteActive(item.to);
              const Icon = item.icon;

              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  className={cn(
                    "group inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition",
                    active
                      ? "shadow-[0_0_24px_rgba(217,255,102,0.22)]"
                      : "hover:bg-white/[0.06]"
                  )}
                  style={{
                    color: active ? "var(--fp-neutral)" : "var(--fp-muted)",
                    background: active ? "var(--fp-primary)" : "transparent",
                  }}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[#1A1A1A]" : "opacity-70 group-hover:opacity-100"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ge-app-header-actions ml-auto flex shrink-0 items-center gap-2">
            <HeaderSearch
              isOpen={searchOpen}
              value={globalSearch}
              onOpen={() => setSearchOpen(true)}
              onClose={() => {
                setSearchOpen(false);
                setGlobalSearch("");
              }}
              onChange={setGlobalSearch}
              onSubmit={handleGlobalSearch}
            />

            {canUse("dueDateAlerts") ? (
              <NotificationBell />
            ) : (
              <button
                type="button"
                title="Alertas disponíveis no Plano Pro"
                onClick={() => navigate({ to: "/planos" })}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border transition hover:-translate-y-0.5"
                style={{
                  borderColor: "var(--fp-border)",
                  background: "var(--fp-surface)",
                  color: "var(--fp-muted)",
                }}
              >
                <Bell className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              title="Planos"
              className="flex h-10 w-10 items-center justify-center rounded-full border transition hover:-translate-y-0.5"
              style={{
                borderColor:
                  pathname === "/planos"
                    ? "var(--fp-primary)"
                    : "color-mix(in srgb, var(--fp-primary) 50%, transparent)",
                background:
                  pathname === "/planos"
                    ? "var(--fp-primary)"
                    : "color-mix(in srgb, var(--fp-primary) 12%, transparent)",
                color:
                  pathname === "/planos" ? "var(--fp-neutral)" : "var(--fp-primary)",
                boxShadow:
                  "0 0 22px color-mix(in srgb, var(--fp-primary) 28%, transparent)",
              }}
              onClick={() => navigate({ to: "/planos" })}
            >
              <Crown className="h-4 w-4" />
            </button>

{/*             <HeaderIconButton
              title="Tema"
              icon={
                theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              }
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            /> */}

            <div className="relative">
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-full border px-2 pl-1.5 pr-3 transition hover:bg-white/[0.06]"
                style={{
                  borderColor: "var(--fp-border)",
                  background: "var(--fp-surface)",
                  color: "var(--fp-text)",
                }}
                onClick={() => setUserMenuOpen((current) => !current)}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
                  style={{
                    background: `linear-gradient(135deg, ${PALETTE.secondary}, #5B21B6)`,
                  }}
                >
                  {avatarInitial}
                </span>

                <span className="hidden max-w-[120px] truncate text-sm font-bold md:inline">
                  {userName}
                </span>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    userMenuOpen ? "rotate-180" : "rotate-0"
                  )}
                  style={{ color: "var(--fp-muted)" }}
                />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border p-2 shadow-2xl"
                  style={{
                    borderColor: "var(--fp-border)",
                    background: "var(--fp-surface)",
                    color: "var(--fp-text)",
                  }}
                >
                  <MenuLink
                    to="/perfil"
                    icon={<UserRound className="h-4 w-4" />}
                    label="Meu perfil"
                    onClick={() => setUserMenuOpen(false)}
                  />

                  {menuNavItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <MenuLink
                        key={item.to}
                        to={item.to}
                        icon={<Icon className="h-4 w-4" />}
                        label={item.label}
                        onClick={() => setUserMenuOpen(false)}
                      />
                    );
                  })}

                  <div
                    className="my-2 h-px"
                    style={{ background: "var(--fp-border)" }}
                  />

                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition hover:bg-white/[0.06]"
                    style={{ color: "var(--fp-danger)" }}
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="ge-app-main relative z-10 mx-auto min-w-0 max-w-[1800px] px-4 py-6 lg:px-7">
        <Outlet />
      </main>

      <MobileBottomNav
        items={topNavItems}
        isActive={isRouteActive}
        onNavigate={(to) => navigate({ to: to as any })}
      />
    </div>
  );
}

function MobileBottomNav({
  items,
  isActive,
  onNavigate,
}: {
  items: NavItem[];
  isActive: (to: AppRoute) => boolean;
  onNavigate: (to: AppRoute) => void;
}) {
  const shown = items.slice(0, 5);
  return (
    <nav
      className="ge-mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 hidden border-t backdrop-blur-xl"
      style={{
        borderColor: "var(--fp-border)",
        background: "color-mix(in srgb, var(--fp-bg) 94%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto grid max-w-[540px] grid-cols-5">
        {shown.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => onNavigate(item.to)}
                className="flex w-full flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition"
                style={{
                  color: active ? "var(--fp-primary)" : "var(--fp-muted)",
                }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-2xl transition"
                  style={{
                    background: active
                      ? "color-mix(in srgb, var(--fp-primary) 18%, transparent)"
                      : "transparent",
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="max-w-[68px] truncate leading-none">
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HeaderSearch({
  isOpen,
  value,
  onOpen,
  onClose,
  onChange,
  onSubmit,
}: {
  isOpen: boolean;
  value: string;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return (
      <button
        type="button"
        title="Buscar"
        className="flex h-10 w-10 items-center justify-center rounded-full border transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
        style={{
          borderColor: "var(--fp-border)",
          background: "var(--fp-surface)",
          color: "var(--fp-muted)",
        }}
        onClick={onOpen}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex h-10 w-[320px] max-w-[42vw] items-center rounded-full border px-3 transition-all duration-300"
      style={{
        borderColor: "var(--fp-border)",
        background: "var(--fp-surface)",
        color: "var(--fp-text)",
      }}
    >
      <Search className="mr-2 h-4 w-4 shrink-0" style={{ color: "var(--fp-muted)" }} />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar transações, categorias..."
        autoFocus
        className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-white/35"
        style={{ color: "var(--fp-text)" }}
      />

      {value && (
        <button
          type="button"
          className="ml-2 flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/[0.06]"
          style={{ color: "var(--fp-muted)" }}
          onClick={() => onChange("")}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/[0.06]"
        style={{ color: "var(--fp-muted)" }}
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

function HeaderIconButton({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={title}
      onClick={onClick}
      className="h-10 w-10 rounded-full border transition hover:-translate-y-0.5"
      style={{
        borderColor: "var(--fp-border)",
        background: "var(--fp-surface)",
        color: "var(--fp-muted)",
      }}
    >
      {icon}
    </Button>
  );
}

function MenuLink({
  to,
  icon,
  label,
  onClick,
}: {
  to: AppRoute;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to as any}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition hover:bg-white/[0.06]"
      style={{ color: "var(--fp-text)" }}
    >
      {icon}
      {label}
    </Link>
  );
}
