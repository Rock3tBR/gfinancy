import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/analise-fatura")({
  component: AnaliseFaturaRedirect,
});

function AnaliseFaturaRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/faturas",
      search: {
        tab: "analise",
      } as any,
      replace: true,
    } as any);
  }, [navigate]);

  return null;
}
