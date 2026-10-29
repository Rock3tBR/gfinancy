import { useMemo, useState } from "react";
import {
  Copy,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  HomeProfileDialog,
  type HomeProfileDialogMode,
} from "@/components/home/HomeProfileDialog";

export type HomeProfileSummary = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

type HomeProfileSelectorProps = {
  profiles: HomeProfileSummary[];
  activeProfileId: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;

  onSelectProfile: (
    profileId: string,
  ) => void | Promise<void>;

  onCreateProfile: (
    name: string,
  ) => void | Promise<void>;

  onDuplicateProfile: (
    profileId: string,
    name: string,
  ) => void | Promise<void>;

  onRenameProfile: (
    profileId: string,
    name: string,
  ) => void | Promise<void>;

  onDeleteProfile: (
    profileId: string,
  ) => void | Promise<void>;
};

type DialogState = {
  open: boolean;
  mode: HomeProfileDialogMode;
};

const INITIAL_DIALOG_STATE: DialogState = {
  open: false,
  mode: "create",
};

export function HomeProfileSelector({
  profiles,
  activeProfileId,
  disabled = false,
  className,
  compact = false,
  onSelectProfile,
  onCreateProfile,
  onDuplicateProfile,
  onRenameProfile,
  onDeleteProfile,
}: HomeProfileSelectorProps) {
  const [dialogState, setDialogState] =
    useState<DialogState>(
      INITIAL_DIALOG_STATE,
    );

  const activeProfile = useMemo(
    () =>
      profiles.find(
        (profile) =>
          profile.id === activeProfileId,
      ) ?? profiles[0],
    [activeProfileId, profiles],
  );

  const canDelete = profiles.length > 1;

  function openDialog(
    mode: HomeProfileDialogMode,
  ) {
    setDialogState({
      open: true,
      mode,
    });
  }

  async function handleConfirm(
    name?: string,
  ) {
    if (
      !activeProfile &&
      dialogState.mode !== "create"
    ) {
      return;
    }

    if (dialogState.mode === "create") {
      if (!name) return;
      await onCreateProfile(name);
      return;
    }

    if (
      dialogState.mode === "duplicate"
    ) {
      if (!name || !activeProfile) return;

      await onDuplicateProfile(
        activeProfile.id,
        name,
      );
      return;
    }

    if (dialogState.mode === "rename") {
      if (!name || !activeProfile) return;

      await onRenameProfile(
        activeProfile.id,
        name,
      );
      return;
    }

    if (dialogState.mode === "delete") {
      if (!activeProfile) return;

      await onDeleteProfile(
        activeProfile.id,
      );
    }
  }

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-nowrap items-center gap-2",
          compact && "gap-1.5",
          className,
        )}
      >
        <Select
          value={activeProfile?.id ?? ""}
          onValueChange={(value) => {
            void onSelectProfile(value);
          }}
          disabled={
            disabled || profiles.length === 0
          }
        >
          <SelectTrigger
            className={cn(
              "rounded-full border-white/10 bg-white/[0.045] px-4 font-bold text-white shadow-none transition hover:border-[#D9FF66]/30 hover:bg-white/[0.06] focus:ring-[#D9FF66]/20",
              compact
                ? "h-9 w-auto min-w-0 px-3 text-xs"
                : "h-10 w-[170px] min-w-[170px] sm:w-[185px] sm:min-w-[185px]",
            )}
          >
            <SelectValue placeholder="Perfil da Home" />
          </SelectTrigger>

          <SelectContent>
            {profiles.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum perfil cadastrado.
              </div>
            ) : (
              profiles.map((profile) => (
                <SelectItem
                  key={profile.id}
                  value={profile.id}
                >
                  {profile.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Criar perfil"
          aria-label="Criar perfil"
          onClick={() =>
            openDialog("create")
          }
          disabled={disabled}
          className={cn(
            "rounded-full border-white/10 bg-white/[0.045] text-white/70 transition hover:border-[#D9FF66]/40 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <Plus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Duplicar perfil"
          aria-label="Duplicar perfil"
          onClick={() =>
            openDialog("duplicate")
          }
          disabled={
            disabled || !activeProfile
          }
          className={cn(
            "rounded-full border-white/10 bg-white/[0.045] text-white/70 transition hover:border-[#D9FF66]/40 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <Copy className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Renomear perfil"
          aria-label="Renomear perfil"
          onClick={() =>
            openDialog("rename")
          }
          disabled={
            disabled || !activeProfile
          }
          className={cn(
            "rounded-full border-white/10 bg-white/[0.045] text-white/70 transition hover:border-[#D9FF66]/40 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <Pencil className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          title={
            canDelete
              ? "Excluir perfil"
              : "É necessário manter pelo menos um perfil"
          }
          aria-label="Excluir perfil"
          onClick={() =>
            openDialog("delete")
          }
          disabled={
            disabled ||
            !activeProfile ||
            !canDelete
          }
          className={cn(
            "rounded-full border-white/10 bg-white/[0.045] text-white/70 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400",
            compact ? "h-9 w-9" : "h-10 w-10",
          )}
        >
          <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </div>

      <HomeProfileDialog
        open={dialogState.open}
        mode={dialogState.mode}
        currentProfileName={
          activeProfile?.name
        }
        existingNames={profiles.map(
          (profile) => profile.name,
        )}
        onOpenChange={(open) => {
          setDialogState((current) => ({
            ...current,
            open,
          }));
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
