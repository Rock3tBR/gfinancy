export type Plan = "free" | "pro" | "premium" | "max";

export const PLAN_PRICE_IDS: Partial<Record<Plan, string>> = {
  pro: "pro_monthly",
  premium: "premium_monthly",
  max: "max_monthly",
};

export type BooleanFeature =
  | "invoiceControl"
  | "invoiceImport"
  | "invoiceImportText"
  | "invoiceImportCsv"
  | "invoiceImportPdf"
  | "invoiceImportXlsx"
  | "invoiceAnalysis"
  | "reports"
  | "pdfCsvExport"
  | "pdfExport"
  | "csvExport"
  | "dueDateAlerts"
  | "financialGoals"
  | "fullDashboard"
  | "editableDashboard"
  | "customWidgets"
  | "smartCategorize"
  | "forecast"
  | "budgets"
  | "heatmap"
  | "mindMap"
  | "multiUser"
  | "multiEntity"
  | "memberPermissions"
  | "savingsSuggestions"
  | "investmentRecommendations"
  | "betaFeatures";

export type LimitFeature =
  | "maxCards"
  | "maxTxPerMonth"
  | "maxCategories"
  | "maxMembers"
  | "maxEntities"
  | "maxCpfEntities"
  | "maxCnpjEntities";

export type Feature = BooleanFeature | LimitFeature;

export type PlanCapabilities = {
  maxCards: number;
  maxTxPerMonth: number;
  maxCategories: number;
  maxMembers: number;

  /**
   * Quantidade total de entidades:
   * entidade principal + entidades adicionais.
   */
  maxEntities: number;

  /**
   * Mantidos para compatibilidade com o código atual.
   */
  maxCpfEntities: number;
  maxCnpjEntities: number;

  invoiceControl: boolean;

  invoiceImport: boolean;
  invoiceImportText: boolean;
  invoiceImportCsv: boolean;
  invoiceImportPdf: boolean;
  invoiceImportXlsx: boolean;

  invoiceAnalysis: boolean;
  reports: boolean;

  pdfCsvExport: boolean;
  pdfExport: boolean;
  csvExport: boolean;

  dueDateAlerts: boolean;
  financialGoals: boolean;

  fullDashboard: boolean;
  editableDashboard: boolean;
  customWidgets: boolean;

  smartCategorize: boolean;
  forecast: boolean;
  budgets: boolean;
  heatmap: boolean;
  mindMap: boolean;

  multiUser: boolean;
  multiEntity: boolean;
  memberPermissions: boolean;

  savingsSuggestions: boolean;
  investmentRecommendations: boolean;
  betaFeatures: boolean;
};

