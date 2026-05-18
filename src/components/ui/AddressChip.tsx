"use client";

// Copy-on-click address chip with monospace font and check icon feedback.

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn, shortAddress } from "@/lib/utils";

export function AddressChip({
  address,
  className,
  full = false,
}: {
  address: string;
  className?: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={address}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface/60 px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground",
        className,
      )}
    >
      <span>{full ? address : shortAddress(address)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      )}
    </button>
  );
}
