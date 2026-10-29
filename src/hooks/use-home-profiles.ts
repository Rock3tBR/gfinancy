import { useEffect, useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type {
  DashboardLayouts,
  WidgetVisibility,
} from "@/components/home/EditableHomeDashboard";

export type HomeProfile = {
  id: string;
  userId: string;
  entityId: string;
  name: string;
  layouts: Partial<DashboardLayouts>;
  visibility: WidgetVisibility[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type HomeProfileRow = {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  layouts: Partial<DashboardLayouts> | null;
  visibility: WidgetVisibility[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UseHomeProfilesParams = {
  userId?: string | null;
  entityId?: string | null;
};

type SaveProfileInput = {
  profileId: string;
  layouts: DashboardLayouts;
  visibility: WidgetVisibility[];
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function mapProfile(row: HomeProfileRow): HomeProfile {
  return {
    id: row.id,
    userId: row.user_id,
    entityId: row.entity_id,
    name: row.name,
    layouts: row.layouts ?? {},
    visibility: Array.isArray(row.visibility)
      ? row.visibility
      : [],
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useHomeProfiles({
  userId,
  entityId,
}: UseHomeProfilesParams) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ["home-profiles", userId, entityId] as const,
    [entityId, userId],
  );

  const profilesQuery = useQuery({
    queryKey,
    enabled: Boolean(userId && entityId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("home_profiles")
        .select(
          "id,user_id,entity_id,name,layouts,visibility,is_active,created_at,updated_at",
        )
        .eq("user_id", userId)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as HomeProfileRow[]).map(
        mapProfile,
      );
    },
  });

  const ensureDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !entityId) {
        throw new Error(
          "Usuário ou entidade financeira não informado.",
        );
      }

      const { data, error } = await (supabase as any)
        .from("home_profiles")
        .insert({
          user_id: userId,
          entity_id: entityId,
          name: "Padrão",
          layouts: {},
          visibility: [],
          is_active: true,
        })
        .select(
          "id,user_id,entity_id,name,layouts,visibility,is_active,created_at,updated_at",
        )
        .single();

      if (error) {
        // Outra aba pode ter criado o perfil entre o select e o insert.
        if (
          String(error.code) === "23505" ||
          String(error.message).toLowerCase().includes("duplicate")
        ) {
          return null;
        }

        throw error;
      }

      return mapProfile(data as HomeProfileRow);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast.error(
        error.message ||
          "Não foi possível criar o perfil padrão.",
      );
    },
  });

  useEffect(() => {
    if (
      profilesQuery.isSuccess &&
      profilesQuery.data.length === 0 &&
      userId &&
      entityId &&
      !ensureDefaultMutation.isPending
    ) {
      ensureDefaultMutation.mutate();
    }
  }, [
    entityId,
    ensureDefaultMutation,
    profilesQuery.data,
    profilesQuery.isSuccess,
    userId,
  ]);

  const profiles = profilesQuery.data ?? [];

  const activeProfile =
    profiles.find((profile) => profile.isActive) ??
    profiles[0] ??
    null;

  function validateName(
    name: string,
    ignoredProfileId?: string,
  ) {
    const normalized = normalizeName(name);

    if (!normalized) {
      throw new Error("Informe um nome para o perfil.");
    }

    if (normalized.length > 50) {
      throw new Error(
        "O nome deve ter no máximo 50 caracteres.",
      );
    }

    const duplicated = profiles.some(
      (profile) =>
        profile.id !== ignoredProfileId &&
        profile.name.toLocaleLowerCase("pt-BR") ===
          normalized.toLocaleLowerCase("pt-BR"),
    );

    if (duplicated) {
      throw new Error("Já existe um perfil com esse nome.");
    }

    return normalized;
  }

  const activateMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await (supabase as any).rpc(
        "activate_home_profile",
        {
          target_profile_id: profileId,
        },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast.error(
        error.message ||
          "Não foi possível ativar o perfil.",
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!userId || !entityId) {
        throw new Error(
          "Usuário ou entidade financeira não informado.",
        );
      }

      const normalizedName = validateName(name);

      const { data, error } = await (supabase as any)
        .from("home_profiles")
        .insert({
          user_id: userId,
          entity_id: entityId,
          name: normalizedName,
          layouts: {},
          visibility: [],
          is_active: false,
        })
        .select(
          "id,user_id,entity_id,name,layouts,visibility,is_active,created_at,updated_at",
        )
        .single();

      if (error) throw error;

      const profile = mapProfile(data as HomeProfileRow);

      const { error: activateError } = await (
        supabase as any
      ).rpc("activate_home_profile", {
        target_profile_id: profile.id,
      });

      if (activateError) throw activateError;

      return profile;
    },
    onSuccess: async () => {
      toast.success("Perfil criado");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({
      profileId,
      name,
    }: {
      profileId: string;
      name: string;
    }) => {
      if (!userId || !entityId) {
        throw new Error(
          "Usuário ou entidade financeira não informado.",
        );
      }

      const source = profiles.find(
        (profile) => profile.id === profileId,
      );

      if (!source) {
        throw new Error("Perfil de origem não encontrado.");
      }

      const normalizedName = validateName(name);

      const { data, error } = await (supabase as any)
        .from("home_profiles")
        .insert({
          user_id: userId,
          entity_id: entityId,
          name: normalizedName,
          layouts: source.layouts,
          visibility: source.visibility,
          is_active: false,
        })
        .select(
          "id,user_id,entity_id,name,layouts,visibility,is_active,created_at,updated_at",
        )
        .single();

      if (error) throw error;

      const profile = mapProfile(data as HomeProfileRow);

      const { error: activateError } = await (
        supabase as any
      ).rpc("activate_home_profile", {
        target_profile_id: profile.id,
      });

      if (activateError) throw activateError;

      return profile;
    },
    onSuccess: async () => {
      toast.success("Perfil duplicado");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({
      profileId,
      name,
    }: {
      profileId: string;
      name: string;
    }) => {
      const normalizedName = validateName(
        name,
        profileId,
      );

      const { error } = await (supabase as any)
        .from("home_profiles")
        .update({ name: normalizedName })
        .eq("id", profileId)
        .eq("user_id", userId)
        .eq("entity_id", entityId);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Perfil renomeado");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      profileId,
      layouts,
      visibility,
    }: SaveProfileInput) => {
      const { error } = await (supabase as any)
        .from("home_profiles")
        .update({
          layouts,
          visibility,
        })
        .eq("id", profileId)
        .eq("user_id", userId)
        .eq("entity_id", entityId);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Personalização salva");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      if (profiles.length <= 1) {
        throw new Error(
          "É necessário manter pelo menos um perfil.",
        );
      }

      const profile = profiles.find(
        (item) => item.id === profileId,
      );

      if (!profile) {
        throw new Error("Perfil não encontrado.");
      }

      const replacement = profiles.find(
        (item) => item.id !== profileId,
      );

      if (!replacement) {
        throw new Error(
          "Não foi possível escolher outro perfil.",
        );
      }

      if (profile.isActive) {
        const { error: activateError } = await (
          supabase as any
        ).rpc("activate_home_profile", {
          target_profile_id: replacement.id,
        });

        if (activateError) throw activateError;
      }

      const { error } = await (supabase as any)
        .from("home_profiles")
        .delete()
        .eq("id", profileId)
        .eq("user_id", userId)
        .eq("entity_id", entityId);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Perfil excluído");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const isMutating =
    activateMutation.isPending ||
    createMutation.isPending ||
    duplicateMutation.isPending ||
    renameMutation.isPending ||
    saveMutation.isPending ||
    deleteMutation.isPending ||
    ensureDefaultMutation.isPending;

  return {
    profiles,
    activeProfile,
    activeProfileId: activeProfile?.id ?? "",
    isLoading:
      profilesQuery.isLoading ||
      ensureDefaultMutation.isPending,
    isError: profilesQuery.isError,
    error: profilesQuery.error,
    isMutating,
    isSaving: saveMutation.isPending,

    selectProfile: async (profileId: string) => {
      await activateMutation.mutateAsync(profileId);
    },

    createProfile: async (name: string) => {
      await createMutation.mutateAsync(name);
    },

    duplicateProfile: async (
      profileId: string,
      name: string,
    ) => {
      await duplicateMutation.mutateAsync({
        profileId,
        name,
      });
    },

    renameProfile: async (
      profileId: string,
      name: string,
    ) => {
      await renameMutation.mutateAsync({
        profileId,
        name,
      });
    },

    deleteProfile: async (profileId: string) => {
      await deleteMutation.mutateAsync(profileId);
    },

    saveProfile: async (input: SaveProfileInput) => {
      await saveMutation.mutateAsync(input);
    },

    refetch: profilesQuery.refetch,
  };
}
