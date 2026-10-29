import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  Edit,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  UserRound,
  WalletCards,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/entidades")({
  component: EntidadesPage,
});

type EntityType = "cpf" | "cnpj";

type FinancialEntity = {
  id: string;
  owner_user_id: string;
  type: EntityType;
  name: string | null;
  nickname: string | null;
  document: string | null;
  legal_name: string | null;
  trade_name: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
  cards_count: number;
  transactions_count: number;
  categories_count: number;
  invoices_count: number;
};

type EntityLimits = {
  plan: string;
  cpf_used: number;
  cpf_limit: number;
  cnpj_used: number;
  cnpj_limit: number;
  extra_entity_slots: number;
  extra_entity_slots_used: number;
  extra_entity_slots_available: number;
  can_create_cpf: boolean;
  can_create_cnpj: boolean;
  can_buy_extra_entity_addon: boolean;
};

type EntityModalMode = "create" | "edit";

type EntityModalState = {
  open: boolean;
  mode: EntityModalMode;
  entity: FinancialEntity | null;
};

const EXTRA_ENTITY_ADDON_PRICE = "R$ 25,00/mês";

const DARK_CARD =
  "border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]";

const DARK_INNER = "border-white/10 bg-white/[0.035] text-white";

const OUTLINE_BUTTON =
  "h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66] disabled:text-white/35 disabled:hover:text-white/35";

const PRIMARY_BUTTON =
  "h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90 disabled:bg-white/10 disabled:text-white/35";