export const PLAN_CAPS: Record<Plan, PlanCapabilities> = {
  free: {
    maxCards: 1,
    maxTxPerMonth: 30,
    maxCategories: 3,
    maxMembers: 1,

    // Uma entidade principal.
    maxEntities: 1,
    maxCpfEntities: 1,
    maxCnpjEntities: 0,

    invoiceControl: true,

    invoiceImport: false,
    invoiceImportText: false,
    invoiceImportCsv: false,
    invoiceImportPdf: false,
    invoiceImportXlsx: false,

    invoiceAnalysis: false,
    reports: false,

    pdfCsvExport: false,
    pdfExport: false,
    csvExport: false,

    dueDateAlerts: false,
    financialGoals: false,

    fullDashboard: true,
    editableDashboard: false,
    customWidgets: false,

    smartCategorize: false,
    forecast: false,
    budgets: false,
    heatmap: false,
    mindMap: false,

    multiUser: false,
    multiEntity: false,
    memberPermissions: false,

    savingsSuggestions: false,
    investmentRecommendations: false,
    betaFeatures: false,
  },

  pro: {
    maxCards: 3,
    maxTxPerMonth: 60,
    maxCategories: 6,
    maxMembers: 1,

    // Uma entidade principal.
    maxEntities: 1,
    maxCpfEntities: 1,
    maxCnpjEntities: 0,

    invoiceControl: true,

    invoiceImport: true,
    invoiceImportText: true,
    invoiceImportCsv: true,
    invoiceImportPdf: true,
    invoiceImportXlsx: true,

    invoiceAnalysis: true,
    reports: true,

    pdfCsvExport: true,
    pdfExport: false,
    csvExport: true,

    // Alertas somente dentro do sistema.
    dueDateAlerts: true,
    financialGoals: true,

    fullDashboard: true,
    editableDashboard: false,
    customWidgets: false,

    smartCategorize: false,
    forecast: false,
    budgets: true,
    heatmap: true,
    mindMap: false,

    multiUser: false,
    multiEntity: false,
    memberPermissions: false,

    savingsSuggestions: false,
    investmentRecommendations: false,
    betaFeatures: false,
  },

  premium: {
    maxCards: Infinity,
    maxTxPerMonth: Infinity,

    // Conforme ajuste sugerido: categorias ilimitadas.
    maxCategories: Infinity,

    maxMembers: 1,

    // Uma entidade principal + uma adicional.
    maxEntities: 2,

    /**
     * Estes limites permitem uma entidade principal e uma adicional.
     * A validação definitiva deve usar maxEntities para permitir
     * que a adicional seja CPF ou CNPJ.
     */
    maxCpfEntities: 2,
    maxCnpjEntities: 1,

    invoiceControl: true,

    invoiceImport: true,
    invoiceImportText: true,
    invoiceImportCsv: true,
    invoiceImportPdf: true,
    invoiceImportXlsx: true,

    invoiceAnalysis: true,
    reports: true,

    pdfCsvExport: true,
    pdfExport: true,
    csvExport: true,

    dueDateAlerts: true,
    financialGoals: true,

    fullDashboard: true,
    editableDashboard: true,
    customWidgets: false,

    smartCategorize: true,
    forecast: true,
    budgets: true,
    heatmap: true,
    mindMap: true,

    multiUser: false,
    multiEntity: true,
    memberPermissions: false,

    savingsSuggestions: false,
    investmentRecommendations: false,
    betaFeatures: false,
  },

  max: {
    maxCards: Infinity,
    maxTxPerMonth: Infinity,
    maxCategories: Infinity,

    /**
     * Usuário principal + até três integrantes.
     */
    maxMembers: 4,

    /**
     * Uma entidade principal + três adicionais.
     */
    maxEntities: 4,

    /**
     * A validação definitiva deve priorizar maxEntities.
     * Estes valores permanecem para compatibilidade.
     */
    maxCpfEntities: 4,
    maxCnpjEntities: 4,

    invoiceControl: true,

    invoiceImport: true,
    invoiceImportText: true,
    invoiceImportCsv: true,
    invoiceImportPdf: true,
    invoiceImportXlsx: true,

    invoiceAnalysis: true,
    reports: true,

    pdfCsvExport: true,
    pdfExport: true,
    csvExport: true,

    dueDateAlerts: true,
    financialGoals: true,

    fullDashboard: true,
    editableDashboard: true,
    customWidgets: true,

    smartCategorize: true,
    forecast: true,
    budgets: true,
    heatmap: true,
    mindMap: true,

    multiUser: true,
    multiEntity: true,
    memberPermissions: true,

    savingsSuggestions: true,
    investmentRecommendations: true,
    betaFeatures: true,
  },
};

export const PLAN_META: Record<
  Plan,
  {
    name: string;
    price: string;
    tagline: string;
    description: string;
    color: string;
    recommended?: boolean;
  }
> = {
  free: {
    name: "Grátis",
    price: "R$ 0",
    tagline: "Comece a organizar suas finanças",
    description:
      "Controle básico com um cartão, até 30 transações mensais e três categorias.",
    color: "#8a8f98",
  },

  pro: {
    name: "Pro",
    price: "R$ 29,90/mês",
    tagline: "Controle completo para uso pessoal",
    description:
      "Controle faturas, importe dados, exporte transações e receba alertas dentro do sistema.",
    color: "#d9ff66",
    recommended: true,
  },

  premium: {
    name: "Premium",
    price: "R$ 59,90/mês",
    tagline: "Personalização e previsão financeira",
    description:
      "Recursos ilimitados, dashboard editável, previsão financeira e uma entidade adicional.",
    color: "#a88bff",
  },

  max: {
    name: "Max",
    price: "R$ 99,90/mês",
    tagline: "Família, múltiplas entidades e inovação",
    description:
      "Gestão familiar, três entidades adicionais, widgets personalizados, sugestões e recursos beta.",
    color: "#3ba3ff",
  },
};

