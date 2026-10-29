import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LGPD } from "@/lib/lgpd";

export const Route = createFileRoute("/seguranca")({
  component: SegurancaPage,
  head: () => ({
    meta: [
      { title: "Segurança — GFINANCY" },
      {
        name: "description",
        content:
          "Medidas de segurança do GFINANCY: criptografia, isolamento de dados por usuário, controle de acesso e canal para reportar vulnerabilidades.",
      },
      { property: "og:title", content: "Segurança — GFINANCY" },
      {
        property: "og:description",
        content:
          "Como protegemos seus dados financeiros e como reportar uma vulnerabilidade.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SegurancaPage() {
  return (
    <LegalPage
      title="Segurança"
      subtitle="Medidas técnicas e organizacionais adotadas para proteger seus dados."
    >
      <LegalSection title="Proteção dos dados">
        <ul className="list-disc space-y-2 pl-5">
          <li>Todo o tráfego é criptografado em trânsito via HTTPS/TLS.</li>
          <li>
            Os dados ficam em banco de dados gerenciado, com criptografia em
            repouso e backups automáticos do provedor.
          </li>
          <li>
            Isolamento por usuário: políticas de segurança em nível de linha
            garantem que cada conta só acessa os próprios registros.
          </li>
          <li>
            Funções internas do sistema exigem sessão autenticada — nenhuma
            delas pode ser executada por visitantes anônimos.
          </li>
          <li>
            Senhas são armazenadas e verificadas pelo serviço de autenticação
            gerenciado; nunca temos acesso à sua senha em texto claro.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Acesso administrativo">
        <p>
          O acesso administrativo é restrito a contas explicitamente
          autorizadas e é utilizado apenas para suporte, gestão de planos e
          manutenção. Ações administrativas sensíveis ficam registradas em log
          de auditoria com autor, alvo e data.
        </p>
      </LegalSection>

      <LegalSection title="Pagamentos">
        <p>
          Os pagamentos são processados pela Stripe. Dados completos de cartão
          são inseridos diretamente no ambiente do provedor e não trafegam nem
          são armazenados nos nossos servidores.
        </p>
      </LegalSection>

      <LegalSection title="O que esperamos de você">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use uma senha forte e exclusiva.</li>
          <li>Não compartilhe sua conta.</li>
          <li>
            Nunca cadastre número completo de cartão, CVV ou senhas bancárias.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Reportar uma vulnerabilidade">
        <p>
          Encontrou um problema de segurança? Escreva para{" "}
          <a
            href={`mailto:${LGPD.contactEmail}`}
            className="font-semibold text-[#D9FF66] underline underline-offset-2"
          >
            {LGPD.contactEmail}
          </a>{" "}
          com a descrição e os passos para reprodução. Pedimos que não divulgue
          publicamente antes da correção. Respondemos em até 5 dias úteis.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