function EntidadesPage() {
  const queryClient = useQueryClient();
  const { isGlobalAdmin } = useAdmin();

  const [modal, setModal] = useState<EntityModalState>({
    open: false,
    mode: "create",
    entity: null,
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntityType>("all");

  const entitiesQuery = useQuery({
    queryKey: ["my-financial-entities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "list_my_financial_entities"
      );

      if (error) throw error;

      return (data ?? []) as FinancialEntity[];
    },
  });

  const limitsQuery = useQuery({
    queryKey: ["entity-limits-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_entity_limits_summary"
      );

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      return {
        plan: row?.plan ?? "free",
        cpf_used: Number(row?.cpf_used ?? 0),
        cpf_limit: Number(row?.cpf_limit ?? 0),
        cnpj_used: Number(row?.cnpj_used ?? 0),
        cnpj_limit: Number(row?.cnpj_limit ?? 0),
        extra_entity_slots: Number(row?.extra_entity_slots ?? 0),
        extra_entity_slots_used: Number(row?.extra_entity_slots_used ?? 0),
        extra_entity_slots_available: Number(
          row?.extra_entity_slots_available ?? 0
        ),
        can_create_cpf: Boolean(row?.can_create_cpf),
        can_create_cnpj: Boolean(row?.can_create_cnpj),
        can_buy_extra_entity_addon: Boolean(row?.can_buy_extra_entity_addon),
      } as EntityLimits;
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const { error } = await (supabase as any).rpc(
        "set_default_financial_entity",
        { target_entity_id: entityId }
      );

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Entidade padrão atualizada.");
      invalidateEntityQueries(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const { error } = await (supabase as any).rpc(
        "archive_financial_entity",
        { target_entity_id: entityId }
      );

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Entidade arquivada.");
      invalidateEntityQueries(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addonMutation = useMutation({
    mutationFn: async () => {
      const response = await createExtraEntitySlotCheckout();

      if (!response?.url) {
        throw new Error("Não foi possível iniciar o checkout do adicional.");
      }

      return response.url;
    },
    onSuccess: (url) => {
      toast.success("Redirecionando para o pagamento...");
      window.location.href = url;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("addon_success");
    const cancel = params.get("addon_cancel");

    if (success === "true") {
      toast.success("Add-on contratado com sucesso.");
      invalidateEntityQueries(queryClient);
      clearAddonQueryParams();
    }

    if (cancel === "true") {
      toast.info("Compra do add-on cancelada.");
      clearAddonQueryParams();
    }
  }, [queryClient]);

  const entities = entitiesQuery.data ?? [];
  const limits = limitsQuery.data;
  const isLoading = entitiesQuery.isLoading || limitsQuery.isLoading;
  const error = entitiesQuery.error || limitsQuery.error;

  const filteredEntities = useMemo(() => {
    const q = search.trim().toLowerCase();

    return entities.filter((entity) => {
      const matchesType = typeFilter === "all" || entity.type === typeFilter;

      const haystack = [
        entity.name,
        entity.nickname,
        entity.document,
        entity.legal_name,
        entity.trade_name,
        entity.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesType && matchesSearch;
    });
  }, [entities, search, typeFilter]);

  const totals = useMemo(() => {
    return entities.reduce(
      (acc, entity) => {
        acc.cards += Number(entity.cards_count ?? 0);
        acc.transactions += Number(entity.transactions_count ?? 0);
        acc.categories += Number(entity.categories_count ?? 0);
        acc.invoices += Number(entity.invoices_count ?? 0);

        if (entity.type === "cpf") acc.cpf += 1;
        if (entity.type === "cnpj") acc.cnpj += 1;

        return acc;
      },
      {
        cpf: 0,
        cnpj: 0,
        cards: 0,
        transactions: 0,
        categories: 0,
        invoices: 0,
      }
    );
  }, [entities]);

  function openCreateModal() {
    setModal({ open: true, mode: "create", entity: null });
  }

  function openEditModal(entity: FinancialEntity) {
    setModal({ open: true, mode: "edit", entity });
  }

  function closeModal() {
    setModal({ open: false, mode: "create", entity: null });
  }

  function handleArchive(entity: FinancialEntity) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir "${getEntityDisplayName(entity)}"? Esta entidade será desativada e removida da sua lista.`
    );

    if (!confirmed) return;
    archiveMutation.mutate(entity.id);
  }

  return (
    <div className="space-y-5">
      <section className="ge-mobile-toolbar flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Badge className="ge-mobile-full h-10 rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 px-4 text-[#D9FF66] hover:bg-[#D9FF66]/10">
          <WalletCards className="mr-2 h-4 w-4" />
          Entidades financeiras
        </Badge>

        <div className="ge-mobile-full relative w-full sm:w-[310px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-white/38" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar CPF, CNPJ ou apelido..."
            className="h-10 w-full rounded-full border-white/10 bg-white/[0.045] pl-9 text-white placeholder:text-white/35"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as "all" | EntityType)}
        >
          <SelectTrigger className="h-10 w-full rounded-full border-white/10 bg-white/[0.045] px-5 text-white sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="cpf">CPF</SelectItem>
            <SelectItem value="cnpj">CNPJ</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          className={OUTLINE_BUTTON}
          onClick={() => invalidateEntityQueries(queryClient)}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>

        <Button type="button" className={PRIMARY_BUTTON} onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Nova entidade
        </Button>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          title="Plano atual"
          value={limits?.plan ? getPlanLabel(limits.plan) : "—"}
          hint={isGlobalAdmin ? "Admin Master · Max fixo" : "Limites do plano ativo"}
          icon={Star}
          tone="primary"
        />

        <MetricCard
          title="CPF usados"
          value={`${limits?.cpf_used ?? 0}/${formatLimit(limits?.cpf_limit)}`}
          hint={`${totals.cpf} entidade(s) pessoais`}
          icon={UserRound}
          tone="secondary"
        />

        <MetricCard
          title="CNPJ usados"
          value={`${limits?.cnpj_used ?? 0}/${formatLimit(limits?.cnpj_limit)}`}
          hint={`${totals.cnpj} empresa(s) cadastrada(s)`}
          icon={Building2}
          tone="success"
        />

        <MetricCard
          title="Extras livres"
          value={limits?.extra_entity_slots_available ?? 0}
          hint={`${limits?.extra_entity_slots ?? 0} comprado(s)`}
          icon={Sparkles}
          tone="warning"
        />

        <MetricCard
          title="Dados vinculados"
          value={totals.transactions}
          hint={`${totals.cards} cartões · ${totals.invoices} faturas`}
          icon={Database}
          tone="neutral"
        />
      </div>

      <AddonCard
        limits={limits ?? null}
        isGlobalAdmin={isGlobalAdmin}
        loading={limitsQuery.isLoading}
        buying={addonMutation.isPending}
        onBuy={() => addonMutation.mutate()}
      />

      <Card className={DARK_CARD}>
        <CardContent className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center">
          <div>
            <p className="text-base font-black text-white">Suas entidades</p>

            <p className="mt-1 text-sm text-white/50">
              {filteredEntities.length} de {entities.length} entidade(s) exibida(s).
              Defina a padrão, edite informações e mantenha CPF/CNPJ separados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="h-9 rounded-full border border-white/10 bg-white/[0.045] px-3 text-white/55 hover:bg-white/[0.045]">
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              {totals.cards} cartões
            </Badge>

            <Badge className="h-9 rounded-full border border-white/10 bg-white/[0.045] px-3 text-white/55 hover:bg-white/[0.045]">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {totals.transactions} transações
            </Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={(error as Error)?.message || "Erro ao carregar entidades."} />
      ) : entities.length === 0 ? (
        <EmptyState onCreate={openCreateModal} />
      ) : filteredEntities.length === 0 ? (
        <Card className={DARK_CARD}>
          <CardContent className="py-14 text-center">
            <Search className="mx-auto h-8 w-8 text-white/35" />

            <h3 className="mt-4 font-semibold text-white">
              Nenhuma entidade encontrada
            </h3>

            <p className="mt-2 text-sm text-white/50">
              Ajuste a busca ou o filtro para visualizar suas entidades.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredEntities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              onEdit={() => openEditModal(entity)}
              onSetDefault={() => setDefaultMutation.mutate(entity.id)}
              onArchive={() => handleArchive(entity)}
              settingDefault={setDefaultMutation.isPending}
              archiving={archiveMutation.isPending}
            />
          ))}
        </div>
      )}

      <EntityModal
        open={modal.open}
        mode={modal.mode}
        entity={modal.entity}
        limits={limits ?? null}
        onClose={closeModal}
      />
    </div>
  );
}

function AddonCard({
  limits,
  isGlobalAdmin,
  loading,
  buying,
  onBuy,
}: {
  limits: EntityLimits | null;
  isGlobalAdmin: boolean;
  loading: boolean;
  buying: boolean;
  onBuy: () => void;
}) {
  const plan = limits?.plan ?? "free";
  const isFree = plan === "free";

  const canBuy =
    Boolean(limits?.can_buy_extra_entity_addon) && !isGlobalAdmin && !isFree;

  return (
    <Card className={`overflow-hidden ${DARK_CARD}`}>
      <CardContent className="grid gap-5 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
            <ShoppingCart className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-white">
                Precisa de mais entidades?
              </h2>

              <Badge variant="outline" className="rounded-full border-white/10 text-white/60">
                Add-on
              </Badge>

              <Badge className="rounded-full border border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#2ECC71] hover:bg-[#2ECC71]/10">
                {EXTRA_ENTITY_ADDON_PRICE}
              </Badge>
            </div>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/50">
              Adicione +1 CPF ou CNPJ extra por unidade comprada. O adicional
              não muda seu plano principal, apenas aumenta seu limite de
              entidades.
            </p>

            <div className="mt-3 grid gap-2 text-xs text-white/55 sm:grid-cols-3">
              <AddonInfo
                label="Extras comprados"
                value={limits?.extra_entity_slots ?? 0}
              />
              <AddonInfo
                label="Extras usados"
                value={limits?.extra_entity_slots_used ?? 0}
              />
              <AddonInfo
                label="Extras disponíveis"
                value={limits?.extra_entity_slots_available ?? 0}
              />
            </div>

            {isGlobalAdmin && (
              <p className="mt-3 text-xs text-white/42">
                Admin Master já possui acesso Max fixo.
              </p>
            )}

            {!isGlobalAdmin && isFree && (
              <p className="mt-3 text-xs text-white/42">
                Disponível apenas para clientes pagantes.
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          disabled={loading || buying || !canBuy}
          onClick={onBuy}
          className={PRIMARY_BUTTON}
        >
          {buying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecionando...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Comprar +1 CNPJ/CPF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function EntityCard({
  entity,
  onEdit,
  onSetDefault,
  onArchive,
  settingDefault,
  archiving,
}: {
  entity: FinancialEntity;
  onEdit: () => void;
  onSetDefault: () => void;
  onArchive: () => void;
  settingDefault: boolean;
  archiving: boolean;
}) {
  const isCnpj = entity.type === "cnpj";
  const Icon = isCnpj ? Building2 : UserRound;
  const entityColor = isCnpj ? "#A88BFF" : "#D9FF66";

  return (
    <Card className={`group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-[#D9FF66]/30 hover:shadow-[0_24px_90px_rgba(0,0,0,0.34)] ${DARK_CARD}`}>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                color: entityColor,
                backgroundColor: `${entityColor}18`,
                borderColor: `${entityColor}33`,
                boxShadow: `0 0 24px ${entityColor}22`,
              }}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-black text-white">
                  {getEntityDisplayName(entity)}
                </h2>

                <Badge
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/[0.035] uppercase text-white/60"
                >
                  {entity.type}
                </Badge>

                {entity.is_default && (
                  <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/10">
                    <Star className="mr-1 h-3.5 w-3.5" />
                    Padrão
                  </Badge>
                )}
              </div>

              <p className="mt-1 text-sm text-white/48">
                {isCnpj
                  ? entity.trade_name || "Nome fantasia não informado"
                  : "Entidade pessoal"}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-white/45 hover:bg-white/[0.06] hover:text-[#D9FF66]"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoLine
            label={isCnpj ? "CNPJ" : "CPF"}
            value={formatDocument(entity.document, entity.type)}
          />

          <InfoLine
            label="Apelido no dropdown"
            value={`${getEntityDisplayName(entity)} · ${entity.type.toUpperCase()}`}
          />

          {isCnpj && (
            <>
              <InfoLine label="Nome fantasia" value={entity.trade_name || "—"} />
              <InfoLine label="Razão social" value={entity.legal_name || "—"} />
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <SmallCount
            label="Cartões"
            value={Number(entity.cards_count ?? 0)}
            icon={CreditCard}
          />
          <SmallCount
            label="Transações"
            value={Number(entity.transactions_count ?? 0)}
            icon={FileText}
          />
          <SmallCount
            label="Categorias"
            value={Number(entity.categories_count ?? 0)}
            icon={Database}
          />
          <SmallCount
            label="Faturas"
            value={Number(entity.invoices_count ?? 0)}
            icon={WalletCards}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={OUTLINE_BUTTON}
            onClick={onEdit}
          >
            <Edit className="mr-1.5 h-4 w-4" />
            Editar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={OUTLINE_BUTTON}
            disabled={entity.is_default || settingDefault}
            onClick={onSetDefault}
          >
            <Star className="mr-1.5 h-4 w-4" />
            Definir padrão
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-full border-[#FF4D5E]/25 bg-[#FF4D5E]/10 px-5 font-bold text-[#FF4D5E] hover:border-[#FF4D5E]/40 hover:bg-[#FF4D5E]/15 hover:text-[#FF4D5E]"
            disabled={archiving}
            onClick={onArchive}
          >
            <Archive className="mr-1.5 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EntityModal({
  open,
  mode,
  entity,
  limits,
  onClose,
}: {
  open: boolean;
  mode: EntityModalMode;
  entity: FinancialEntity | null;
  limits: EntityLimits | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [type, setType] = useState<EntityType>("cnpj");
  const [document, setDocument] = useState("");
  const [nickname, setNickname] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && entity) {
      setType(entity.type);
      setDocument(entity.document ?? "");
      setNickname(entity.nickname ?? entity.name ?? "");
      setTradeName(entity.trade_name ?? "");
      setLegalName(entity.legal_name ?? "");
      return;
    }

    setType("cnpj");
    setDocument("");
    setNickname("");
    setTradeName("");
    setLegalName("");
  }, [open, mode, entity]);

  const createMutation = useMutation({
    mutationFn: async () => {
      validateEntityForm({ type, document, nickname, tradeName, legalName });

      const { data, error } = await (supabase as any).rpc(
        "create_financial_entity",
        {
          entity_type: type,
          entity_document: cleanDocument(document),
          entity_nickname: nickname.trim(),
          entity_trade_name: type === "cnpj" ? tradeName.trim() : null,
          entity_legal_name: type === "cnpj" ? legalName.trim() : null,
        }
      );

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Entidade criada com sucesso.");
      invalidateEntityQueries(queryClient);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!entity) throw new Error("Entidade não encontrada.");

      validateEntityForm({ type, document, nickname, tradeName, legalName });

      const { error } = await (supabase as any).rpc(
        "update_financial_entity",
        {
          target_entity_id: entity.id,
          entity_document: cleanDocument(document),
          entity_nickname: nickname.trim(),
          entity_trade_name: type === "cnpj" ? tradeName.trim() : null,
          entity_legal_name: type === "cnpj" ? legalName.trim() : null,
        }
      );

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Entidade atualizada com sucesso.");
      invalidateEntityQueries(queryClient);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isEdit = mode === "edit";
  const isCnpj = type === "cnpj";

  const canCreateCpf = limits?.can_create_cpf ?? false;
  const canCreateCnpj = limits?.can_create_cnpj ?? false;

  const blockedByPlan =
    !isEdit &&
    ((type === "cpf" && !canCreateCpf) ||
      (type === "cnpj" && !canCreateCnpj));

  function handleSave() {
    if (mode === "create") {
      createMutation.mutate();
      return;
    }

    updateMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6 border-white/10 bg-[#1A1A1A] text-white">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar entidade" : "Nova entidade"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm font-bold text-white">
              Dados separados por entidade
            </p>

            <p className="mt-1 text-sm leading-6 text-white/50">
              O apelido será exibido no dropdown do topo. Cada entidade possui
              cartões, transações, faturas, categorias e relatórios separados.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs text-white/55">Tipo</Label>

              <Select
                value={type}
                onValueChange={(value) => setType(value as EntityType)}
                disabled={isEdit}
              >
                <SelectTrigger className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                </SelectContent>
              </Select>

              {isEdit && (
                <p className="mt-1 text-xs text-white/42">
                  O tipo não pode ser alterado depois da criação.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs text-white/55">
                {isCnpj ? "CNPJ" : "CPF"}
              </Label>

              <Input
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                placeholder={isCnpj ? "00.000.000/0001-00" : "000.000.000-00"}
                className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-white/55">Apelido</Label>

            <Input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={isCnpj ? "Ex: Minha empresa" : "Ex: Pessoal"}
              className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
            />

            <p className="mt-2 text-xs text-white/42">
              Esse nome aparece no dropdown:{" "}
              <span className="font-semibold text-[#D9FF66]">
                {nickname.trim() || "Apelido"} · {type.toUpperCase()}
              </span>
            </p>
          </div>

          {isCnpj && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs text-white/55">Nome fantasia</Label>

                <Input
                  value={tradeName}
                  onChange={(event) => setTradeName(event.target.value)}
                  placeholder="Ex: Alves Tech"
                  className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
                />
              </div>

              <div>
                <Label className="text-xs text-white/55">Razão social</Label>

                <Input
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  placeholder="Ex: Alves Tecnologia LTDA"
                  className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.035] px-5 text-white placeholder:text-white/35"
                />
              </div>
            </div>
          )}

          {blockedByPlan && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                <div>
                  <p className="font-semibold">Limite do plano atingido</p>

                  <p className="mt-1 leading-6">
                    Seu plano atual não permite criar mais entidades do tipo{" "}
                    {type.toUpperCase()}. Compre o adicional +1 CNPJ/CPF para
                    liberar mais um slot.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              className={OUTLINE_BUTTON}
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              disabled={isSaving || blockedByPlan}
              className={PRIMARY_BUTTON}
              onClick={handleSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Criar entidade"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone: "primary" | "secondary" | "success" | "warning" | "neutral";
}) {
  const toneClass = {
    primary: "text-[#D9FF66] bg-[#D9FF66]/10 border-[#D9FF66]/20",
    secondary: "text-[#A88BFF] bg-[#A88BFF]/10 border-[#A88BFF]/20",
    success: "text-[#2ECC71] bg-[#2ECC71]/10 border-[#2ECC71]/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    neutral: "text-white/70 bg-white/[0.045] border-white/10",
  }[tone];

  return (
    <Card className={DARK_CARD}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/55">{title}</p>

          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-full border",
              toneClass,
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <p className="mt-3 text-2xl font-black text-white">{value}</p>

        {hint && <p className="mt-1 text-xs text-white/38">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function AddonInfo({ label, value }: { label: string; value: number }) {
  return (
    <div className={`rounded-2xl px-3 py-2 ${DARK_INNER}`}>
      <p>{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className={`rounded-2xl p-3 ${DARK_INNER}`}>
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white">
        {value || "—"}
      </p>
    </div>
  );
}

function SmallCount({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`rounded-2xl p-3 ${DARK_INNER}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/45">{label}</p>
        <Icon className="h-3.5 w-3.5 text-white/38" />
      </div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className={DARK_CARD}>
      <CardContent className="flex min-h-[260px] items-center justify-center p-5">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando entidades...
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-[#FF4D5E]/30 bg-[#FF4D5E]/10 text-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF4D5E]" />
        <div>
          <h2 className="font-semibold text-white">
            Erro ao carregar entidades
          </h2>
          <p className="mt-1 text-sm leading-6 text-white/60">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className={DARK_CARD}>
      <CardContent className="py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
          <WalletCards className="h-7 w-7" />
        </div>

        <h3 className="mt-4 font-semibold text-white">
          Nenhuma entidade encontrada
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
          Crie sua primeira entidade financeira para separar dados pessoais,
          empresas e CNPJs.
        </p>

        <Button type="button" className={`mt-5 ${PRIMARY_BUTTON}`} onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Criar entidade
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoCheck({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#2ECC71]" />
      <span>{text}</span>
    </div>
  );
}

async function createExtraEntitySlotCheckout() {
  const payload = { quantity: 1 };

  const candidates = [
    "createExtraEntitySlotCheckout",
    "create-extra-entity-slot-checkout",
  ];

  let lastError: unknown = null;

  for (const functionName of candidates) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });

    if (!error) return data as { url?: string };
    lastError = error;
  }

  throw new Error(
    (lastError as { message?: string })?.message ||
      "Erro ao iniciar checkout do adicional."
  );
}

function invalidateEntityQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["plan"] });
  queryClient.invalidateQueries({ queryKey: ["plan-summary"] });
  queryClient.invalidateQueries({ queryKey: ["current-plan"] });
  queryClient.invalidateQueries({ queryKey: ["subscription"] });
  queryClient.invalidateQueries({ queryKey: ["my-financial-entities"] });
  queryClient.invalidateQueries({ queryKey: ["entity-limits-summary"] });
  queryClient.invalidateQueries({ queryKey: ["financial-entities"] });
  queryClient.invalidateQueries({ queryKey: ["cards"] });
  queryClient.invalidateQueries({ queryKey: ["txs"] });
  queryClient.invalidateQueries({ queryKey: ["insts"] });
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["categories"] });
}

function validateEntityForm({
  type,
  document,
  nickname,
  tradeName,
  legalName,
}: {
  type: EntityType;
  document: string;
  nickname: string;
  tradeName: string;
  legalName: string;
}) {
  const cleanedDocument = cleanDocument(document);

  if (!nickname.trim()) throw new Error("Informe o apelido da entidade.");

  if (type === "cpf") {
    if (!cleanedDocument) throw new Error("Informe o CPF.");
    if (cleanedDocument.length !== 11) {
      throw new Error("CPF inválido. Informe 11 dígitos.");
    }
    return;
  }

  if (!cleanedDocument) throw new Error("Informe o CNPJ.");
  if (cleanedDocument.length !== 14) {
    throw new Error("CNPJ inválido. Informe 14 dígitos.");
  }
  if (!tradeName.trim()) throw new Error("Informe o nome fantasia.");
  if (!legalName.trim()) throw new Error("Informe a razão social.");
}

function getEntityDisplayName(entity: FinancialEntity) {
  return entity.nickname || entity.name || "Sem nome";
}

function cleanDocument(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatDocument(value: string | null, type: EntityType) {
  const clean = cleanDocument(value ?? "");
  if (!clean) return "—";

  if (type === "cpf" && clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (type === "cnpj" && clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }

  return clean;
}

function formatLimit(value?: number) {
  if (value === undefined || value === null) return "0";
  if (!Number.isFinite(value) || value >= 999999) return "Ilimitado";
  return String(value);
}

function getPlanLabel(plan: string) {
  const labels: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    premium: "Premium",
    max: "Max",
  };

  return labels[plan] ?? plan;
}

function clearAddonQueryParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("addon_success");
  url.searchParams.delete("addon_cancel");
  window.history.replaceState({}, "", url.toString());
}
