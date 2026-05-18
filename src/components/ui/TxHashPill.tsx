// Transaction hash pill linking to Arcscan explorer.

import { ExternalLink } from "lucide-react";
import { EXPLORER } from "@/lib/arc";
import { cn } from "@/lib/utils";

function shortHash(hash: string) {
  if (!hash) return "";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function TxHashPill({
  hash,
  className,
}: {
  hash: string;
  className?: string;
}) {
  return (
    <a
      href={`${EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-surface/60 px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <span>{shortHash(hash)}</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
