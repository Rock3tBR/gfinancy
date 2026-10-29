export const LGPD = {
  controller: "GFINANCY",
  contactEmail: "enriquealves_72@hotmail.com",
  lastUpdated: "06/08/2026",
  appName: "GFINANCY",
} as const;

export const COOKIE_CONSENT_KEY = "gfinancy:cookie-consent";

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  decidedAt: string;
};

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

export function saveCookieConsent(analytics: boolean) {
  if (typeof window === "undefined") return;

  const consent: CookieConsent = {
    necessary: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));

  return consent;
}

/** Tabelas com dados pessoais do titular, usadas na exportação (Art. 18, LGPD). */
export const USER_DATA_TABLES = [
  "profiles",
  "financial_entities",
  "entity_members",
  "cards",
  "categories",
  "transactions",
  "installments",
  "invoices",
  "invoice_analyses",
  "invoice_analysis_items",
  "gastos_fixos",
  "recurring_expenses",
  "payment_schedule",
  "notifications",
  "home_profiles",
  "custom_widgets",
  "ui_preferences",
  "subscriptions",
  "user_plan_addons",
] as const;
