import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import { readCookieConsent, saveCookieConsent } from "@/lib/lgpd";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readCookieConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  function decide(analytics: boolean) {
    saveCookieConsent(analytics);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md">
      <div className="rounded-3xl border border-white/10 bg-[#1A1A1A]/95 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
            <Cookie className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black text-white">
              Cookies e privacidade
            </p>

            <p className="mt-1 text-xs leading-5 text-white/55">
              Usamos cookies necessários para manter você conectado. Cookies
              opcionais (métricas de uso) só são ativados com o seu
              consentimento, conforme a LGPD. Veja a{" "}
              <Link
                to="/privacidade"
                className="font-semibold text-[#D9FF66] underline underline-offset-2"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => decide(true)}
            className="h-9 flex-1 rounded-full bg-[#D9FF66] text-xs font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
          >
            Aceitar todos
          </Button>

          <Button
            variant="outline"
            onClick={() => decide(false)}
            className="h-9 flex-1 rounded-full border-white/10 bg-white/[0.045] text-xs font-bold text-white hover:bg-white/[0.08] hover:text-white"
          >
            Somente necessários
          </Button>
        </div>
      </div>
    </div>
  );
}