export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    "1 cartão",
    "Até 30 transações por mês",
    "Até 3 categorias",
    "1 entidade principal",
    "Controle de faturas",
    "Dashboard financeiro",
    "Cadastro manual de transações",
    "Sem alertas financeiros",
    "Sem metas financeiras",
    "Sem personalização da tela",
  ],

  pro: [
    "Até 3 cartões",
    "Até 60 transações por mês",
    "Até 6 categorias",
    "Controle de faturas",
    "Metas financeiras",
    "Alertas dentro do sistema",
    "Importação de faturas",
    "Exportação de transações em CSV",
    "Relatórios financeiros",
    "Orçamento por categoria",
    "Mapa de calor de gastos",
    "Sem personalização da tela",
  ],

  premium: [
    "Tudo do Plano Pro",
    "Cartões ilimitados",
    "Transações ilimitadas",
    "Categorias ilimitadas",
    "1 entidade principal + 1 adicional",
    "A entidade adicional pode ser CPF ou CNPJ",
    "Personalização da tela inicial",
    "Importação PDF, CSV, XLSX e texto",
    "Exportação PDF e CSV",
    "Previsão financeira",
    "Categorização inteligente",
    "Mapa mental de gastos",
  ],

  max: [
    "Tudo do Plano Premium",
    "Cartões ilimitados",
    "Transações ilimitadas",
    "Categorias ilimitadas",
    "1 entidade principal + até 3 adicionais",
    "Entidades adicionais podem ser CPF ou CNPJ",
    "Multiusuário e gestão familiar",
    "Até 4 membros, incluindo o titular",
    "Permissões por membro",
    "Criação e edição de widgets",
    "Relatórios consolidados",
    "Sugestões de economia",
    "Recomendações de investimentos quando implementadas",
    "Acesso antecipado a recursos beta",
  ],
};

export const FEATURE_LABELS: Record<BooleanFeature, string> = {
  invoiceControl: "Controle de faturas",

  invoiceImport: "Importação de faturas",
  invoiceImportText: "Importação por texto",
  invoiceImportCsv: "Importação CSV",
  invoiceImportPdf: "Importação PDF",
  invoiceImportXlsx: "Importação XLSX",

  invoiceAnalysis: "Análise de faturas",
  reports: "Relatórios financeiros",

  pdfCsvExport: "Exportação PDF e CSV",
  pdfExport: "Exportação PDF",
  csvExport: "Exportação CSV",

  dueDateAlerts: "Alertas financeiros",
  financialGoals: "Metas financeiras",

  fullDashboard: "Dashboard completo",
  editableDashboard: "Personalização da tela",
  customWidgets: "Criação e edição de widgets",

  smartCategorize: "Categorização inteligente",
  forecast: "Previsão financeira",
  budgets: "Orçamentos por categoria",
  heatmap: "Mapa de calor",
  mindMap: "Mapa mental",

  multiUser: "Multiusuário e família",
  multiEntity: "Múltiplas entidades",
  memberPermissions: "Permissões por membro",

  savingsSuggestions: "Sugestões de economia",
  investmentRecommendations: "Recomendações de investimentos",
  betaFeatures: "Recursos beta",
};

export const FEATURE_UPGRADE_COPY: Record<
  BooleanFeature,
  {
    title: string;
    description: string;
    recommendedPlan: Plan;
  }
