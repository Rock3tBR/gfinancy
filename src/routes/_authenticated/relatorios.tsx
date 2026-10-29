import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosRedirect,
});

function RelatoriosRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/faturas",
      search: {
        tab: "relatorios",
      } as any,
      replace: true,
    } as any);
  }, [navigate]);

  return null;
}
