import {
  createFileRoute,
} from "@tanstack/react-router";
import {
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  Copy,
  Eye,
  FileText,
  Gauge,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useFinancialEntity,
} from "@/hooks/use-financial-entity";
import {
  FinancialEntitySelector,
} from "@/components/FinancialEntitySelector";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute(
  "/_authenticated/widgets",
)({
  component: WidgetsPage,
});

type WidgetType =
  | "kpi"
  | "progress"
  | "text"
  | "list";

type WidgetPeriod =
  | "current_month"
  | "last_30_days"
  | "current_year"
  | "all";

type WidgetAggregation =
  | "sum"
  | "count"
  | "average";

type WidgetConfig = {
  source?: "transactions" | "invoices" | "cards";
  aggregation?: WidgetAggregation;
  transactionType?: "all" | "entrada" | "debito" | "credito";
  category?: string;
  period?: WidgetPeriod;
  target?: number;
  value?: number;
  content?: string;
  items?: string[];
  prefix?: string;
  suffix?: string;
};

type CustomWidget = {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  description: string | null;
  widget_type: WidgetType;
  icon: string;
  color: string;
  config: WidgetConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type WidgetFormState = {
  name: string;
  description: string;
  widgetType: WidgetType;
  icon: string;
  color: string;
  source: "transactions" | "invoices" | "cards";
  aggregation: WidgetAggregation;
  transactionType: "all" | "entrada" | "debito" | "credito";
  category: string;
  period: WidgetPeriod;
  target: string;
  previewValue: string;
  content: string;
  listItems: string;
  prefix: string;
  suffix: string;
  isActive: boolean;
};

const EMPTY_FORM: WidgetFormState = {
  name: "",
  description: "",
  widgetType: "kpi",
  icon: "trending-up",
  color: "#D9FF66",
  source: "transactions",
  aggregation: "sum",
  transactionType: "all",
  category: "",
  period: "current_month",
  target: "5000",
  previewValue: "3250",
  content:
    "Use este espaço para escrever lembretes, observações ou uma mensagem importante.",
  listItems:
    "Revisar despesas do mês\nPagar fatura principal\nAtualizar meta de economia",
  prefix: "R$",
  suffix: "",
  isActive: true,
};

const TYPE_OPTIONS: Array<{
  value: WidgetType;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    value: "kpi",
    label: "Indicador",
    description: "Mostra um valor principal.",
    icon: TrendingUp,
  },
  {
    value: "progress",
    label: "Meta e progresso",
    description: "Mostra o avanço até uma meta.",
    icon: Target,
  },
  {
    value: "text",
    label: "Texto e lembrete",
    description: "Exibe uma mensagem personalizada.",
    icon: FileText,
  },
  {
    value: "list",
    label: "Lista",
    description: "Exibe tarefas ou itens rápidos.",
    icon: List,
  },
];

const ICON_OPTIONS = [
  {
    value: "trending-up",
    label: "Crescimento",
  },
  {
    value: "bar-chart",
    label: "Gráfico",
  },
  {
    value: "gauge",
    label: "Indicador",
  },
  {
    value: "target",
    label: "Meta",
  },
  {
    value: "sparkles",
    label: "Destaque",
  },
  {
    value: "list",
    label: "Lista",
  },
];

const PERIOD_OPTIONS: Array<{
  value: WidgetPeriod;
  label: string;
}> = [
  {
    value: "current_month",
    label: "Mês atual",
  },
  {
    value: "last_30_days",
    label: "Últimos 30 dias",
  },
  {
    value: "current_year",
    label: "Ano atual",
  },
  {
    value: "all",
    label: "Todo o período",
  },
];

const TYPE_LABELS: Record<WidgetType, string> = {
  kpi: "Indicador",
  progress: "Meta",
  text: "Texto",
  list: "Lista",
};

