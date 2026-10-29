import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LGPD } from "@/lib/lgpd";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — GFINANCY" },
      {
        name: "description",
        content:
          "Condições de uso da plataforma GFINANCY: conta, planos, pagamentos, cancelamento e responsabilidades.",
      },
      { property: "og:title", content: "Termos de Uso — GFINANCY" },
      {
        property: "og:description",
        content:
          "Regras de utilização, assinatura, cancelamento e responsabilidades no GFINANCY.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      subtitle="Condições que regem o uso da plataforma GFINANCY."
    >
      <LegalSection title="1. Aceite">
        <p>
          Ao criar uma conta ou utilizar o GFINANCY, você concorda com estes
          Termos e com a Política de Privacidade. Se não concordar, não utilize
          a plataforma.
        </p>
      </LegalSection>

      <LegalSection title="2. O que a plataforma faz">
        <p>
          O GFINANCY é uma ferramenta de organização financeira pessoal e
          empresarial: cadastro de cartões, lançamento e importação de
          transações, controle de faturas, categorias, gastos fixos e
          relatórios. Não somos instituição financeira, não realizamos
          pagamentos de faturas nem prestamos consultoria de investimentos. Os
          números apresentados são estimativas baseadas nos dados que você
          informa.
        </p>
      </LegalSection>

      <LegalSection title="3. Conta e responsabilidade do usuário">
        <ul className="list-disc space-y-2 pl-5">
          <li>Você deve ter 18 anos ou mais e fornecer dados verdadeiros.</li>
          <li>
            É sua a responsabilidade por manter a senha em sigilo e por toda
            atividade realizada na sua conta.
          </li>
          <li>
            Não insira dados de terceiros sem base legal, nem dados sensíveis,
            número completo de cartão, CVV ou senhas bancárias.
          </li>
          <li>
            É vedado usar a plataforma para atividades ilícitas, engenharia
            reversa, acesso não autorizado ou sobrecarga do serviço.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Planos, pagamento e cancelamento">
        <p>
          A plataforma oferece um plano gratuito com limites e planos pagos
          (Pro, Premium e Max), além do adicional recorrente de entidade
          (CPF/CNPJ). As assinaturas são mensais, cobradas de forma recorrente
          pelo provedor de pagamento até o cancelamento.
        </p>
        <p>
          Você pode cancelar a qualquer momento pela área de planos; o acesso
          permanece até o fim do período já pago, sem novas cobranças. Conforme
          o Art. 49 do Código de Defesa do Consumidor, você pode desistir da
          contratação em até 7 dias da compra e receber a devolução do valor.
        </p>
      </LegalSection>

      <LegalSection title="5. Disponibilidade e limitação de responsabilidade">
        <p>
          Buscamos manter o serviço disponível de forma contínua, mas ele pode
          sofrer interrupções para manutenção ou por fatores fora do nosso
          controle. Na máxima extensão permitida pela lei, não respondemos por
          decisões financeiras tomadas com base nas informações da plataforma
          nem por dados incorretos inseridos ou importados pelo usuário.
          Recomendamos manter cópias dos seus dados por meio da exportação
          disponível no perfil.
        </p>
      </LegalSection>

      <LegalSection title="6. Encerramento">
        <p>
          Você pode excluir sua conta a qualquer momento em Perfil →
          Privacidade e dados, o que elimina permanentemente seus dados.
          Podemos suspender contas que violem estes Termos, com aviso sempre
          que possível.
        </p>
      </LegalSection>

      <LegalSection title="7. Foro e contato">
        <p>
          Estes Termos são regidos pelas leis brasileiras, eleito o foro do
          domicílio do consumidor. Dúvidas:{" "}
          <a
            href={`mailto:${LGPD.contactEmail}`}
            className="font-semibold text-[#D9FF66] underline underline-offset-2"
          >
            {LGPD.contactEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
