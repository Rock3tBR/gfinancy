import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — gefinac" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/" });
    }
  }, [session, loading, navigate]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      toast.error("Informe seu nome.");
      return;
    }

    setBusy(true);

    // `full_name` vai para auth.users.raw_user_meta_data, e o trigger
    // create_profile_for_new_user() (supabase/migrations/20260710123735_...sql)
    // já lê esse campo automaticamente para preencher public.profiles.full_name.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: trimmedName,
        },
      },
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Conta criada! Verifique seu e-mail.");
    setTab("login");
  }

  async function handleGoogle() {
    setBusy(true);

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    if (result.error) {
      setBusy(false);
      toast.error("Falha ao entrar com Google");
      return;
    }

    if (result.redirected) return;

    setBusy(false);
    navigate({ to: "/" });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0B0B] text-white">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin text-[#D9FF66]" />
          Carregando sessão...
        </div>
      </main>
    );
  }

  return (
    <main className="ge-auth-page relative min-h-screen overflow-hidden bg-[#0B0B0B] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-18%] top-[-18%] h-[420px] w-[420px] rounded-full bg-[#D9FF66]/14 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-12%] h-[520px] w-[520px] rounded-full bg-[#A88BFF]/16 blur-[130px]" />
        <div className="absolute bottom-[5%] left-[42%] h-[430px] w-[430px] rounded-full bg-[#2ECC71]/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.055),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%)]" />
      </div>

      <section className="ge-auth-section relative z-10 grid min-h-screen items-center gap-10 px-4 py-6 sm:px-5 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-16 xl:px-24">
        <div className="mx-auto hidden max-w-2xl lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D9FF66]/20 bg-[#D9FF66]/10 px-4 py-2 text-sm font-bold text-[#D9FF66]">
            <Sparkles className="h-4 w-4" />
            Controle financeiro
          </div>

          <h1 className="mt-8 max-w-xl text-5xl font-black leading-[1.02] tracking-tight xl:text-6xl">
            Controle suas finanças com visão clara, moderna e inteligente.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            Organize cartões, faturas, gastos fixos, categorias e relatórios em
            uma experiência visual pensada para decisões financeiras melhores.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <FeatureCard
              icon={CreditCard}
              title="Cartões e faturas"
              description="Acompanhe limite, fechamento, vencimento e parcelas."
            />

            <FeatureCard
              icon={BarChart3}
              title="Relatórios"
              description="Veja entradas, saídas, categorias e evolução mensal."
            />

            <FeatureCard
              icon={ReceiptText}
              title="Transações"
              description="Registre entradas, débitos, crédito e gastos fixos."
            />

            <FeatureCard
              icon={ShieldCheck}
              title="Entidades separadas"
              description="Controle CPF, CNPJ e carteiras sem misturar dados."
            />
          </div>
        </div>

        <div className="ge-auth-card-wrap mx-auto w-full max-w-[460px]">
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
              <Wallet className="h-5 w-5" />
            </div>

            <div>
              <p className="text-lg font-black text-[#D9FF66]">gefinac</p>
              <p className="text-xs text-white/45">Controle financeiro</p>
            </div>
          </div>

          <div className="ge-auth-card overflow-hidden rounded-[34px] border border-white/10 bg-[#1A1A1A]/88 shadow-[0_28px_110px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="ge-auth-card-header border-b border-white/10 px-5 pb-5 pt-5 text-center sm:px-7 sm:pb-6 sm:pt-7">
              <div className="ge-auth-logo mx-auto flex h-12 w-12 items-center justify-center rounded-3xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66] shadow-[0_0_34px_rgba(217,255,102,0.14)] sm:h-14 sm:w-14">
                <Wallet className="h-7 w-7" />
              </div>

              <h2 className="mt-4 text-xl font-black tracking-tight sm:mt-5 sm:text-2xl">
                {tab === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/48">
                {tab === "login"
                  ? "Entre para acessar seu painel financeiro."
                  : "Comece a organizar sua vida financeira em poucos minutos."}
              </p>
            </div>

            <div className="ge-auth-card-body p-5 sm:p-7">
              <Tabs
                value={tab}
                onValueChange={(value) => setTab(value as "login" | "signup")}
                className="w-full"
              >
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-full border border-white/10 bg-white/[0.045] p-1">
                  <TabsTrigger
                    value="login"
                    className="rounded-full text-white/60 data-[state=active]:bg-[#D9FF66] data-[state=active]:font-bold data-[state=active]:text-[#1A1A1A]"
                  >
                    Entrar
                  </TabsTrigger>

                  <TabsTrigger
                    value="signup"
                    className="rounded-full text-white/60 data-[state=active]:bg-[#D9FF66] data-[state=active]:font-bold data-[state=active]:text-[#1A1A1A]"
                  >
                    Criar conta
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-5">
                  <AuthForm
                    mode="login"
                    name={name}
                    email={email}
                    password={password}
                    busy={busy}
                    showPassword={showPassword}
                    onNameChange={setName}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    onTogglePassword={() => setShowPassword((current) => !current)}
                    onSubmit={handleLogin}
                  />
                </TabsContent>

                <TabsContent value="signup" className="mt-5">
                  <AuthForm
                    mode="signup"
                    name={name}
                    email={email}
                    password={password}
                    busy={busy}
                    showPassword={showPassword}
                    onNameChange={setName}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    onTogglePassword={() => setShowPassword((current) => !current)}
                    onSubmit={handleSignup}
                  />
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>

                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#1A1A1A] px-3 text-white/35">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full border-white/10 bg-white/[0.045] font-bold text-white hover:border-[#D9FF66]/35 hover:bg-[#D9FF66]/10 hover:text-[#D9FF66]"
                onClick={handleGoogle}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-[#1A1A1A]">
                    G
                  </span>
                )}
                Entrar com Google
              </Button>

              <div className="ge-auth-note mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2ECC71]" />

                  <p className="text-xs leading-5 text-white/45">
                    Seus dados ficam vinculados à sua conta e separados por
                    entidade financeira, como CPF, CNPJ ou carteira.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-white/32">
            gefinac · Gestão financeira moderna
          </p>
        </div>
      </section>
    </main>
  );
}

