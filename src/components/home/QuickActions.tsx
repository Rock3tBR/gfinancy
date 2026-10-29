import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { CreditCard, FileUp, FolderPlus, Plus, ReceiptText, Tags } from "lucide-react";

const ACTIONS = [
  { label: "Importar fatura", description: "Enviar PDF, TXT ou CSV", icon: FileUp, to: "/transacoes" },
  { label: "Nova transação", description: "Registrar entrada ou saída", icon: Plus, to: "/transacoes" },
  { label: "Criar categoria", description: "Organizar seus gastos", icon: Tags, to: "/categorias" },
  { label: "Adicionar cartão", description: "Cadastrar novo cartão", icon: CreditCard, to: "/cartoes" },
  { label: "Registrar pagamento", description: "Baixar uma fatura", icon: FolderPlus, to: "/faturas" },
  { label: "Gerar relatório", description: "Análise detalhada", icon: ReceiptText, to: "/relatorios" },
];

export function QuickActions() {
  const navigate = useNavigate();
  return (
    <Card className="rounded-3xl border-border bg-card shadow-sm">
      <CardContent className="p-5"><div className="mb-4"><p className="text-base font-bold text-foreground">Ações rápidas</p><p className="text-sm text-muted-foreground">Atalhos para movimentar sua rotina financeira.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{ACTIONS.map((action) => { const Icon = action.icon; return <Button key={action.label} type="button" variant="outline" className="h-auto justify-start rounded-3xl p-4 text-left" onClick={() => navigate({ to: action.to as any })}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div><p className="font-semibold">{action.label}</p><p className="mt-1 text-xs text-muted-foreground">{action.description}</p></div></div></Button>; })}</div></CardContent>
    </Card>
  );
}
