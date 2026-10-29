import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Responsive,
  WidthProvider,
  type Layout,
} from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  Check,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ResponsiveGridLayout = WidthProvider(Responsive);

export type HomeWidgetSize =
  | "compact"
  | "small"
  | "medium"
  | "large"
  | "wide"
  | "full"
  | "sm"
  | "md"
  | "lg"
  | "xl";

export type HomeWidgetDefinition = {
  id: string;
  title: string;
  description?: string;
  defaultSize?: HomeWidgetSize;
  defaultVisible?: boolean;
  defaultLayout?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  render: () => ReactNode;
};

export type WidgetVisibility = {
  id: string;
  visible: boolean;
};

export type DashboardBreakpoint =
  | "lg"
  | "md"
  | "sm"
  | "xs";

export type DashboardLayouts = Record<
  DashboardBreakpoint,
  Layout
>;

type LibraryLayouts = Partial<Record<string, Layout>>;

export type HomeDashboardConfig = {
  layouts: DashboardLayouts;
  visibility: WidgetVisibility[];
};

type EditableHomeDashboardProps = {
  widgets: HomeWidgetDefinition[];
  profileId: string;
  profileName: string;
  layouts?: Partial<DashboardLayouts> | null;
  visibility?: WidgetVisibility[] | null;
  isSaving?: boolean;
  headerActions?: ReactNode;
  onSave: (
    config: HomeDashboardConfig,
  ) => void | Promise<void>;
};

type NormalizedSize =
  | "compact"
  | "small"
  | "medium"
  | "large"
  | "wide"
  | "full";

const BREAKPOINTS: Record<
  DashboardBreakpoint,
  number
> = {
  lg: 1200,
  md: 900,
  sm: 640,
  xs: 0,
};

const COLUMNS: Record<
  DashboardBreakpoint,
  number
> = {
  lg: 12,
  md: 8,
  sm: 4,
  xs: 1,
};

const GRID_MARGIN: [number, number] = [16, 16];
const GRID_PADDING: [number, number] = [0, 0];
const ROW_HEIGHT = 70;

const SIZE_LAYOUT: Record<
  NormalizedSize,
  {
    w: number;
    h: number;
    minW: number;
    minH: number;
  }
> = {
  compact: {
    w: 12,
    h: 2,
    minW: 4,
    minH: 2,
  },
  small: {
    w: 3,
    h: 3,
    minW: 3,
    minH: 2,
  },
  medium: {
    w: 6,
    h: 5,
    minW: 4,
    minH: 3,
  },
  large: {
    w: 8,
    h: 6,
    minW: 5,
    minH: 4,
  },
  wide: {
    w: 12,
    h: 5,
    minW: 6,
    minH: 3,
  },
  full: {
    w: 12,
    h: 8,
    minW: 6,
    minH: 5,
  },
};

function normalizeSize(
  size?: HomeWidgetSize,
): NormalizedSize {
  if (!size) return "medium";
  if (size === "sm") return "small";
  if (size === "md") return "medium";
  if (size === "lg" || size === "xl") {
    return "large";
  }

  return size;
}

function cloneLayout(layout: Layout): Layout {
  return layout.map((item) => ({ ...item }));
}

function cloneLayouts(
  layouts: DashboardLayouts,
): DashboardLayouts {
  return {
    lg: cloneLayout(layouts.lg),
    md: cloneLayout(layouts.md),
    sm: cloneLayout(layouts.sm),
    xs: cloneLayout(layouts.xs),
  };
}

function cloneConfig(
  config: HomeDashboardConfig,
): HomeDashboardConfig {
  return {
    layouts: cloneLayouts(config.layouts),
    visibility: config.visibility.map((item) => ({
      ...item,
    })),
  };
}

