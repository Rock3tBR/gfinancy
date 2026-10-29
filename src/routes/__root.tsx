import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { AuthProvider } from "@/hooks/use-auth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Página não encontrada
        </h2>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  const router = useRouter();

  function handleRetry() {
    router.invalidate();
    reset();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Algo deu errado
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {error.message}
        </p>

        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "GFINANCY — Controle Financeiro",
      },
      {
        name: "description",
        content:
          "Controle suas finanças, cartões, faturas e transações em um só lugar.",
      },
      {
        property: "og:title",
        content: "GFINANCY — Controle Financeiro",
      },
      {
        name: "twitter:title",
        content: "GFINANCY — Controle Financeiro",
      },
      {
        property: "og:description",
        content:
          "Controle suas finanças, cartões, faturas e transações em um só lugar.",
      },
      {
        name: "twitter:description",
        content:
          "Controle suas finanças, cartões, faturas e transações em um só lugar.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0e071b4-de8d-4df6-a8b6-e1dd653f2eff/id-preview-c5be0277--fa8f992e-2c85-409a-88ee-34e0fa193d15.lovable.app-1779200916785.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0e071b4-de8d-4df6-a8b6-e1dd653f2eff/id-preview-c5be0277--fa8f992e-2c85-409a-88ee-34e0fa193d15.lovable.app-1779200916785.png",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "shortcut icon",
        href: "/favicon.svg",
      },
      {
        rel: "apple-touch-icon",
        href: "/favicon.svg",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>

      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />

        <CookieConsent />

        <Toaster
          richColors
          position="top-right"
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}