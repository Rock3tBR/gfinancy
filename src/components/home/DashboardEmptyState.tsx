import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WalletCards } from "lucide-react";

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function DashboardEmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border bg-card shadow-sm">
      <CardContent className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <WalletCards className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        {actionLabel && (
          <Button type="button" className="mt-6 rounded-2xl" onClick={onAction}>{actionLabel}</Button>
        )}
      </CardContent>
    </Card>
  );
}