function makeDesktopLayout(
  widgets: HomeWidgetDefinition[],
): Layout {
  let cursorX = 0;
  let cursorY = 0;
  let currentRowHeight = 0;

  return widgets.map((widget) => {
    const size =
      SIZE_LAYOUT[
        normalizeSize(widget.defaultSize)
      ];

    const explicit = widget.defaultLayout;

    if (explicit) {
      return {
        i: widget.id,
        x: explicit.x,
        y: explicit.y,
        w: explicit.w,
        h: explicit.h,
        minW: Math.min(size.minW, explicit.w),
        minH: Math.min(size.minH, explicit.h),
        maxW: COLUMNS.lg,
      };
    }

    if (cursorX + size.w > COLUMNS.lg) {
      cursorX = 0;
      cursorY += currentRowHeight;
      currentRowHeight = 0;
    }

    const item: Layout[number] = {
      i: widget.id,
      x: cursorX,
      y: cursorY,
      w: size.w,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
      maxW: COLUMNS.lg,
    };

    cursorX += size.w;
    currentRowHeight = Math.max(
      currentRowHeight,
      size.h,
    );

    if (cursorX >= COLUMNS.lg) {
      cursorX = 0;
      cursorY += currentRowHeight;
      currentRowHeight = 0;
    }

    return item;
  });
}

function scaleLayout(
  desktop: Layout,
  columns: number,
  singleColumn = false,
): Layout {
  if (singleColumn) {
    let y = 0;

    return desktop.map((item) => {
      const height = Math.max(
        item.minH ?? 2,
        item.h,
      );

      const scaled: Layout[number] = {
        ...item,
        x: 0,
        y,
        w: 1,
        h: height,
        minW: 1,
        maxW: 1,
      };

      y += height;
      return scaled;
    });
  }

  const ratio = columns / COLUMNS.lg;

  return desktop.map((item) => {
    const width = Math.max(
      1,
      Math.min(
        columns,
        Math.round(item.w * ratio),
      ),
    );

    const x = Math.max(
      0,
      Math.min(
        columns - width,
        Math.round(item.x * ratio),
      ),
    );

    const minimumWidth = Math.max(
      1,
      Math.round((item.minW ?? 1) * ratio),
    );

    return {
      ...item,
      x,
      w: width,
      minW: Math.min(width, minimumWidth),
      maxW: columns,
    };
  });
}

function buildDefaultLayouts(
  widgets: HomeWidgetDefinition[],
): DashboardLayouts {
  const desktop = makeDesktopLayout(widgets);

  return {
    lg: desktop,
    md: scaleLayout(desktop, COLUMNS.md),
    sm: scaleLayout(desktop, COLUMNS.sm),
    xs: scaleLayout(
      desktop,
      COLUMNS.xs,
      true,
    ),
  };
}

function buildDefaultVisibility(
  widgets: HomeWidgetDefinition[],
): WidgetVisibility[] {
  return widgets.map((widget) => ({
    id: widget.id,
    visible: widget.defaultVisible !== false,
  }));
}

function createDefaultConfig(
  widgets: HomeWidgetDefinition[],
): HomeDashboardConfig {
  return {
    layouts: buildDefaultLayouts(widgets),
    visibility: buildDefaultVisibility(widgets),
  };
}

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function sanitizeLayout(
  saved: Layout | undefined,
  widgets: HomeWidgetDefinition[],
  fallback: Layout,
): Layout {
  const validIds = new Set(
    widgets.map((widget) => widget.id),
  );

  const savedById = new Map<
    string,
    Layout[number]
  >();

  for (const item of saved ?? []) {
    if (validIds.has(item.i)) {
      savedById.set(item.i, item);
    }
  }

  return fallback.map((fallbackItem) => {
    const savedItem = savedById.get(
      fallbackItem.i,
    );

    if (!savedItem) {
      return { ...fallbackItem };
    }

    return {
      ...fallbackItem,
      ...savedItem,
      i: fallbackItem.i,
      x: isFiniteNumber(savedItem.x)
        ? savedItem.x
        : fallbackItem.x,
      y: isFiniteNumber(savedItem.y)
        ? savedItem.y
        : fallbackItem.y,
      w: isFiniteNumber(savedItem.w)
        ? savedItem.w
        : fallbackItem.w,
      h: isFiniteNumber(savedItem.h)
        ? savedItem.h
        : fallbackItem.h,
      minW: fallbackItem.minW,
      minH: fallbackItem.minH,
      maxW: fallbackItem.maxW,
    };
  });
}

