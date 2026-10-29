import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialEntity } from "@/hooks/use-financial-entity";

export type NotificationLevel = "info" | "success" | "warning" | "critical";

export type FinancialNotification = {
  id: string;
  user_id: string;
  entity_id: string | null;
  type: string;
  level: NotificationLevel;
  title: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const { selectedEntityId } = useFinancialEntity();
  const queryClient = useQueryClient();

  const queryKey = ["notifications", user?.id, selectedEntityId] as const;

  const notificationsQuery = useQuery({
    queryKey,
    enabled: Boolean(user?.id),
    queryFn: async () => {
      let query = (supabase as any)
        .from("notifications")
        .select(
          "id,user_id,entity_id,type,level,title,description,reference_type,reference_id,action_url,is_read,read_at,expires_at,created_at"
        )
        .eq("user_id", user!.id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("is_read", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedEntityId) {
        query = query.or(`entity_id.eq.${selectedEntityId},entity_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as FinancialNotification[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      let query = (supabase as any)
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("is_read", false);

      if (selectedEntityId) {
        query = query.or(`entity_id.eq.${selectedEntityId},entity_id.is.null`);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return {
    notifications,
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    error: notificationsQuery.error,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingRead: markAsReadMutation.isPending,
    isMarkingAllRead: markAllAsReadMutation.isPending,
    refetch: notificationsQuery.refetch,
  };
}
