import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type HomeProfileDialogMode =
  | "create"
  | "duplicate"
  | "rename"
  | "delete";

type HomeProfileDialogProps = {
  open: boolean;
  mode: HomeProfileDialogMode;
  currentProfileName?: string;
  existingNames?: string[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (name?: string) => void | Promise<void>;
};

type DialogCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  inputLabel?: string;
  placeholder?: string;
};

const COPY: Record<HomeProfileDialogMode, DialogCopy> = {
  create: {
    title: "Criar perfil de Home",
    description:
      "Crie uma nova organização para os widgets da sua Home.",
    confirmLabel: "Criar perfil",
    inputLabel: "Nome do perfil",
    placeholder: "Ex.: Resumo mensal",
  },
  duplicate: {
    title: "Duplicar perfil",
    description:
      "Crie uma cópia do perfil atual mantendo posições, tamanhos e widgets visíveis.",
    confirmLabel: "Duplicar perfil",
    inputLabel: "Nome da cópia",
    placeholder: "Ex.: Padrão - cópia",
  },
  rename: {
    title: "Renomear perfil",
    description:
      "Altere apenas o nome. A organização atual será mantida.",
    confirmLabel: "Salvar nome",
    inputLabel: "Novo nome",
    placeholder: "Ex.: Cartões",
  },
  delete: {
    title: "Excluir perfil",
    description:
      "Esta ação remove definitivamente o perfil selecionado.",
    confirmLabel: "Excluir perfil",
  },
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function HomeProfileDialog({
  open,
  mode,
  currentProfileName,
  existingNames = [],
  onOpenChange,
  onConfirm,
}: HomeProfileDialogProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  const copy = COPY[mode];
  const requiresName = mode !== "delete";

  useEffect(() => {
    if (!open) return;

    setError(null);
    setIsSubmitting(false);

    if (mode === "rename") {
      setName(currentProfileName ?? "");
      return;
    }

    if (mode === "duplicate") {
      setName(
        currentProfileName
          ? `${currentProfileName} - cópia`
          : "",
      );
      return;
    }

    setName("");
  }, [currentProfileName, mode, open]);

  const normalizedExistingNames = useMemo(
    () =>
      existingNames.map((item) =>
        normalizeName(item).toLocaleLowerCase("pt-BR"),
      ),
    [existingNames],
  );

  function validateName() {
    const normalized = normalizeName(name);

    if (!normalized) {
      return "Informe um nome para o perfil.";
    }

    if (normalized.length > 50) {
      return "O nome deve ter no máximo 50 caracteres.";
    }

    const normalizedLower =
      normalized.toLocaleLowerCase("pt-BR");

    const currentLower = normalizeName(
      currentProfileName ?? "",
    ).toLocaleLowerCase("pt-BR");

    const nameAlreadyExists =
      normalizedExistingNames.includes(
        normalizedLower,
      );

    if (
      nameAlreadyExists &&
      !(
        mode === "rename" &&
        normalizedLower === currentLower
      )
    ) {
      return "Já existe um perfil com esse nome.";
    }

    return null;
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    if (requiresName) {
      const validationError = validateName();

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onConfirm(
        requiresName ? normalizeName(name) : undefined,
      );

      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const Icon =
    mode === "create"
      ? Plus
      : mode === "duplicate"
        ? Copy
        : mode === "rename"
          ? Pencil
          : Trash2;

  const isDelete = mode === "delete";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div
            className={[
              "mb-3 flex h-11 w-11 items-center justify-center rounded-2xl",
              isDelete
                ? "bg-red-500/10 text-red-400"
                : "bg-[#D9FF66]/10 text-[#D9FF66]",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />
          </div>

          <DialogTitle>{copy.title}</DialogTitle>

          <p className="text-sm leading-6 text-muted-foreground">
            {copy.description}
          </p>
        </DialogHeader>

        {isDelete ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm">
            <p className="font-semibold text-foreground">
              {currentProfileName
                ? `Perfil “${currentProfileName}”`
                : "Perfil selecionado"}
            </p>

            <p className="mt-1 leading-6 text-muted-foreground">
              O layout, os tamanhos e os widgets ocultos
              desse perfil serão removidos.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="home-profile-name">
              {copy.inputLabel}
            </Label>

            <Input
              id="home-profile-name"
              value={name}
              maxLength={50}
              autoFocus
              placeholder={copy.placeholder}
              disabled={isSubmitting}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />

            <div className="flex items-center justify-between gap-3">
              <span
                className={[
                  "text-xs",
                  error
                    ? "text-red-400"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {error ?? "Use um nome fácil de identificar."}
              </span>

              <span className="shrink-0 text-xs text-muted-foreground">
                {name.length}/50
              </span>
            </div>
          </div>
        )}

        {isDelete && error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
            className={
              isDelete
                ? "bg-red-500 font-bold text-white hover:bg-red-600"
                : "bg-[#D9FF66] font-black text-[#101411] hover:bg-[#caff3d]"
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              copy.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