function sanitizeConfig(
  widgets: HomeWidgetDefinition[],
  layouts?: Partial<DashboardLayouts> | null,
  visibility?: WidgetVisibility[] | null,
): HomeDashboardConfig {
  const defaults = createDefaultConfig(widgets);

  const visibilityById = new Map(
    (visibility ?? []).map((item) => [
      item.id,
      item,
    ]),
  );

  return {
    layouts: {
      lg: sanitizeLayout(
        layouts?.lg,
        widgets,
        defaults.layouts.lg,
      ),
      md: sanitizeLayout(
        layouts?.md,
        widgets,
        defaults.layouts.md,
      ),
      sm: sanitizeLayout(
        layouts?.sm,
        widgets,
        defaults.layouts.sm,
      ),
      xs: sanitizeLayout(
        layouts?.xs,
        widgets,
        defaults.layouts.xs,
      ),
    },
    visibility: widgets.map((widget) => ({
      id: widget.id,
      visible:
        visibilityById.get(widget.id)?.visible ??
        widget.defaultVisible !== false,
    })),
  };
}

function filterVisibleLayouts(
  layouts: DashboardLayouts,
  visibleIds: Set<string>,
): DashboardLayouts {
  return {
    lg: layouts.lg.filter((item) =>
      visibleIds.has(item.i),
    ),
    md: layouts.md.filter((item) =>
      visibleIds.has(item.i),
    ),
    sm: layouts.sm.filter((item) =>
      visibleIds.has(item.i),
    ),
    xs: layouts.xs.filter((item) =>
      visibleIds.has(item.i),
    ),
  };
}

function mergeBreakpoint(
  base: Layout,
  changed: Layout | undefined,
  visibleIds: Set<string>,
): Layout {
  if (!changed) return cloneLayout(base);

  const changedById = new Map(
    changed.map((item) => [item.i, item] as const),
  );

  return base.map((baseItem) => {
    if (!visibleIds.has(baseItem.i)) {
      return { ...baseItem };
    }

    const changedItem = changedById.get(
      baseItem.i,
    );

    if (!changedItem) return { ...baseItem };

    return {
      ...baseItem,
      ...changedItem,
      i: baseItem.i,
      minW: baseItem.minW,
      minH: baseItem.minH,
      maxW: baseItem.maxW,
    };
  });
}

function mergeLayouts(
  base: DashboardLayouts,
  changed: LibraryLayouts,
  visibleIds: Set<string>,
): DashboardLayouts {
  return {
    lg: mergeBreakpoint(
      base.lg,
      changed.lg,
      visibleIds,
    ),
    md: mergeBreakpoint(
      base.md,
      changed.md,
      visibleIds,
    ),
    sm: mergeBreakpoint(
      base.sm,
      changed.sm,
      visibleIds,
    ),
    xs: mergeBreakpoint(
      base.xs,
      changed.xs,
      visibleIds,
    ),
  };
}