function parseNumber(value: string, fallback = 0) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function formatWidgetValue(
  value: number,
  prefix?: string,
  suffix?: string,
) {
  const formatted = value.toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );

  return [
    prefix?.trim(),
    formatted,
    suffix?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

function getWidgetIcon(
  icon: string,
) {
  if (icon === "bar-chart") return BarChart3;
  if (icon === "gauge") return Gauge;
  if (icon === "target") return Target;
  if (icon === "sparkles") return Sparkles;
  if (icon === "list") return List;

  return TrendingUp;
}

function formToConfig(
  form: WidgetFormState,
): WidgetConfig {
  if (form.widgetType === "text") {
    return {
      content: form.content.trim(),
    };
  }

  if (form.widgetType === "list") {
    return {
      items: form.listItems
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }


  const common: WidgetConfig = {
    source: form.source,
    aggregation: form.aggregation,
    transactionType: form.transactionType,
    category:
      form.category.trim() || undefined,
    period: form.period,
    value: parseNumber(
      form.previewValue,
      0,
    ),
    prefix: form.prefix.trim(),
    suffix: form.suffix.trim(),
  };

  if (form.widgetType === "progress") {
    common.target = parseNumber(
      form.target,
      0,
    );
  }

  return common;
}

function widgetToForm(
  widget: CustomWidget,
): WidgetFormState {
  return {
    name: widget.name,
    description: widget.description ?? "",
    widgetType: widget.widget_type,
    icon: widget.icon,
    color: widget.color,
    source:
      widget.config.source ??
      "transactions",
    aggregation:
      widget.config.aggregation ??
      "sum",
    transactionType:
      widget.config.transactionType ??
      "all",
    category:
      widget.config.category ?? "",
    period:
      widget.config.period ??
      "current_month",
    target: String(
      widget.config.target ?? 5000,
    ),
    previewValue: String(
      widget.config.value ?? 3250,
    ),
    content:
      widget.config.content ?? "",
    listItems:
      widget.config.items?.join("\n") ??
      "",
    prefix:
      widget.config.prefix ?? "R$",
    suffix:
      widget.config.suffix ?? "",
    isActive: widget.is_active,
  };
}

function WidgetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    selectedEntityId,
    selectedEntity,
    isLoading: entityLoading,
  } = useFinancialEntity();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<"all" | WidgetType>("all");

  const [formOpen, setFormOpen] =
    useState(false);

  const [previewOpen, setPreviewOpen] =
    useState(false);

  const [editingWidget, setEditingWidget] =
    useState<CustomWidget | null>(null);

  const [previewWidget, setPreviewWidget] =
    useState<CustomWidget | null>(null);

  const [form, setForm] =
    useState<WidgetFormState>(
      EMPTY_FORM,
    );

  const {
    data: widgets = [],
    isLoading,
  } = useQuery({
    queryKey: [
      "custom-widgets",
      user?.id,
      selectedEntityId,
    ],
    enabled:
      Boolean(user?.id) &&
      Boolean(selectedEntityId),
    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      )
        .from("custom_widgets")
        .select("*")
        .eq("user_id", user!.id)
        .eq(
          "entity_id",
          selectedEntityId,
        )
        .order(
          "updated_at",
          {
            ascending: false,
          },
        );

      if (error) throw error;

      return (
        (data ?? []) as CustomWidget[]
      ).map((widget) => ({
        ...widget,
        config:
          widget.config ?? {},
      }));
    },
  });

  const filteredWidgets = useMemo(() => {
    const normalizedSearch =
      search.trim().toLocaleLowerCase(
        "pt-BR",
      );

    return widgets.filter((widget) => {
      if (
        typeFilter !== "all" &&
        widget.widget_type !== typeFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        widget.name,
        widget.description ?? "",
        TYPE_LABELS[
          widget.widget_type
        ],
      ].some((value) =>
        value
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch),
      );
    });
  }, [
    search,
    typeFilter,
    widgets,
  ]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingWidget(null);
  }

  function openCreateDialog() {
    resetForm();
    setFormOpen(true);
  }

  function openEditDialog(
    widget: CustomWidget,
  ) {
    setEditingWidget(widget);
    setForm(widgetToForm(widget));
    setFormOpen(true);
  }

  function openPreview(
    widget: CustomWidget,
  ) {
    setPreviewWidget(widget);
    setPreviewOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error(
          "Usuário não autenticado.",
        );
      }

      if (!selectedEntityId) {
        throw new Error(
          "Selecione uma entidade financeira.",
        );
      }

      const name = form.name
        .trim()
        .replace(/\s+/g, " ");

      if (!name) {
        throw new Error(
          "Informe o nome do widget.",
        );
      }

      if (name.length > 60) {
        throw new Error(
          "O nome deve ter no máximo 60 caracteres.",
        );
      }

      if (
        !/^#[0-9A-Fa-f]{6}$/.test(
          form.color,
        )
      ) {
        throw new Error(
          "Escolha uma cor válida.",
        );
      }

      const payload = {
        user_id: user.id,
        entity_id: selectedEntityId,
        name,
        description:
          form.description.trim() ||
          null,
        widget_type: form.widgetType,
        icon: form.icon,
        color: form.color,
        config: formToConfig(form),
        is_active: form.isActive,
      };

      if (editingWidget) {
        const { error } = await (
          supabase as any
        )
          .from("custom_widgets")
          .update(payload)
          .eq("id", editingWidget.id)
          .eq("user_id", user.id)
          .eq(
            "entity_id",
            selectedEntityId,
          );

        if (error) throw error;

        return "updated";
      }

      const { error } = await (
        supabase as any
      )
        .from("custom_widgets")
        .insert(payload);

      if (error) throw error;

      return "created";
    },

    onSuccess: async (result) => {
      toast.success(
        result === "created"
          ? "Widget criado"
          : "Widget atualizado",
      );

      await queryClient.invalidateQueries({
        queryKey: [
          "custom-widgets",
          user?.id,
          selectedEntityId,
        ],
      });

      setFormOpen(false);
      resetForm();
    },

    onError: (error: Error) => {
      const message =
        error.message.includes(
          "custom_widgets_unique_name",
        ) ||
        error.message
          .toLowerCase()
          .includes("duplicate")
          ? "Já existe um widget com esse nome."
          : error.message;

      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (
      widget: CustomWidget,
    ) => {
      if (!user?.id) {
        throw new Error(
          "Usuário não autenticado.",
        );
      }

      const { error } = await (
        supabase as any
      )
        .from("custom_widgets")
        .delete()
        .eq("id", widget.id)
        .eq("user_id", user.id)
        .eq(
          "entity_id",
          selectedEntityId,
        );

      if (error) throw error;
    },

    onSuccess: async () => {
      toast.success("Widget excluído");

      await queryClient.invalidateQueries({
        queryKey: [
          "custom-widgets",
          user?.id,
          selectedEntityId,
        ],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (
      widget: CustomWidget,
    ) => {
      if (
        !user?.id ||
        !selectedEntityId
      ) {
        throw new Error(
          "Usuário ou entidade não informado.",
        );
      }

      const baseName =
        `${widget.name} - cópia`;

      let name = baseName;
      let counter = 2;

      while (
        widgets.some(
          (item) =>
            item.name.toLocaleLowerCase(
              "pt-BR",
            ) ===
            name.toLocaleLowerCase(
              "pt-BR",
            ),
        )
      ) {
        name =
          `${baseName} ${counter}`;
        counter += 1;
      }

      const { error } = await (
        supabase as any
      )
        .from("custom_widgets")
        .insert({
          user_id: user.id,
          entity_id:
            selectedEntityId,
          name,
          description:
            widget.description,
          widget_type:
            widget.widget_type,
          icon: widget.icon,
          color: widget.color,
          config: widget.config,
          is_active:
            widget.is_active,
        });

      if (error) throw error;
    },

    onSuccess: async () => {
      toast.success("Widget duplicado");

      await queryClient.invalidateQueries({
        queryKey: [
          "custom-widgets",
          user?.id,
          selectedEntityId,
        ],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (
      widget: CustomWidget,
    ) => {
      const { error } = await (
        supabase as any
      )
        .from("custom_widgets")
        .update({
          is_active:
            !widget.is_active,
        })
        .eq("id", widget.id)
        .eq("user_id", user?.id)
        .eq(
          "entity_id",
          selectedEntityId,
        );

      if (error) throw error;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "custom-widgets",
          user?.id,
          selectedEntityId,
        ],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (entityLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D9FF66]" />
      </div>
    );
  }

  if (
    !selectedEntityId ||
    !selectedEntity
  ) {
    return (
      <Card className="border-white/10 bg-[#1A1A1A]/88 text-white">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">
              Nenhuma entidade selecionada
            </h2>

            <p className="mt-1 text-sm text-white/55">
              Selecione uma entidade para
              administrar seus widgets.
            </p>
          </div>

          <div className="w-full sm:min-w-[260px] sm:w-auto">
            <FinancialEntitySelector />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-[260px]">
            <FinancialEntitySelector />
          </div>

          <Button
            type="button"
            onClick={openCreateDialog}
            className="h-10 rounded-full bg-[#D9FF66] px-5 font-black text-[#151515] hover:bg-[#caff3d]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo widget
          </Button>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/50">
          <LayoutGrid className="h-4 w-4 text-[#D9FF66]" />
          {widgets.length} widget
          {widgets.length === 1
            ? ""
            : "s"}{" "}
          criado
          {widgets.length === 1
            ? ""
            : "s"}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#1A1A1A]/88 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge
              variant="outline"
              className="border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]"
            >
              Construtor de widgets
            </Badge>

            <h1 className="mt-3 text-2xl font-black text-white">
              Widgets personalizados
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Crie indicadores, metas,
              lembretes e listas para usar
              nos seus perfis de Home.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Buscar widget..."
                className="h-11 rounded-full border-white/10 bg-white/[0.035] pl-11 text-white placeholder:text-white/30 sm:w-[230px]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(
                  value as
                    | "all"
                    | WidgetType,
                )
              }
            >
              <SelectTrigger className="h-11 rounded-full border-white/10 bg-white/[0.035] px-4 text-white sm:w-[210px]">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Todos os tipos
                </SelectItem>

                {TYPE_OPTIONS.map(
                  (type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#D9FF66]" />
        </div>
      ) : filteredWidgets.length === 0 ? (
        <EmptyWidgets
          hasWidgets={widgets.length > 0}
          onCreate={openCreateDialog}
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredWidgets.map(
            (widget) => (
              <WidgetLibraryCard
                key={widget.id}
                widget={widget}
                onPreview={() =>
                  openPreview(widget)
                }
                onEdit={() =>
                  openEditDialog(widget)
                }
                onDuplicate={() =>
                  duplicateMutation.mutate(
                    widget,
                  )
                }
                onToggle={() =>
                  toggleMutation.mutate(
                    widget,
                  )
                }
                onDelete={() => {
                  const confirmed =
                    window.confirm(
                      `Excluir o widget "${widget.name}"?`,
                    );

                  if (confirmed) {
                    deleteMutation.mutate(
                      widget,
                    );
                  }
                }}
              />
            ),
          )}
        </section>
      )}

      <WidgetFormDialog
        open={formOpen}
        editing={Boolean(editingWidget)}
        form={form}
        isSaving={saveMutation.isPending}
        onOpenChange={(open) => {
          setFormOpen(open);

          if (!open) {
            resetForm();
          }
        }}
        onChange={setForm}
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      />

      <Dialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-3xl overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#151515] text-white">
          <DialogHeader>
            <DialogTitle>
              Visualização do widget
            </DialogTitle>
          </DialogHeader>

          {previewWidget && (
            <div className="py-4">
              <WidgetPreview
                widget={previewWidget}
                large
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyWidgets({
  hasWidgets,
  onCreate,
}: {
  hasWidgets: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
          <LayoutGrid className="h-6 w-6" />
        </div>

        <h2 className="mt-5 text-lg font-black text-white">
          {hasWidgets
            ? "Nenhum widget encontrado"
            : "Crie seu primeiro widget"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/50">
          {hasWidgets
            ? "Altere a busca ou o filtro para encontrar seus widgets."
            : "Monte indicadores e conteúdos que poderão ser adicionados aos perfis da Home."}
        </p>

        {!hasWidgets && (
          <Button
            type="button"
            onClick={onCreate}
            className="mt-5 rounded-full bg-[#D9FF66] px-5 font-black text-[#151515]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar widget
          </Button>
        )}
      </div>
    </div>
  );
}

function WidgetLibraryCard({
  widget,
  onPreview,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
}: {
  widget: CustomWidget;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group overflow-hidden rounded-[28px] border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-white/15">
      <div
        className="h-1"
        style={{
          backgroundColor: widget.color,
        }}
      />

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-black">
                {widget.name}
              </h2>

              {!widget.is_active && (
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                >
                  Inativo
                </Badge>
              )}
            </div>

            <p className="mt-1 line-clamp-2 min-h-[40px] text-sm leading-5 text-white/45">
              {widget.description ||
                "Widget personalizado sem descrição."}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-white/55 hover:bg-white/[0.06] hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-48"
            >
              <DropdownMenuItem
                onClick={onEdit}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onDuplicate}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onToggle}
              >
                {widget.is_active ? (
                  <X className="mr-2 h-4 w-4" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {widget.is_active
                  ? "Desativar"
                  : "Ativar"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-400 focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-[#101010] p-3">
          <div className="pointer-events-none h-[170px] overflow-hidden">
            <WidgetPreview
              widget={widget}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Badge
            variant="outline"
            className="border-white/10 bg-white/[0.035] text-white/55"
          >
            {TYPE_LABELS[
              widget.widget_type
            ]}
          </Badge>

          <Button
            type="button"
            variant="outline"
            onClick={onPreview}
            className="h-9 rounded-full border-white/10 bg-white/[0.035] px-4 text-white hover:border-[#D9FF66]/30 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
          >
            <Eye className="mr-2 h-4 w-4" />
            Visualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetPreview({
  widget,
  large = false,
}: {
  widget: CustomWidget;
  large?: boolean;
}) {
  const Icon = getWidgetIcon(
    widget.icon,
  );

  const config = widget.config ?? {};
  const value = Number(
    config.value ?? 3250,
  );
  const target = Math.max(
    0,
    Number(config.target ?? 5000),
  );

  const progress =
    target > 0
      ? Math.min(
          100,
          (value / target) * 100,
        )
      : 0;

  return (
    <div
      className={[
        "relative flex h-full min-h-[150px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#1A1A1A] text-white",
        large
          ? "min-h-[360px] p-8"
          : "p-4",
      ].join(" ")}
    >
      <div
        className="pointer-events-none absolute right-[-35px] top-[-35px] h-28 w-28 rounded-full blur-3xl"
        style={{
          backgroundColor: `${widget.color}35`,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={[
              "truncate font-black",
              large
                ? "text-2xl"
                : "text-sm",
            ].join(" ")}
          >
            {widget.name}
          </p>

          {widget.description && (
            <p
              className={[
                "mt-1 line-clamp-2 text-white/45",
                large
                  ? "text-sm"
                  : "text-xs",
              ].join(" ")}
            >
              {widget.description}
            </p>
          )}
        </div>

        <div
          className={[
            "flex shrink-0 items-center justify-center rounded-2xl border",
            large
              ? "h-14 w-14"
              : "h-10 w-10",
          ].join(" ")}
          style={{
            color: widget.color,
            borderColor:
              `${widget.color}35`,
            backgroundColor:
              `${widget.color}14`,
          }}
        >
          <Icon
            className={
              large
                ? "h-6 w-6"
                : "h-4 w-4"
            }
          />
        </div>
      </div>

      {widget.widget_type === "kpi" && (
        <div className="relative mt-auto pt-5">
          <div
            className={[
              "font-black tracking-tight",
              large
                ? "text-5xl"
                : "text-2xl",
            ].join(" ")}
            style={{
              color: widget.color,
            }}
          >
            {formatWidgetValue(
              value,
              config.prefix,
              config.suffix,
            )}
          </div>

          <p className="mt-2 text-xs text-white/40">
            Prévia do indicador
          </p>
        </div>
      )}

      {widget.widget_type ===
        "progress" && (
        <div className="relative mt-auto pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p
                className={[
                  "font-black",
                  large
                    ? "text-4xl"
                    : "text-xl",
                ].join(" ")}
                style={{
                  color: widget.color,
                }}
              >
                {formatWidgetValue(
                  value,
                  config.prefix,
                  config.suffix,
                )}
              </p>

              <p className="mt-1 text-xs text-white/40">
                de{" "}
                {formatWidgetValue(
                  target,
                  config.prefix,
                  config.suffix,
                )}
              </p>
            </div>

            <span
              className={[
                "font-black",
                large
                  ? "text-2xl"
                  : "text-base",
              ].join(" ")}
            >
              {progress.toFixed(0)}%
            </span>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor:
                  widget.color,
              }}
            />
          </div>
        </div>
      )}

      {widget.widget_type === "text" && (
        <div
          className={[
            "relative mt-5 whitespace-pre-wrap leading-7 text-white/70",
            large
              ? "text-lg"
              : "line-clamp-4 text-sm",
          ].join(" ")}
        >
          {config.content ||
            "Digite um conteúdo para este widget."}
        </div>
      )}

      {widget.widget_type === "list" && (
        <div
          className={[
            "relative mt-4 space-y-2 overflow-hidden",
            large
              ? "text-base"
              : "text-xs",
          ].join(" ")}
        >
          {(config.items ?? [
            "Primeiro item",
            "Segundo item",
            "Terceiro item",
          ])
            .slice(
              0,
              large ? 8 : 4,
            )
            .map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-[#151515]"
                  style={{
                    backgroundColor:
                      widget.color,
                  }}
                >
                  {index + 1}
                </span>

                <span className="truncate text-white/70">
                  {item}
                </span>
              </div>
            ))}
        </div>
      )}

    </div>
  );
}

function WidgetFormDialog({
  open,
  editing,
  form,
  isSaving,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  form: WidgetFormState;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (
    value: WidgetFormState,
  ) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  function update<K extends keyof WidgetFormState>(
    key: K,
    value: WidgetFormState[K],
  ) {
    onChange({
      ...form,
      [key]: value,
    });
  }

  const previewWidget: CustomWidget = {
    id: "preview",
    user_id: "",
    entity_id: "",
    name:
      form.name.trim() ||
      "Nome do widget",
    description:
      form.description.trim() ||
      null,
    widget_type:
      form.widgetType,
    icon: form.icon,
    color: form.color,
    config: formToConfig(form),
    is_active:
      form.isActive,
    created_at: "",
    updated_at: "",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSaving) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[94dvh] max-w-5xl overflow-y-auto border-white/10 bg-[#151515] p-0 text-white">
        <DialogHeader className="border-b border-white/10 px-6 py-5">
          <DialogTitle>
            {editing
              ? "Editar widget"
              : "Criar widget"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="grid gap-6 p-6 lg:grid-cols-[1fr_0.85fr]"
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>
                  Nome do widget
                </Label>

                <Input
                  value={form.name}
                  maxLength={60}
                  onChange={(event) =>
                    update(
                      "name",
                      event.target.value,
                    )
                  }
                  placeholder="Ex.: Gastos com mercado"
                  className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]"
                />
              </div>

              <div className="sm:col-span-2">
                <Label>
                  Descrição
                </Label>

                <Textarea
                  value={form.description}
                  maxLength={240}
                  onChange={(event) =>
                    update(
                      "description",
                      event.target.value,
                    )
                  }
                  placeholder="Explique o objetivo deste widget..."
                  className="mt-2 min-h-[82px] rounded-xl border-white/10 bg-white/[0.035]"
                />
              </div>
            </div>

            <div>
              <Label>Tipo do widget</Label>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TYPE_OPTIONS.map(
                  (type) => {
                    const Icon =
                      type.icon;

                    const active =
                      form.widgetType ===
                      type.value;

                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          update(
                            "widgetType",
                            type.value,
                          )
                        }
                        className={[
                          "flex items-start gap-3 rounded-2xl border p-3 text-left transition",
                          active
                            ? "border-[#D9FF66]/40 bg-[#D9FF66]/10"
                            : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            active
                              ? "bg-[#D9FF66] text-[#151515]"
                              : "bg-white/[0.05] text-white/55",
                          ].join(" ")}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-bold">
                            {type.label}
                          </p>

                          <p className="mt-1 text-xs text-white/40">
                            {
                              type.description
                            }
                          </p>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Ícone</Label>

                <Select
                  value={form.icon}
                  onValueChange={(value) =>
                    update(
                      "icon",
                      value,
                    )
                  }
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {ICON_OPTIONS.map(
                      (icon) => (
                        <SelectItem
                          key={icon.value}
                          value={icon.value}
                        >
                          {icon.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Cor</Label>

                <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) =>
                      update(
                        "color",
                        event.target.value,
                      )
                    }
                    className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0"
                  />

                  <Input
                    value={form.color}
                    onChange={(event) =>
                      update(
                        "color",
                        event.target.value,
                      )
                    }
                    className="h-8 border-0 bg-transparent px-0 uppercase shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <div className="flex h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3">
                  <Label htmlFor="widget-active">
                    Ativo
                  </Label>

                  <Switch
                    id="widget-active"
                    checked={
                      form.isActive
                    }
                    onCheckedChange={(checked) =>
                      update(
                        "isActive",
                        checked,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {(form.widgetType ===
              "kpi" ||
              form.widgetType ===
                "progress") && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-bold">
                  Dados do indicador
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>
                      Origem
                    </Label>

                    <Select
                      value={form.source}
                      onValueChange={(
                        value,
                      ) =>
                        update(
                          "source",
                          value as WidgetFormState["source"],
                        )
                      }
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="transactions">
                          Transações
                        </SelectItem>

                        <SelectItem value="invoices">
                          Faturas
                        </SelectItem>

                        <SelectItem value="cards">
                          Cartões
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Operação
                    </Label>

                    <Select
                      value={
                        form.aggregation
                      }
                      onValueChange={(
                        value,
                      ) =>
                        update(
                          "aggregation",
                          value as WidgetAggregation,
                        )
                      }
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="sum">
                          Somar valores
                        </SelectItem>

                        <SelectItem value="count">
                          Contar registros
                        </SelectItem>

                        <SelectItem value="average">
                          Média
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.source ===
                    "transactions" && (
                    <>
                      <div>
                        <Label>
                          Tipo de transação
                        </Label>

                        <Select
                          value={
                            form.transactionType
                          }
                          onValueChange={(
                            value,
                          ) =>
                            update(
                              "transactionType",
                              value as WidgetFormState["transactionType"],
                            )
                          }
                        >
                          <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="all">
                              Todas
                            </SelectItem>

                            <SelectItem value="entrada">
                              Entradas
                            </SelectItem>

                            <SelectItem value="debito">
                              Débito
                            </SelectItem>

                            <SelectItem value="credito">
                              Crédito
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>
                          Categoria
                        </Label>

                        <Input
                          value={
                            form.category
                          }
                          onChange={(
                            event,
                          ) =>
                            update(
                              "category",
                              event.target.value,
                            )
                          }
                          placeholder="Opcional"
                          className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label>
                      Período
                    </Label>

                    <Select
                      value={form.period}
                      onValueChange={(
                        value,
                      ) =>
                        update(
                          "period",
                          value as WidgetPeriod,
                        )
                      }
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {PERIOD_OPTIONS.map(
                          (period) => (
                            <SelectItem
                              key={
                                period.value
                              }
                              value={
                                period.value
                              }
                            >
                              {
                                period.label
                              }
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Valor da prévia
                    </Label>

                    <Input
                      value={
                        form.previewValue
                      }
                      onChange={(event) =>
                        update(
                          "previewValue",
                          event.target.value,
                        )
                      }
                      placeholder="3250"
                      className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]"
                    />
                  </div>

                  {form.widgetType ===
                    "progress" && (
                    <div>
                      <Label>
                        Meta
                      </Label>

                      <Input
                        value={
                          form.target
                        }
                        onChange={(event) =>
                          update(
                            "target",
                            event.target.value,
                          )
                        }
                        placeholder="5000"
                        className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]"
                      />
                    </div>
                  )}

                  <div>
                    <Label>
                      Prefixo
                    </Label>

                    <Input
                      value={form.prefix}
                      onChange={(event) =>
                        update(
                          "prefix",
                          event.target.value,
                        )
                      }
                      placeholder="R$"
                      className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]"
                    />
                  </div>

                  <div>
                    <Label>
                      Sufixo
                    </Label>

                    <Input
                      value={form.suffix}
                      onChange={(event) =>
                        update(
                          "suffix",
                          event.target.value,
                        )
                      }
                      placeholder="Opcional"
                      className="mt-2 h-11 rounded-xl border-white/10 bg-white/[0.035]"
                    />
                  </div>
                </div>
              </div>
            )}

            {form.widgetType === "text" && (
              <div>
                <Label>
                  Conteúdo
                </Label>

                <Textarea
                  value={form.content}
                  onChange={(event) =>
                    update(
                      "content",
                      event.target.value,
                    )
                  }
                  className="mt-2 min-h-[160px] rounded-xl border-white/10 bg-white/[0.035]"
                  placeholder="Digite o texto do widget..."
                />
              </div>
            )}

            {form.widgetType === "list" && (
              <div>
                <Label>
                  Itens da lista
                </Label>

                <Textarea
                  value={form.listItems}
                  onChange={(event) =>
                    update(
                      "listItems",
                      event.target.value,
                    )
                  }
                  className="mt-2 min-h-[160px] rounded-xl border-white/10 bg-white/[0.035]"
                  placeholder="Digite um item por linha..."
                />

                <p className="mt-2 text-xs text-white/40">
                  Digite um item por linha.
                </p>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <Label>Prévia</Label>

            <div className="mt-2 min-h-[360px] rounded-[28px] border border-white/10 bg-[#101010] p-4">
              <WidgetPreview
                widget={previewWidget}
                large
              />
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 pt-5 lg:col-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() =>
                onOpenChange(false)
              }
              className="rounded-full"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-[#D9FF66] px-5 font-black text-[#151515] hover:bg-[#caff3d]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {editing
                    ? "Salvar alterações"
                    : "Criar widget"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