> = {
  invoiceControl: {
    title: "Controle suas faturas",
    description:
      "Cadastre cartões, acompanhe faturas abertas e organize seus pagamentos.",
    recommendedPlan: "free",
  },

  invoiceImport: {
    title: "Importe suas faturas",
    description:
      "No Plano Pro, você pode importar faturas e organizar seus lançamentos mais rapidamente.",
    recommendedPlan: "pro",
  },

  invoiceImportText: {
    title: "Importação por texto",
    description:
      "Cole o texto da fatura e transforme os gastos em transações organizadas.",
    recommendedPlan: "pro",
  },

  invoiceImportCsv: {
    title: "Importação por CSV",
    description:
      "Importe arquivos CSV para acelerar o cadastro das suas transações.",
    recommendedPlan: "pro",
  },

  invoiceImportPdf: {
    title: "Importação por PDF",
    description:
      "Importe sua fatura em PDF e organize os lançamentos automaticamente.",
    recommendedPlan: "pro",
  },

  invoiceImportXlsx: {
    title: "Importação por XLSX",
    description:
      "Importe planilhas do Excel para analisar e organizar suas transações.",
    recommendedPlan: "pro",
  },

  invoiceAnalysis: {
    title: "Analise suas faturas",
    description:
      "Veja os gastos da fatura, categorias, finalidades e valores consolidados.",
    recommendedPlan: "pro",
  },

  reports: {
    title: "Gere relatórios financeiros",
    description:
      "Tenha relatórios completos para acompanhar suas entradas, despesas e faturas.",
    recommendedPlan: "pro",
  },

  pdfCsvExport: {
    title: "Exporte seus dados",
    description:
      "Exporte informações financeiras em PDF ou CSV para guardar e analisar.",
    recommendedPlan: "premium",
  },

  pdfExport: {
    title: "Exporte em PDF",
    description:
      "Gere relatórios em PDF para acompanhar ou compartilhar seus resultados.",
    recommendedPlan: "premium",
  },

  csvExport: {
    title: "Exporte suas transações",
    description:
      "Baixe seus dados em CSV para usar no Excel ou em outras ferramentas.",
    recommendedPlan: "pro",
  },

  dueDateAlerts: {
    title: "Ative os alertas financeiros",
    description:
      "Receba alertas dentro do sistema sobre vencimentos, faturas e limites de categorias.",
    recommendedPlan: "pro",
  },

  financialGoals: {
    title: "Crie metas financeiras",
    description:
      "Defina objetivos, acompanhe o progresso e organize seus planos financeiros.",
    recommendedPlan: "pro",
  },

  fullDashboard: {
    title: "Acesse o dashboard financeiro",
    description:
      "Acompanhe seus principais indicadores financeiros em uma única tela.",
    recommendedPlan: "free",
  },

  editableDashboard: {
    title: "Personalize sua página inicial",
    description:
      "Escolha a posição e a exibição dos componentes do seu dashboard.",
    recommendedPlan: "premium",
  },

  customWidgets: {
    title: "Crie seus próprios widgets",
    description:
      "No Plano Max, você poderá criar, editar e personalizar widgets financeiros.",
    recommendedPlan: "max",
  },

  smartCategorize: {
    title: "Use categorização inteligente",
    description:
      "O sistema ajuda a identificar e classificar automaticamente suas despesas.",
    recommendedPlan: "premium",
  },

  forecast: {
    title: "Veja sua previsão financeira",
    description:
      "Projete saldo, despesas e compromissos futuros com base no seu histórico.",
    recommendedPlan: "premium",
  },

  budgets: {
    title: "Controle orçamentos por categoria",
    description:
      "Defina limites de gastos e acompanhe o consumo de cada categoria.",
    recommendedPlan: "pro",
  },

  heatmap: {
    title: "Veja seu mapa de calor",
    description:
      "Identifique os dias em que você mais gastou com uma visão visual.",
    recommendedPlan: "pro",
  },

  mindMap: {
    title: "Veja o mapa mental de gastos",
    description:
      "Explore seus gastos por cartão, categoria, estabelecimento e finalidade.",
    recommendedPlan: "premium",
  },

  multiUser: {
    title: "Compartilhe o controle financeiro",
    description:
      "Gerencie as finanças com familiares ou outros usuários no Plano Max.",
    recommendedPlan: "max",
  },

  multiEntity: {
    title: "Controle mais de uma entidade",
    description:
      "Separe as finanças de diferentes CPFs e CNPJs em entidades independentes.",
    recommendedPlan: "premium",
  },

  memberPermissions: {
    title: "Controle permissões por membro",
    description:
      "Defina quem pode visualizar, cadastrar, editar ou administrar cada entidade.",
    recommendedPlan: "max",
  },

  savingsSuggestions: {
    title: "Receba sugestões de economia",
    description:
      "Use análises do seu comportamento financeiro para encontrar oportunidades de economia.",
    recommendedPlan: "max",
  },

  investmentRecommendations: {
    title: "Receba recomendações de investimentos",
    description:
      "Quando implementado, este recurso estará disponível para usuários do Plano Max.",
    recommendedPlan: "max",
  },

  betaFeatures: {
    title: "Acesse recursos em desenvolvimento",
    description:
      "Usuários do Plano Max podem receber acesso antecipado aos novos recursos do GFinancy.",
    recommendedPlan: "max",
  },
};