export function EditableHomeDashboard({
  widgets,
  profileId,
  profileName,
  layouts,
  visibility,
  isSaving = false,
  headerActions,
  onSave,
}: EditableHomeDashboardProps) {
  const profileConfig = useMemo(
    () =>
      sanitizeConfig(
        widgets,
        layouts,
        visibility,
      ),
    [layouts, visibility, widgets],
  );

  const [isEditing, setIsEditing] =
    useState(false);

  const [savedConfig, setSavedConfig] =
    useState<HomeDashboardConfig>(
      profileConfig,
    );

  const [draftConfig, setDraftConfig] =
    useState<HomeDashboardConfig>(
      profileConfig,
    );

  const [activeWidgetId, setActiveWidgetId] =
    useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updateMobile = () => setIsMobile(media.matches);

    updateMobile();
    media.addEventListener("change", updateMobile);

    return () => media.removeEventListener("change", updateMobile);
  }, []);

  useEffect(() => {
    const nextConfig = cloneConfig(profileConfig);

    setSavedConfig(nextConfig);
    setDraftConfig(nextConfig);
    setIsEditing(false);
    setActiveWidgetId(null);
  }, [profileConfig, profileId]);

  useEffect(() => {
    function startEditing() {
      setDraftConfig(cloneConfig(savedConfig));
      setActiveWidgetId(null);
      setIsEditing(true);
    }

    window.addEventListener(
      "fintechpro:edit-home",
      startEditing,
    );

    return () => {
      window.removeEventListener(
        "fintechpro:edit-home",
        startEditing,
      );
    };
  }, [savedConfig]);

  const currentConfig = isEditing
    ? draftConfig
    : savedConfig;

  const visibleIds = useMemo(
    () =>
      new Set(
        currentConfig.visibility
          .filter((item) => item.visible)
          .map((item) => item.id),
      ),
    [currentConfig.visibility],
  );

  const visibleLayouts = useMemo(
    () =>
      filterVisibleLayouts(
        currentConfig.layouts,
        visibleIds,
      ),
    [currentConfig.layouts, visibleIds],
  );

  const visibleWidgets = useMemo(
    () =>
      widgets.filter((widget) =>
        visibleIds.has(widget.id),
      ),
    [visibleIds, widgets],
  );

  const hiddenWidgets = useMemo(
    () =>
      widgets.filter(
        (widget) =>
          !visibleIds.has(widget.id),
      ),
    [visibleIds, widgets],
  );

  function setWidgetVisibility(
    id: string,
    visible: boolean,
  ) {
    setDraftConfig((current) => ({
      ...current,
      visibility: current.visibility.map(
        (item) =>
          item.id === id
            ? { ...item, visible }
            : item,
      ),
    }));
  }

  function handleLayoutsChange(
    _currentLayout: Layout,
    allLayouts: LibraryLayouts,
  ) {
    if (!isEditing) return;

    setDraftConfig((current) => ({
      ...current,
      layouts: mergeLayouts(
        current.layouts,
        allLayouts,
        visibleIds,
      ),
    }));
  }

  function resetDraft() {
    setDraftConfig(
      createDefaultConfig(widgets),
    );
    setActiveWidgetId(null);
  }

  function cancelEditing() {
    setDraftConfig(cloneConfig(savedConfig));
    setActiveWidgetId(null);
    setIsEditing(false);
  }

  async function finishEditing() {
    const nextConfig = cloneConfig(draftConfig);

    await onSave(nextConfig);

    setSavedConfig(nextConfig);
    setDraftConfig(nextConfig);
    setActiveWidgetId(null);
    setIsEditing(false);
  }

  return (
    <div className="relative min-w-0 pb-28 text-white">
      <style>{`
        .gfinancy-home-grid .react-grid-item {
          transition: transform 180ms ease, width 180ms ease, height 180ms ease;
        }

        .gfinancy-home-grid .react-grid-item.react-draggable-dragging,
        .gfinancy-home-grid .react-grid-item.resizing {
          z-index: 60;
          transition: none;
        }

        .gfinancy-home-grid .react-grid-item.react-grid-placeholder {
          border: 1px dashed rgba(217,255,102,.8);
          border-radius: 28px;
          background: rgba(217,255,102,.09);
          opacity: 1;
        }

        .gfinancy-home-grid .react-resizable-handle {
          display: none;
        }

        .gfinancy-home-grid.is-editing .react-resizable-handle {
          display: block;
        }

        .gfinancy-home-grid .react-resizable-handle-se {
          right: 9px;
          bottom: 9px;
          width: 28px;
          height: 28px;
          cursor: se-resize;
          border-radius: 10px;
          background: rgba(217,255,102,.12);
          border: 1px solid rgba(217,255,102,.32);
        }

        .gfinancy-home-grid .react-resizable-handle-se::after {
          right: 7px;
          bottom: 7px;
          width: 9px;
          height: 9px;
          border-right: 2px solid #D9FF66;
          border-bottom: 2px solid #D9FF66;
        }

        .gfinancy-home-grid.is-editing {
          background-image:
            radial-gradient(
              circle,
              rgba(217,255,102,.32) 1.8px,
              transparent 2px
            );
          background-size:
            calc((100% - 176px) / 12 + 16px)
            ${ROW_HEIGHT + GRID_MARGIN[1]}px;
          background-position: 0 12px;
          border-radius: 30px;
        }
      `}</style>

      {isEditing &&
        hiddenWidgets.length > 0 && (
          <div className="mb-5 rounded-[28px] border border-white/10 bg-[#1A1A1A]/95 p-4">
            <p className="font-bold text-white">
              Widgets ocultos
            </p>

            <p className="mt-1 text-sm text-white/50">
              Restaure um widget para colocá-lo
              novamente na Home.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenWidgets.map((widget) => (
                <Button
                  key={widget.id}
                  type="button"
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.04] text-white"
                  onClick={() =>
                    setWidgetVisibility(
                      widget.id,
                      true,
                    )
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Mostrar {widget.title}
                </Button>
              ))}
            </div>
          </div>
        )}

      {headerActions && (
        <div className="mb-3 flex justify-end">
          {headerActions}
        </div>
      )}

      {isMobile ? (
        <div className="gfinancy-home-mobile-stack space-y-4">
          {visibleWidgets.map((widget) => (
            <section
              key={widget.id}
              className={cn(
                "relative min-w-0 overflow-hidden rounded-[24px]",
                isEditing &&
                  "border border-dashed border-[#D9FF66]/30 bg-[#0B0F10]/45 p-2",
              )}
            >
              {isEditing && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#15191B]/95 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{widget.title}</p>
                    <p className="text-[11px] text-white/45">
                      No celular os widgets ficam em uma coluna.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full border-white/10 bg-white/[0.055]"
                    onClick={() => setWidgetVisibility(widget.id, false)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="min-w-0">{widget.render()}</div>
            </section>
          ))}
        </div>
      ) : (
      <ResponsiveGridLayout
        className={cn(
          "gfinancy-home-grid",
          isEditing &&
            "is-editing rounded-[30px] border border-[#D9FF66]/20 p-2",
        )}
        layouts={visibleLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLUMNS}
        rowHeight={ROW_HEIGHT}
        margin={GRID_MARGIN}
        containerPadding={GRID_PADDING}
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".widget-drag-handle"
        draggableCancel="button, a, input, textarea, select, [role='button']"
        resizeHandles={["se"]}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms
        measureBeforeMount
        onLayoutChange={handleLayoutsChange}
        onDragStart={(_layout, item) => {
          setActiveWidgetId(item?.i ?? null);
        }}
        onDragStop={() => {
          setActiveWidgetId(null);
        }}
        onResizeStart={(_layout, item) => {
          setActiveWidgetId(item?.i ?? null);
        }}
        onResizeStop={() => {
          setActiveWidgetId(null);
        }}
      >
        {visibleWidgets.map((widget) => {
          const active =
            activeWidgetId === widget.id;

          return (
            <div
              key={widget.id}
              className="min-h-0"
            >
              <section
                className={cn(
                  "relative h-full min-h-0 overflow-hidden rounded-[28px]",
                  isEditing &&
                    "border border-dashed border-[#D9FF66]/30 bg-[#0B0F10]/45 p-2",
                  active &&
                    "border-[#D9FF66]/80 ring-2 ring-[#D9FF66]/15",
                )}
              >
                {isEditing && (
                  <div className="absolute left-3 right-3 top-3 z-40 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#15191B]/95 px-3 py-2">
                    <div className="widget-drag-handle flex min-w-0 flex-1 cursor-grab items-center gap-2">
                      <GripVertical className="h-4 w-4 text-white/55" />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {widget.title}
                        </p>

                        <p className="truncate text-[11px] text-white/45">
                          Arraste para mover · use a quina
                          para redimensionar
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-white/10 bg-white/[0.055]"
                      onClick={() =>
                        setWidgetVisibility(
                          widget.id,
                          false,
                        )
                      }
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div
                  className={cn(
                    "h-full min-h-0",
                    isEditing &&
                      "pointer-events-none select-none opacity-[0.13] grayscale",
                  )}
                >
                  {widget.render()}
                </div>
              </section>
            </div>
          );
        })}
      </ResponsiveGridLayout>
      )}

      {isEditing && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[100] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 rounded-[22px] border border-white/10 bg-[#15191B]/96 p-3 shadow-2xl sm:bottom-5 sm:w-[calc(100%-2rem)] sm:rounded-[26px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-5 w-5 text-[#D9FF66]" />

              <div>
                <p className="text-sm font-black">
                  Editando: {profileName}
                </p>

                <p className="text-xs text-white/50">
                  A personalização será salva no
                  Supabase.
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={resetDraft}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={cancelEditing}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                disabled={isSaving}
                className="bg-[#D9FF66] font-black text-[#101411]"
                onClick={() =>
                  void finishEditing()
                }
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Salvar perfil
              </Button>
            </div>
          </div>
        </div>
      )}

      {!visibleWidgets.length &&
        !isEditing && (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.025] px-6 py-20 text-center">
            <LayoutGrid className="mx-auto h-9 w-9 text-white/30" />

            <p className="mt-4 font-bold">
              Sua Home está vazia
            </p>
          </div>
        )}
    </div>
  );
}
