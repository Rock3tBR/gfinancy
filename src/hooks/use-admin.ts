import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useAdmin() {
  const { user } = useAuth();

  const {
    data: isGlobalAdmin = false,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["is-global-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("is_global_admin");

      if (error) {
        console.error("Erro ao verificar Admin Master:", error);
        return false;
      }

      return Boolean(data);
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    isGlobalAdmin,
    isLoading,
    error,
    refetch,
  };
}