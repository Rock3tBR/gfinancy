import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LGPD } from "@/lib/lgpd";

export function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#101010] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-bold text-white/70 transition hover:text-[#D9FF66]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <h1 className="mt-6 text-3xl font-black sm:text-4xl">{title}</h1>

        <p className="mt-2 text-sm text-white/50">{subtitle}</p>

        <p className="mt-1 text-xs text-white/35">
          Última atualização: {LGPD.lastUpdated}
        </p>

        <article className="mt-8 space-y-7 text-sm leading-7 text-white/70">
          {children}
        </article>

        <nav className="mt-12 flex flex-wrap gap-3 border-t border-white/10 pt-6 text-xs font-bold text-white/45">
          <Link to="/privacidade" className="hover:text-[#D9FF66]">
            Política de Privacidade
          </Link>
          <Link to="/termos" className="hover:text-[#D9FF66]">
            Termos de Uso
          </Link>
          <Link to="/seguranca" className="hover:text-[#D9FF66]">
            Segurança
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
