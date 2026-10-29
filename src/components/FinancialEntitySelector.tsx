import { Building2, UserRound } from "lucide-react";
import { useFinancialEntity } from "@/hooks/use-financial-entity";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export function FinancialEntitySelector() {
  const {
    entities,
    selectedEntityId,
    selectedEntity,
    setSelectedEntityId,
    isLoading,
  } = useFinancialEntity();

  if (isLoading) {
    return (
      <div className="h-10 w-full rounded-2xl border bg-muted/40 md:w-[260px]" />
    );
  }

  if (entities.length === 0) {
    return null;
  }

  const selectedLabel = selectedEntity
    ? getEntityLabel(selectedEntity)
    : {
        name: "Selecionar entidade",
        type: "",
      };

  return (
    <Select
      value={selectedEntityId ?? undefined}
      onValueChange={setSelectedEntityId}
    >
      <SelectTrigger className="h-10 w-full rounded-2xl md:w-[260px]">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {selectedEntity?.type === "cnpj" ? (
              <Building2 className="h-4 w-4" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{selectedLabel.name}</span>

            {selectedLabel.type && (
              <span className="shrink-0 text-xs uppercase text-muted-foreground">
                {selectedLabel.type}
              </span>
            )}
          </div>
        </div>
      </SelectTrigger>

      <SelectContent>
        {entities.map((entity) => {
          const label = getEntityLabel(entity);

          return (
            <SelectItem key={entity.id} value={entity.id}>
              <div className="flex items-center gap-2">
                {entity.type === "cnpj" ? (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                )}

                <span>{label.name}</span>

                <span className="text-xs uppercase text-muted-foreground">
                  {label.type}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function getEntityLabel(entity: {
  name: string | null;
  nickname?: string | null;
  type: string;
}) {
  return {
    name: entity.nickname || entity.name || "Sem nome",
    type: entity.type?.toUpperCase() || "",
  };
}