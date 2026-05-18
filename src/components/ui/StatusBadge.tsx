// Reusable status pill used across orders, intents, settlements.
// Variants map to semantic colors (success / warning / muted / primary).

import { cn } from "@/lib/utils";

export type Status =
  | "open"
  | "paid"
  | "expired"
  | "pending"
  | "filled"
  | "cancelled"
  | "settled"
  | "queued"
  | "failed";

const styles: Record<Status, { dot: string; text: string; ring: string }> = {
  open: { dot: "bg-primary", text: "text-primary", ring: "ring-primary/20" },
  paid: { dot: "bg-success", text: "text-success", ring: "ring-success/20" },
  settled: { dot: "bg-success", text: "text-success", ring: "ring-success/20" },
  filled: { dot: "bg-success", text: "text-success", ring: "ring-success/20" },
  expired: { dot: "bg-muted-foreground", text: "text-muted-foreground", ring: "ring-white/10" },
  cancelled: { dot: "bg-muted-foreground", text: "text-muted-foreground", ring: "ring-white/10" },
  pending: { dot: "bg-warning", text: "text-warning", ring: "ring-warning/20" },
  queued: { dot: "bg-warning", text: "text-warning", ring: "ring-warning/20" },
  failed: { dot: "bg-destructive", text: "text-destructive", ring: "ring-destructive/20" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const s = styles[status];
  const animated = status === "pending" || status === "queued";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset",
        s.text,
        s.ring,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          s.dot,
          animated && "animate-pulse-glow",
        )}
      />
      {status}
    </span>
  );
}
