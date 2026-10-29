import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { useAdmin } from "@/hooks/use-admin";
import { deleteMyAccount } from "@/lib/account.functions";
import { USER_DATA_TABLES, LGPD } from "@/lib/lgpd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Download,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

const DARK_CARD =
  "border-white/10 bg-[#1A1A1A]/88 text-white shadow-[0_18px_70px_rgba(0,0,0,0.24)]";

const DARK_INNER = "border-white/10 bg-white/[0.035] text-white";

const PRIMARY_BUTTON =
  "h-10 rounded-full border border-[#D9FF66]/35 bg-[#D9FF66] px-5 font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90 disabled:bg-white/10 disabled:text-white/35";

const OUTLINE_BUTTON =
  "h-10 rounded-full border-white/10 bg-white/[0.045] px-5 font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66] disabled:text-white/35 disabled:hover:text-white/35";

type PasswordState = {
  password: string;
  confirmPassword: string;
};

function PerfilPage() {
  const { user } = useAuth();
  const { plan } = usePlan();
  const { isGlobalAdmin } = useAdmin();
  const queryClient = useQueryClient();

  const initialName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(user?.email ?? "");
  const [passwordState, setPasswordState] = useState<PasswordState>({
    password: "",
    confirmPassword: "",
  });

  const [profileBusy, setProfileBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const navigate = useNavigate();
  const runDeleteMyAccount = useServerFn(deleteMyAccount);

  async function handleExportData() {
    if (!user) return;

    setExportBusy(true);

    try {
      const payload: Record<string, unknown> = {
        exportado_em: new Date().toISOString(),
        controlador: LGPD.controller,
        conta: {
          id: user.id,
          email: user.email,
          criado_em: user.created_at,
          metadata: user.user_metadata,
        },
      };

      for (const table of USER_DATA_TABLES) {
        const { data, error } = await (supabase as any).from(table).select("*");
        payload[table] = error ? { erro: error.message } : (data ?? []);
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gfinancy-meus-dados-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Exportação concluída.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao exportar dados.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite EXCLUIR para confirmar.');
      return;
    }

    setDeleteBusy(true);

    try {
      await runDeleteMyAccount({});
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Conta e dados excluídos permanentemente.");
      navigate({ to: "/login", replace: true });
    } catch (error) {
      setDeleteBusy(false);
      toast.error(
        error instanceof Error ? error.message : "Falha ao excluir a conta.",
      );
    }
  }

  const userName = name.trim() || user?.email?.split("@")[0] || "Usuário";
  const avatarInitial = userName.trim().slice(0, 1).toUpperCase() || "U";

  const planLabel = useMemo(() => {
    if (isGlobalAdmin) return "Max";

    const labels: Record<string, string> = {
      free: "Free",
      pro: "Pro",
      premium: "Premium",
      max: "Max",
    };

    return labels[plan] ?? plan ?? "Free";
  }, [isGlobalAdmin, plan]);

  async function handleUpdateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = name.trim();

    if (!nextName) {
      toast.error("Informe seu nome.");
      return;
    }

    setProfileBusy(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: nextName,
        name: nextName,
      },
    });

    setProfileBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Perfil atualizado.");
    queryClient.invalidateQueries();
  }

  async function handleUpdateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmail = email.trim();

    if (!nextEmail) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    if (nextEmail === user?.email) {
      toast("Esse já é o e-mail da sua conta.");
      return;
    }

    setEmailBusy(true);

    const { error } = await supabase.auth.updateUser({
      email: nextEmail,
    });

    setEmailBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Solicitação enviada. Confirme o novo e-mail para concluir.");
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const password = passwordState.password.trim();
    const confirmPassword = passwordState.confirmPassword.trim();

    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }

    setPasswordBusy(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setPasswordBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPasswordState({
      password: "",
      confirmPassword: "",
    });

    toast.success("Senha atualizada.");
  }

  if (!user) {
    return (
      <Card className={DARK_CARD}>
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

          <div>
            <h2 className="font-semibold text-white">Usuário não encontrado</h2>
            <p className="mt-1 text-sm text-white/55">
              Faça login novamente para acessar seu perfil.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Badge className="h-10 rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 px-4 text-[#D9FF66] hover:bg-[#D9FF66]/10">
          <UserRound className="mr-2 h-4 w-4" />
          Meu perfil
        </Badge>

        <Badge className="h-10 rounded-full border border-white/10 bg-white/[0.045] px-4 text-white/60 hover:bg-white/[0.045]">
          <Mail className="mr-2 h-4 w-4" />
          {user.email}
        </Badge>

        <Badge className="h-10 rounded-full border border-[#A88BFF]/20 bg-[#A88BFF]/10 px-4 text-[#A88BFF] hover:bg-[#A88BFF]/10">
          <Crown className="mr-2 h-4 w-4" />
          Plano {planLabel}
        </Badge>

        {isGlobalAdmin && (
          <Badge className="h-10 rounded-full border border-[#2ECC71]/20 bg-[#2ECC71]/10 px-4 text-[#2ECC71] hover:bg-[#2ECC71]/10">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Admin Master
          </Badge>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className={DARK_CARD}>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[32px] border border-[#A88BFF]/20 bg-[#A88BFF]/10 text-4xl font-black text-white shadow-[0_0_54px_rgba(168,139,255,0.18)]">
                {avatarInitial}
              </div>

              <h1 className="mt-5 text-2xl font-black text-white">
                {userName}
              </h1>

              <p className="mt-1 text-sm text-white/45">{user.email}</p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Badge className="rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66] hover:bg-[#D9FF66]/10">
                  Premium Finance
                </Badge>

                <Badge className="rounded-full border border-white/10 bg-white/[0.045] text-white/55 hover:bg-white/[0.045]">
                  ID: {user.id.slice(0, 8)}
                </Badge>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <ProfileInfo
                icon={<WalletCards className="h-4 w-4" />}
                label="Plano atual"
                value={isGlobalAdmin ? "Max fixo por Admin Master" : planLabel}
              />

              <ProfileInfo
                icon={<Mail className="h-4 w-4" />}
                label="E-mail da conta"
                value={user.email ?? "—"}
              />

              <ProfileInfo
                icon={<Sparkles className="h-4 w-4" />}
                label="Conta criada"
                value={
                  user.created_at
                    ? new Date(user.created_at).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className={DARK_CARD}>
            <CardContent className="p-5">
              <div className="mb-5">
                <h2 className="text-lg font-black text-white">
                  Informações pessoais
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Esse nome aparece no topo do sistema e no menu de perfil.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label className="text-xs text-white/55">Nome</Label>

                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.045] px-5 text-white placeholder:text-white/35 focus-visible:ring-[#D9FF66]"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className={PRIMARY_BUTTON}
                    disabled={profileBusy}
                  >
                    {profileBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar nome
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={DARK_CARD}>
            <CardContent className="p-5">
              <div className="mb-5">
                <h2 className="text-lg font-black text-white">E-mail</h2>
                <p className="mt-1 text-sm text-white/45">
                  Ao alterar o e-mail, pode ser necessário confirmar a mudança
                  na sua caixa de entrada.
                </p>
              </div>

              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <div>
                  <Label className="text-xs text-white/55">Novo e-mail</Label>

                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@email.com"
                    className="mt-1 h-11 rounded-full border-white/10 bg-white/[0.045] px-5 text-white placeholder:text-white/35 focus-visible:ring-[#D9FF66]"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="outline"
                    className={OUTLINE_BUTTON}
                    disabled={emailBusy}
                  >
                    {emailBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Alterar e-mail
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={DARK_CARD}>
            <CardContent className="p-5">
              <div className="mb-5">
                <h2 className="text-lg font-black text-white">Senha</h2>
                <p className="mt-1 text-sm text-white/45">
                  Use uma senha com no mínimo 6 caracteres.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <PasswordInput
                  label="Nova senha"
                  value={passwordState.password}
                  show={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  onChange={(value) =>
                    setPasswordState((current) => ({
                      ...current,
                      password: value,
                    }))
                  }
                />

                <PasswordInput
                  label="Confirmar senha"
                  value={passwordState.confirmPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  onChange={(value) =>
                    setPasswordState((current) => ({
                      ...current,
                      confirmPassword: value,
                    }))
                  }
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="outline"
                    className={OUTLINE_BUTTON}
                    disabled={passwordBusy}
                  >
                    {passwordBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <LockKeyhole className="mr-2 h-4 w-4" />
                        Alterar senha
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#2ECC71]/20 bg-[#2ECC71]/10 text-white shadow-sm">
            <CardContent className="flex items-start gap-3 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2ECC71]" />

              <p className="text-sm leading-6 text-white/65">
                Alterações de nome são aplicadas imediatamente. Alterações de
                e-mail podem exigir confirmação por link enviado ao novo
                endereço.
              </p>
            </CardContent>
          </Card>

          <Card className={DARK_CARD}>
            <CardContent className="p-5">
              <div className="mb-5">
                <h2 className="text-lg font-black text-white">
                  Privacidade e dados (LGPD)
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Exerça seus direitos de acesso, portabilidade e eliminação
                  previstos no Art. 18 da Lei nº 13.709/2018.
                </p>
              </div>

              <div className={`rounded-2xl p-4 ${DARK_INNER}`}>
                <p className="text-sm font-bold text-white">
                  Exportar meus dados
                </p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Baixe um arquivo JSON com todos os seus dados: perfil,
                  entidades, cartões, transações, faturas, categorias, gastos
                  fixos e assinatura.
                </p>

                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    className={OUTLINE_BUTTON}
                    onClick={handleExportData}
                    disabled={exportBusy}
                  >
                    {exportBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar JSON
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#FF5C5C]/25 bg-[#FF5C5C]/10 p-4">
                <p className="text-sm font-bold text-white">
                  Excluir minha conta
                </p>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  Remove permanentemente sua conta e todos os dados
                  financeiros associados. Esta ação é irreversível. Digite{" "}
                  <strong className="text-white">EXCLUIR</strong> para
                  confirmar.
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Input
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    placeholder="EXCLUIR"
                    className="h-10 rounded-full border-white/10 bg-white/[0.045] px-5 text-white placeholder:text-white/35 sm:max-w-[180px]"
                  />

                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleteBusy}
                    className="h-10 rounded-full bg-[#FF5C5C] px-5 font-bold text-white hover:bg-[#FF5C5C]/90"
                  >
                    {deleteBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir conta
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-white/40">
                Dúvidas sobre privacidade? Fale com o encarregado em{" "}
                <a
                  href={`mailto:${LGPD.contactEmail}`}
                  className="font-semibold text-[#D9FF66] underline underline-offset-2"
                >
                  {LGPD.contactEmail}
                </a>
                . Leia também a{" "}
                <Link
                  to="/privacidade"
                  className="font-semibold text-[#D9FF66] underline underline-offset-2"
                >
                  Política de Privacidade
                </Link>
                , os{" "}
                <Link
                  to="/termos"
                  className="font-semibold text-[#D9FF66] underline underline-offset-2"
                >
                  Termos de Uso
                </Link>{" "}
                e a página de{" "}
                <Link
                  to="/seguranca"
                  className="font-semibold text-[#D9FF66] underline underline-offset-2"
                >
                  Segurança
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${DARK_INNER}`}>
      <div className="flex items-center gap-2 text-xs text-white/42">
        {icon}
        {label}
      </div>

      <p className="mt-2 truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  show,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-white/55">{label}</Label>

      <div className="relative mt-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="h-11 rounded-full border-white/10 bg-white/[0.045] px-5 pr-12 text-white placeholder:text-white/35 focus-visible:ring-[#D9FF66]"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-white/38 transition hover:bg-white/[0.06] hover:text-white"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
