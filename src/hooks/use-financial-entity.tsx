import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type FinancialEntityType = "cpf" | "cnpj";

export type FinancialEntity = {
  id: string;
  owner_user_id: string;
  type: FinancialEntityType;
  name: string | null;
  nickname: string | null;
  document: string | null;
  legal_name: string | null;
  trade_name: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
  cards_count?: number;
  transactions_count?: number;
  categories_count?: number;
  invoices_count?: number;
};

type FinancialEntityContextValue = {
  entities: FinancialEntity[];
  selectedEntity: FinancialEntity | null;
  selectedEntityId: string | null;
  isLoading: boolean;
  setSelectedEntityId: (entityId: string) => void;
};

const FinancialEntityContext =
  createContext<FinancialEntityContextValue | null>(null);

function getStorageKey(userId: string) {
  return `financaspro-selected-entity:${userId}`;
}

export function FinancialEntityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  const [selectedEntityId, setSelectedEntityIdState] = useState<string | null>(
    null
  );

  const storageKey = user?.id ? getStorageKey(user.id) : null;

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["financial-entities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "list_my_financial_entities"
      );

      if (error) throw error;

      return (data ?? []) as FinancialEntity[];
    },
  });

  useEffect(() => {
    if (!storageKey) return;

    const saved = window.localStorage.getItem(storageKey);

    if (saved) {
      setSelectedEntityIdState(saved);
    }
  }, [storageKey]);

  useEffect(() => {
    if (entities.length === 0) {
      setSelectedEntityIdState(null);
      return;
    }

    const selectedStillExists = entities.some(
      (entity) => entity.id === selectedEntityId
    );

    if (selectedEntityId && selectedStillExists) return;

    const defaultEntity =
      entities.find((entity) => entity.is_default) ?? entities[0];

    setSelectedEntityIdState(defaultEntity.id);

    if (storageKey) {
      window.localStorage.setItem(storageKey, defaultEntity.id);
    }
  }, [entities, selectedEntityId, storageKey]);

  function setSelectedEntityId(entityId: string) {
    setSelectedEntityIdState(entityId);

    if (storageKey) {
      window.localStorage.setItem(storageKey, entityId);
    }
  }

  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;

    return entities.find((entity) => entity.id === selectedEntityId) ?? null;
  }, [entities, selectedEntityId]);

  const value: FinancialEntityContextValue = {
    entities,
    selectedEntity,
    selectedEntityId,
    isLoading,
    setSelectedEntityId,
  };

  return (
    <FinancialEntityContext.Provider value={value}>
      {children}
    </FinancialEntityContext.Provider>
  );
}

export function useFinancialEntity() {
  const context = useContext(FinancialEntityContext);

  if (!context) {
    throw new Error(
      "useFinancialEntity deve ser usado dentro de FinancialEntityProvider"
    );
  }

  return context;
}