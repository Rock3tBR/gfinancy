import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { CalendarClock, CreditCard, Plus, Trash2, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({ component: ConfigPage });

type PaymentSchedule = {
  id?: string;
  user_id?: string;
  recebe_vale: boolean;
  dia_pagamento: number;
  valor_pagamento: number;
  dia_vale: number | null;
  valor_vale: number | null;
  ativo: boolean;
};

type Recurring = {
  id: string;
  descricao: string;
  dia: number;
  valor: number;
  categoria: string | null;
  auto_debit: boolean;
  ativo: boolean;
  card_id: string | null;
};

type CardRow = { id: string; nome: string };

function ConfigPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Pagamentos automáticos e gastos fixos</p>
      </div>
      <PaymentSection />
      <RecurringSection />
    </div>
  );
}

function PaymentSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<PaymentSchedule>({
    recebe_vale: false,
    dia_pagamento: 5,
    valor_pagamento: 0,
    dia_vale: 20,
    valor_vale: 0,
    ativo: true,
  });

  const { data } = useQuery({
    queryKey: ["payment-schedule", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_schedule").select("*").maybeSingle();
      if (error) throw error;
      return data as PaymentSchedule | null;
    },
  });

  useEffect(() => {
    if (data) setForm({
      recebe_vale: data.recebe_vale,
      dia_pagamento: data.dia_pagamento,
      valor_pagamento: Number(data.valor_pagamento),
      dia_vale: data.dia_vale,
      valor_vale: data.valor_vale ? Number(data.valor_vale) : 0,
      ativo: data.ativo,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const payload = {
        user_id: user.id,
        recebe_vale: form.recebe_vale,
        dia_pagamento: form.dia_pagamento,
        valor_pagamento: form.valor_pagamento,
        dia_vale: form.recebe_vale ? form.dia_vale : null,
        valor_vale: form.recebe_vale ? form.valor_vale : null,
        ativo: form.ativo,
      };
      const { error } = await supabase.from("payment_schedule").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agenda salva");
      qc.invalidateQueries({ queryKey: ["payment-schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("run_my_scheduled_entries");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamentos do dia aplicados");
      qc.invalidateQueries({ queryKey: ["txs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Agenda de pagamento</CardTitle>
        <p className="text-xs text-muted-foreground">
          Toda data configurada, o saldo é atualizado automaticamente com uma entrada.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Dia do pagamento</Label>
            <Input type="number" min={1} max={31} value={form.dia_pagamento}
              onChange={(e) => setForm({ ...form, dia_pagamento: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Valor do pagamento</Label>
            <Input type="number" step="0.01" value={form.valor_pagamento}
              onChange={(e) => setForm({ ...form, valor_pagamento: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.recebe_vale} onCheckedChange={(v) => setForm({ ...form, recebe_vale: v })} />
          <Label>Recebe vale?</Label>
        </div>
        {form.recebe_vale && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dia do vale</Label>
              <Input type="number" min={1} max={31} value={form.dia_vale ?? ""}
                onChange={(e) => setForm({ ...form, dia_vale: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Valor do vale</Label>
              <Input type="number" step="0.01" value={form.valor_vale ?? 0}
                onChange={(e) => setForm({ ...form, valor_vale: Number(e.target.value) })} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
              Aplicar lançamentos agora
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O agendamento automático roda todo dia. Use "Aplicar agora" para lançar imediatamente os valores do dia atual (e dias anteriores do mês ainda não lançados).
        </p>
      </CardContent>
    </Card>
  );
}

function RecurringSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["recurring", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_expenses").select("*").order("dia");
      if (error) throw error;
      return data as Recurring[];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("id,nome").order("nome");
      if (error) throw error;
      return data as CardRow[];
    },
  });

  const cardMap = useMemo(() => Object.fromEntries(cards.map(c => [c.id, c.nome])), [cards]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["recurring"] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Gastos fixos</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Todo dia configurado, a transação é gerada automaticamente. No cartão, entra na fatura correspondente.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo gasto fixo</DialogTitle></DialogHeader>
            <RecurringForm cards={cards} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum gasto fixo cadastrado.</p>
        ) : (
          <div className="divide-y">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-xs font-semibold">
                  {String(it.dia).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{it.descricao}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {it.categoria && <span className="text-xs text-muted-foreground">{it.categoria}</span>}
                    {it.card_id ? (
                      <Badge variant="outline" className="text-[10px]">
                        <CreditCard className="h-3 w-3 mr-1" /> {cardMap[it.card_id] ?? "Cartão"}
                      </Badge>
                    ) : it.auto_debit ? (
                      <Badge variant="default" className="text-[10px]">Auto-débito</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Manual</Badge>
                    )}
                  </div>
                </div>
                <div className="font-semibold">{brl(Number(it.valor))}</div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(it.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecurringForm({ cards, onDone }: { cards: CardRow[]; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [dia, setDia] = useState("10");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [autoDebit, setAutoDebit] = useState(true);
  const [forma, setForma] = useState<"conta" | "cartao">("conta");
  const [cardId, setCardId] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (forma === "cartao" && !cardId) throw new Error("Selecione o cartão");
      const { error } = await supabase.from("recurring_expenses").insert({
        user_id: user.id,
        descricao,
        dia: Number(dia),
        valor: Number(valor),
        categoria: categoria || null,
        auto_debit: forma === "conta" ? autoDebit : false,
        card_id: forma === "cartao" ? cardId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adicionado");
      qc.invalidateQueries({ queryKey: ["recurring"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Dia</Label><Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} required /></div>
        <div><Label>Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required /></div>
      </div>
      <div><Label>Categoria (opcional)</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} /></div>

      <div>
        <Label>Forma de pagamento</Label>
        <Select value={forma} onValueChange={(v) => setForma(v as "conta" | "cartao")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="conta">Conta (saldo)</SelectItem>
            <SelectItem value="cartao">Cartão de crédito (fatura)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {forma === "cartao" ? (
        <div>
          <Label>Cartão</Label>
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
            <SelectContent>
              {cards.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Cadastre um cartão primeiro.</div>}
              {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            O lançamento entrará na fatura conforme o fechamento do cartão. O saldo só será debitado quando a fatura for paga.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Switch checked={autoDebit} onCheckedChange={setAutoDebit} />
          <Label>Debitar automaticamente do saldo todo mês</Label>
        </div>
      )}

      <Button type="submit" className="w-full">Salvar</Button>
    </form>
  );
}