function AuthForm({
  mode,
  name,
  email,
  password,
  busy,
  showPassword,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
}: {
  mode: "login" | "signup";
  name: string;
  email: string;
  password: string;
  busy: boolean;
  showPassword: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isSignup = mode === "signup";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isSignup && (
        <div>
          <Label htmlFor={`${mode}-name`} className="text-xs text-white/55">
            Nome
          </Label>

          <div className="relative mt-1">
            <User className="absolute left-4 top-3.5 h-4 w-4 text-white/35" />

            <Input
              id={`${mode}-name`}
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
              autoComplete="name"
              placeholder="Seu nome completo"
              className="h-11 rounded-full border-white/10 bg-white/[0.045] pl-11 pr-5 text-white placeholder:text-white/30 focus-visible:ring-[#D9FF66]"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor={`${mode}-email`} className="text-xs text-white/55">
          E-mail
        </Label>

        <div className="relative mt-1">
          <Mail className="absolute left-4 top-3.5 h-4 w-4 text-white/35" />

          <Input
            id={`${mode}-email`}
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
            autoComplete="email"
            placeholder="voce@email.com"
            className="h-11 rounded-full border-white/10 bg-white/[0.045] pl-11 pr-5 text-white placeholder:text-white/30 focus-visible:ring-[#D9FF66]"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${mode}-password`} className="text-xs text-white/55">
          Senha
        </Label>

        <div className="relative mt-1">
          <LockKeyhole className="absolute left-4 top-3.5 h-4 w-4 text-white/35" />

          <Input
            id={`${mode}-password`}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            minLength={isSignup ? 6 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "Mínimo 6 caracteres" : "Sua senha"}
            className="h-11 rounded-full border-white/10 bg-white/[0.045] pl-11 pr-12 text-white placeholder:text-white/30 focus-visible:ring-[#D9FF66]"
          />

          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-white/38 transition hover:bg-white/[0.06] hover:text-white"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {isSignup && (
          <p className="mt-2 text-xs text-white/35">
            Use pelo menos 6 caracteres.
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="h-11 w-full rounded-full bg-[#D9FF66] font-bold text-[#1A1A1A] hover:bg-[#D9FF66]/90"
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Aguarde...
          </>
        ) : (
          <>
            {isSignup ? "Criar conta" : "Entrar"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-[11px] leading-5 text-white/35">
        Ao continuar, você concorda com os{" "}
        <Link to="/termos" className="text-white/60 underline underline-offset-2 hover:text-[#D9FF66]">
          Termos de Uso
        </Link>{" "}
        e com a{" "}
        <Link to="/privacidade" className="text-white/60 underline underline-offset-2 hover:text-[#D9FF66]">
          Política de Privacidade
        </Link>
        .
      </p>
    </form>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D9FF66]/20 bg-[#D9FF66]/10 text-[#D9FF66]">
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-4 text-sm font-black text-white">{title}</p>

      <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
    </div>
  );
}
