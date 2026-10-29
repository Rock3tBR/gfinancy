import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePlan } from "@/hooks/use-plan";
import { FinancialEntitySelector } from "@/components/FinancialEntitySelector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, FileDown, FileSearch, FileText, BarChart3, Filter } from "lucide-react";
import { FaturasOverviewPanel } from "@/components/faturas/FaturasOverviewPanel";
import { AnaliseFaturaPanel } from "@/components/faturas/AnaliseFaturaPanel";
import { RelatoriosPanel } from "@/components/faturas/RelatoriosPanel";

export const Route = createFileRoute("/_authenticated/faturas")({
  component: FaturasPage,
});

type FaturasTab = "faturas" | "analise" | "relatorios";

const TABS: Array<{
  id: FaturasTab;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    id: "faturas",
    label: "Faturas",
    description: "Acompanhe vencimentos, status e pagamentos.",
    icon: FileText,
  },
  {
    id: "analise",
    label: "Análise",
    description: "Revise gastos importados da fatura.",
    icon: FileSearch,
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Veja gráficos, filtros e exportações.",
    icon: BarChart3,
  },
];

function getInitialTab(): FaturasTab {
  if (typeof window === "undefined") return "faturas";

  const search = new URLSearchParams(window.location.search);
  const tab = search.get("tab");

  if (tab === "analise" || tab === "relatorios" || tab === "faturas") {
    return tab;
  }

  return "faturas";
}

function FaturasPage() {
  const [activeTab, setActiveTabState] = useState<FaturasTab>(() =>
    getInitialTab()
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { canUse, openUpgrade } = usePlan();

  useEffect(() => {
    const syncFromUrl = () => {
      setActiveTabState(getInitialTab());
    };

    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  function setActiveTab(tab: FaturasTab) {
    if (tab === "analise" && !canUse("invoiceAnalysis")) {
      openUpgrade(undefined, "invoiceAnalysis");
      return;
    }

    if (tab === "relatorios" && !canUse("reports")) {
      openUpgrade(undefined, "reports");
      return;
    }

    setActiveTabState(tab);

    setFiltersOpen(false);

    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    if (tab === "faturas") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }

    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="space-y-5">
      <section className="ge-mobile-toolbar flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="ge-mobile-toolbar-entity w-full sm:w-[260px]">
          <FinancialEntitySelector />
        </div>

        <div className="ge-mobile-tabs-row flex w-full gap-2 overflow-x-auto sm:w-auto sm:flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Button
                key={tab.id}
                type="button"
                variant="outline"
                className={cn(
                  "h-10 shrink-0 rounded-full px-5 font-bold transition",
                  isActive
                    ? "border-[#D9FF66]/35 bg-[#D9FF66] text-[#1A1A1A] shadow-[0_0_24px_rgba(217,255,102,0.20)] hover:bg-[#D9FF66]/90"
                    : "border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {(activeTab === "faturas" || activeTab === "relatorios") && (
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 rounded-full px-5 font-bold transition",
              filtersOpen
                ? "border-[#D9FF66]/35 bg-[#D9FF66]/15 text-[#D9FF66]"
                : "border-white/10 bg-white/[0.045] text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
            )}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
        )}

        {activeTab === "relatorios" && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
              onClick={() => {
                if (!canUse("csvExport")) {
                  openUpgrade(undefined, "csvExport");
                  return;
                }

                window.dispatchEvent(
                  new Event("fintechpro:relatorios:download-csv")
                );
              }}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Baixar CSV
            </Button>

            <Button
              type="button"
              className="h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
              onClick={() => {
                if (!canUse("pdfExport")) {
                  openUpgrade(undefined, "pdfExport");
                  return;
                }

                window.dispatchEvent(
                  new Event("fintechpro:relatorios:download-pdf")
                );
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
          </>
        )}
      </section>

      {activeTab === "faturas" && <FaturasOverviewPanel filtersOpen={filtersOpen} />}
      {activeTab === "analise" && <AnaliseFaturaPanel />}
      {activeTab === "relatorios" && <RelatoriosPanel filtersOpen={filtersOpen} />}
    </div>
  );
}