export function canUseFeature(
  plan: Plan,
  feature: BooleanFeature,
): boolean {
  return PLAN_CAPS[plan][feature];
}

export function getPlanLimit(
  plan: Plan,
  limit: LimitFeature,
): number {
  return PLAN_CAPS[plan][limit];
}

export function hasReachedLimit(
  plan: Plan,
  limit: LimitFeature,
  currentValue: number,
): boolean {
  const max = getPlanLimit(plan, limit);

  if (max === Infinity) {
    return false;
  }

  return currentValue >= max;
}

export function isUpgradeRequired(
  plan: Plan,
  feature: BooleanFeature,
): boolean {
  return !canUseFeature(plan, feature);
}

export function getRecommendedPlanForFeature(
  feature: BooleanFeature,
): Plan {
  return FEATURE_UPGRADE_COPY[feature].recommendedPlan;
}

export function getPlanLevel(plan: Plan): number {
  const levels: Record<Plan, number> = {
    free: 1,
    pro: 2,
    premium: 3,
    max: 4,
  };

  return levels[plan];
}

export function isPlanAtLeast(
  currentPlan: Plan,
  requiredPlan: Plan,
): boolean {
  return getPlanLevel(currentPlan) >= getPlanLevel(requiredPlan);
}

export function formatLimit(value: number): string {
  if (value === Infinity) {
    return "Ilimitado";
  }

  return String(value);
}

export const FEATURE_GROUPS: {
  title: string;
  keys: BooleanFeature[];
}[] = [
  {
    title: "Faturas e relatórios",
    keys: [
      "invoiceControl",
      "invoiceImport",
      "invoiceAnalysis",
      "reports",
      "dueDateAlerts",
      "financialGoals",
    ],
  },

  {
    title: "Dashboard e inteligência",
    keys: [
      "fullDashboard",
      "editableDashboard",
      "customWidgets",
      "smartCategorize",
      "forecast",
      "budgets",
      "heatmap",
      "mindMap",
    ],
  },

  {
    title: "Família e entidades",
    keys: [
      "multiEntity",
      "multiUser",
      "memberPermissions",
    ],
  },

  {
    title: "Recursos avançados",
    keys: [
      "savingsSuggestions",
      "investmentRecommendations",
      "betaFeatures",
    ],
  },
];

export function getImportFormats(plan: Plan): string {
  const caps = PLAN_CAPS[plan];

  const formats = [
    caps.invoiceImportText && "Texto",
    caps.invoiceImportCsv && "CSV",
    caps.invoiceImportPdf && "PDF",
    caps.invoiceImportXlsx && "XLSX",
  ].filter(Boolean);

  return formats.length
    ? formats.join(", ")
    : "—";
}

export function getExportFormats(plan: Plan): string {
  const caps = PLAN_CAPS[plan];

  if (caps.pdfExport && caps.csvExport) {
    return "PDF, CSV";
  }

  if (caps.pdfExport) {
    return "PDF";
  }

  if (caps.csvExport) {
    return "CSV";
  }

  return "—";
}

export function isAllowed(
  plan: Plan,
  feature: Feature,
): boolean {
  const value = PLAN_CAPS[plan][feature];

  if (typeof value === "boolean") {
    return value;
  }

  return value > 0;
}