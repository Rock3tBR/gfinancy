import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LGPD } from "@/lib/lgpd";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — GFINANCY" },
      {
        name: "description",
        content:
          "Como o GFINANCY coleta, usa, armazena e protege seus dados pessoais, conforme a LGPD (Lei 13.709/2018).",
      },
      { property: "og:title", content: "Política de Privacidade — GFINANCY" },
      {
        property: "og:description",
        content:
          "Tratamento de dados pessoais no GFINANCY: finalidades, bases legais, retenção e direitos do titular.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      subtitle="Tratamento de dados pessoais no GFINANCY, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."
    >
      <LegalSection title="1. Quem é o controlador">
        <p>
          O controlador dos dados pessoais tratados nesta plataforma é{" "}
          <strong className="text-white">{LGPD.controller}</strong>. Para
          qualquer assunto relacionado a privacidade e proteção de dados,
          incluindo o exercício dos seus direitos como titular, o contato do
          encarregado (DPO) é{" "}
          <a
            href={`mailto:${LGPD.contactEmail}`}
            className="font-semibold text-[#D9FF66] underline underline-offset-2"
          >
            {LGPD.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Quais dados coletamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">Dados cadastrais:</strong> nome,
            e-mail e, opcionalmente, telefone e data de nascimento.
          </li>
          <li>
            <strong className="text-white">Dados financeiros informados
            por você:</strong> cartões cadastrados (apelido, bandeira, limite,
            datas de fechamento e vencimento), transações, categorias, faturas,
            gastos fixos e agenda de recebimentos.
          </li>
          <li>
            <strong className="text-white">Dados de faturas importadas:</strong>{" "}
            o texto das faturas que você opta por importar, para extração
            automática das compras.
          </li>
          <li>
            <strong className="text-white">Dados de assinatura:</strong>{" "}
            identificadores de cliente e assinatura gerados pelo provedor de
            pagamento, plano contratado e período de vigência.
          </li>
          <li>
            <strong className="text-white">Dados técnicos:</strong> registros
            de acesso e cookies necessários para autenticação e segurança.
          </li>
        </ul>
        <p>
          Não solicitamos e não devem ser inseridos na plataforma número
          completo de cartão, CVV, senha de banco ou dados sensíveis (saúde,
          biometria, convicções, entre outros).
        </p>
      </LegalSection>

      <LegalSection title="3. Para que usamos e com qual base legal">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Criar e manter sua conta e prestar o serviço contratado —{" "}
            <em>execução de contrato</em> (Art. 7º, V).
          </li>
          <li>
            Processar pagamentos e assinaturas — <em>execução de contrato</em> e{" "}
            <em>obrigação legal</em> fiscal (Art. 7º, II e V).
          </li>
          <li>
            Garantir segurança, prevenir fraudes e registrar acessos —{" "}
            <em>legítimo interesse</em> e obrigação legal (Art. 7º, II e IX).
          </li>
          <li>
            Enviar comunicações operacionais sobre sua conta —{" "}
            <em>execução de contrato</em>.
          </li>
          <li>
            Cookies opcionais de métricas de uso — <em>consentimento</em>{" "}
            (Art. 7º, I), revogável a qualquer momento.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Compartilhamento e operadores">
        <p>
          Não vendemos seus dados. Compartilhamos o mínimo necessário com
          operadores que executam o serviço em nosso nome:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Provedor de infraestrutura, banco de dados e autenticação
            (hospedagem em nuvem).
          </li>
          <li>
            Provedor de pagamentos (Stripe), que trata os dados de cobrança
            diretamente — não armazenamos dados completos do cartão.
          </li>
          <li>
            Provedor de inteligência artificial, usado exclusivamente para
            interpretar o texto das faturas que você importa. O conteúdo é
            enviado para processamento e não é usado para treinar modelos.
          </li>
        </ul>
        <p>
          Alguns operadores podem processar dados fora do Brasil. Nesses casos,
          a transferência internacional ocorre com cláusulas contratuais e
          salvaguardas compatíveis com os Arts. 33 a 36 da LGPD.
        </p>
      </LegalSection>

      <LegalSection title="5. Por quanto tempo guardamos">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir a
          conta, os dados pessoais e financeiros são eliminados de forma
          permanente e imediata dos nossos sistemas, exceto registros que
          precisamos preservar por obrigação legal ou fiscal (por exemplo,
          comprovantes de pagamento), mantidos pelo prazo legal aplicável e de
          forma segregada.
        </p>
      </LegalSection>

      <LegalSection title="6. Seus direitos como titular">
        <p>
          Você pode, a qualquer momento, exercer os direitos do Art. 18 da
          LGPD: confirmação e acesso, correção, anonimização ou bloqueio,
          portabilidade, eliminação, informação sobre compartilhamentos e
          revogação do consentimento.
        </p>
        <p>
          Na plataforma, em{" "}
          <strong className="text-white">Perfil → Privacidade e dados</strong>,
          você consegue <strong className="text-white">exportar todos os
          seus dados</strong> em formato JSON (acesso e portabilidade) e{" "}
          <strong className="text-white">excluir sua conta</strong>{" "}
          permanentemente. Você também pode corrigir nome, e-mail e senha
          diretamente na tela de perfil, ou nos escrever em{" "}
          {LGPD.contactEmail} — respondemos em até 15 dias.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          Utilizamos cookies necessários para autenticação e segurança da
          sessão, que não podem ser desativados sem inviabilizar o login.
          Cookies opcionais de métricas só são usados mediante consentimento
          dado no banner. Você pode revogar a escolha limpando os dados do site
          no navegador ou nos contatando.
        </p>
      </LegalSection>

      <LegalSection title="8. Segurança">
        <p>
          Adotamos criptografia em trânsito (HTTPS), isolamento de dados por
          usuário no banco de dados (políticas de acesso por linha),
          autenticação gerenciada e controle de acesso administrativo com
          registro de auditoria. Detalhes em nossa página de Segurança.
        </p>
      </LegalSection>

      <LegalSection title="9. Incidentes e alterações">
        <p>
          Em caso de incidente de segurança com risco relevante, comunicaremos
          os titulares afetados e a ANPD nos termos do Art. 48 da LGPD. Esta
          política pode ser atualizada; mudanças relevantes serão informadas na
          plataforma.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
