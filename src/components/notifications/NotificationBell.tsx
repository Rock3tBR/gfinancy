import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  type FinancialNotification,
  type NotificationLevel,
} from "@/hooks/use-notifications";

type LevelConfig = {
  icon: typeof Info;
  label: string;
  iconClassName: string;
  borderClassName: string;
};

const LEVEL_CONFIG: Record<NotificationLevel, LevelConfig> = {
  info: {
    icon: Info,
    label: "Informação",
    iconClassName: "bg-blue-500/10 text-blue-500",
    borderClassName: "before:bg-blue-500",
  },

  success: {
    icon: Check,
    label: "Sucesso",
    iconClassName: "bg-emerald-500/10 text-emerald-500",
    borderClassName: "before:bg-emerald-500",
  },

  warning: {
    icon: AlertTriangle,
    label: "Atenção",
    iconClassName: "bg-amber-500/10 text-amber-500",
    borderClassName: "before:bg-amber-500",
  },

  critical: {
    icon: CircleAlert,
    label: "Crítico",
    iconClassName: "bg-red-500/10 text-red-500",
    borderClassName: "before:bg-red-500",
  },
};

function formatRelativeDate(value: string) {
  const createdAt = new Date(value);
  const now = new Date();

  const diffMinutes = Math.floor(
    (now.getTime() - createdAt.getTime()) / 60000,
  );

  if (diffMinutes < 1) {
    return "Agora";
  }

  if (diffMinutes < 60) {
    return `Há ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `Há ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return "Ontem";
  }

  if (diffDays < 7) {
    return `Há ${diffDays} dias`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(createdAt);
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotifications();

  async function handleOpenNotification(
    notification: FinancialNotification,
  ) {
    try {
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }

      if (notification.action_url) {
        setOpen(false);

        navigate({
          to: notification.action_url as any,
        });
      }
    } catch {
      toast.error("Não foi possível atualizar a notificação.");
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllAsRead();
    } catch {
      toast.error("Não foi possível marcar todas como lidas.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Notificações"
          aria-label={
            unreadCount > 0
              ? `Notificações: ${unreadCount} não lidas`
              : "Notificações"
          }
          className={cn(
            "relative flex h-10 w-10 items-center justify-center",
            "rounded-full border transition-all duration-200",
            "hover:-translate-y-0.5 hover:bg-white/[0.06]",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-primary/40",
          )}
          style={{
            borderColor: "var(--fp-border)",
            background: "var(--fp-surface)",
            color: "var(--fp-text)",
          }}
        >
          <Bell className="h-4 w-4" />

          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1",
                "flex h-5 min-w-5 items-center justify-center",
                "rounded-full px-1 text-[10px] font-black text-white",
              )}
              style={{
                background: "var(--fp-danger)",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        collisionPadding={16}
        className={cn(
          "w-[calc(100vw-32px)] max-w-[460px]",
          "overflow-hidden rounded-[28px] border p-0",
          "shadow-[0_28px_80px_rgba(0,0,0,0.45)]",
        )}
        style={{
          borderColor: "var(--fp-border)",
          background: "var(--fp-surface)",
          color: "var(--fp-text)",
        }}
      >
        {/* Cabeçalho */}
        <div
          className={cn(
            "flex items-center justify-between gap-4",
            "border-b px-6 py-5",
          )}
          style={{
            borderColor: "var(--fp-border)",
          }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight">
              Notificações
            </h2>

            <p
              className="mt-1 text-sm leading-none"
              style={{
                color: "var(--fp-muted)",
              }}
            >
              {unreadCount === 0
                ? "Nenhuma notificação nova"
                : `${unreadCount} não ${
                    unreadCount === 1 ? "lida" : "lidas"
                  }`}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={isMarkingAllRead}
              onClick={handleMarkAllAsRead}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2",
                "text-xs font-bold transition",
                "hover:bg-white/[0.06]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              style={{
                color: "var(--fp-primary)",
              }}
            >
              {isMarkingAllRead
                ? "Atualizando..."
                : "Marcar todas como lidas"}
            </button>
          )}
        </div>

        {/* Conteúdo */}
        <ScrollArea className="max-h-[min(560px,72vh)]">
          {isLoading ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{
                  color: "var(--fp-muted)",
                }}
              />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center px-8 py-10 text-center">
              <span
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: "var(--fp-surface-soft)",
                }}
              >
                <Bell
                  className="h-6 w-6"
                  style={{
                    color: "var(--fp-muted)",
                  }}
                />
              </span>

              <p className="text-sm font-black">
                Tudo tranquilo por aqui
              </p>

              <p
                className="mt-2 max-w-[280px] text-xs leading-5"
                style={{
                  color: "var(--fp-muted)",
                }}
              >
                Novos avisos de vencimentos, limites e orçamento
                aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 p-3">
              {notifications.map((notification) => {
                const config =
                  LEVEL_CONFIG[notification.level] ??
                  LEVEL_CONFIG.info;

                const Icon = config.icon;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() =>
                      handleOpenNotification(notification)
                    }
                    className={cn(
                      "group relative flex w-full items-start gap-3.5",
                      "overflow-hidden rounded-2xl border px-4 py-4",
                      "text-left transition-all duration-200",
                      "before:absolute before:bottom-0 before:left-0 before:top-0",
                      "before:w-1 before:rounded-l-2xl",
                      config.borderClassName,
                      "hover:-translate-y-0.5 hover:bg-white/[0.055]",
                      "hover:shadow-lg",
                      notification.is_read
                        ? "bg-transparent"
                        : "bg-white/[0.035]",
                    )}
                    style={{
                      borderColor: "var(--fp-border)",
                    }}
                  >
                    {/* Ícone */}
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center",
                        "rounded-2xl",
                        config.iconClassName,
                      )}
                      title={config.label}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    {/* Informações */}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black leading-5">
                            {notification.title}
                          </span>
                        </span>

                        {!notification.is_read && (
                          <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              background: "var(--fp-primary)",
                            }}
                          />
                        )}
                      </span>

                      <span
                        className="mt-1.5 block text-xs leading-5"
                        style={{
                          color: "var(--fp-muted)",
                        }}
                      >
                        {notification.description}
                      </span>

                      <span
                        className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold"
                        style={{
                          color: "var(--fp-muted-2)",
                        }}
                      >
                        <Clock3 className="h-3.5 w-3.5" />

                        {formatRelativeDate(notification.created_at)}
                      </span>
                    </span>

                    {/* Seta */}
                    {notification.action_url && (
                      <span className="flex self-center pl-1">
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            "group-hover:translate-x-0.5",
                          )}
                          style={{
                            color: "var(--fp-muted-2)",
                          }}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}