import Link from "next/link";

const PRODUCTS = [
  {
    idx: "01",
    name: "Merchant",
    tagline: "Invoices that close in a heartbeat.",
    desc: "Generate USDC checkout links. Customers scan, pay, settle in under a second on Arc Testnet.",
    href: "/dashboard",
    cta: "Open Merchant",
    Glyph: GlyphInvoice,
  },
  {
    idx: "02",
    name: "Peer-to-peer",
    tagline: "Send and request, no friction.",
    desc: "Pay any wallet directly, or share a request link. QR codes, history, instant confirmation.",
    href: "/p2p",
    cta: "Open P2P",
    Glyph: GlyphP2P,
  },
  {
    idx: "03",
    name: "NanoAI",
    tagline: "Pay-per-query, gasless.",
    desc: "x402 protocol with EIP-712 intents. Sign off-chain, batched on-chain settlement. $0.001 per query.",
    href: "/ask",
    cta: "Open NanoAI",
    Glyph: GlyphAtom,
  },
] as const;

const SPECS: Array<[string, string, string]> = [
  ["Finality", "< 1 second", "Malachite consensus, no reorgs"],
  ["Native gas", "USDC", "no ETH, no wrapping"],
  ["Per query", "$0.001", "via x402 + EIP-712 intents"],
  ["Vs. Ethereum", "~$2.50 / tx", "what gasless saves you, per call"],
  ["EVM compat", "100%", "MetaMask, viem, wagmi, Solidity"],
];

export default function Home() {
  return (
    <div className="space-y-28">
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="pt-4 pb-2">
        <div className="flex items-center gap-2 mb-10 animate-fade-up">
          <span className="relative inline-flex h-2 w-2">
            <span aria-hidden className="absolute inset-0 rounded-full bg-brand-400 animate-glow-pulse" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Live · Arc Testnet · Chain 5042002
          </span>
        </div>

        <h1 className="font-medium leading-[0.96] tracking-[-0.04em] text-[clamp(2.4rem,6.6vw,4.9rem)] max-w-[16ch] text-[var(--text-primary)]">
          <span className="reveal-line">
            <span className="block animate-reveal">Stablecoin payments</span>
          </span>
          <span className="reveal-line">
            <span
              className="block animate-reveal text-[var(--text-tertiary)]"
              style={{ animationDelay: "120ms" }}
            >
              built for the next second.
            </span>
          </span>
        </h1>

        <p
          className="mt-7 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)] animate-fade-up"
          style={{ animationDelay: "320ms" }}
        >
          USDC on Arc Network. Send peer-to-peer, accept checkout payments,
          meter AI per query. Everything settles in under a second.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center gap-3 animate-fade-up"
          style={{ animationDelay: "440ms" }}
        >
          <Link
            href="/p2p"
            className="lift group inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-400 px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.7)]"
          >
            Send USDC
            <span aria-hidden className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href="/ask"
            className="lift inline-flex items-center gap-2 rounded-md border border-[var(--border-strong)] hover:border-brand-400/50 hover:bg-white/[0.02] px-5 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white"
          >
            Try NanoAI
          </Link>
          <span className="hidden md:inline-flex font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] ml-2">
            ↳ ~ &lt; 1s finality
          </span>
        </div>
      </section>

      {/* ─── PRODUCT GRID ─────────────────────────────────────── */}
      <section
        className="grid lg:grid-cols-3 gap-x-10 gap-y-14 animate-fade-up"
        style={{ animationDelay: "560ms" }}
      >
        {PRODUCTS.map((p) => (
          <article key={p.idx} className="group">
            <div className="mb-7 h-11 w-11 text-brand-300 transition-all duration-500 ease-out group-hover:text-brand-400 group-hover:-translate-y-0.5">
              <p.Glyph />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
              <span className="text-brand-400/70">{p.idx}</span>
              <span className="mx-2 text-[var(--text-faint)]">/</span>
              {p.name}
            </p>
            <h2 className="mt-2.5 font-medium text-[19px] leading-[1.25] tracking-[-0.012em] text-[var(--text-primary)]">
              {p.tagline}
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-tertiary)]">
              {p.desc}
            </p>
            <Link
              href={p.href}
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-300 hover:text-brand-200 transition-colors group/link"
            >
              {p.cta}
              <span aria-hidden className="transition-transform duration-200 group-hover/link:translate-x-1">
                →
              </span>
            </Link>
          </article>
        ))}
      </section>

      {/* ─── SPEC TABLE ──────────────────────────────────────── */}
      <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="grid lg:grid-cols-[280px_1fr] gap-x-14 gap-y-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Specifications
            </p>
            <h2 className="mt-3 font-medium text-[26px] leading-[1.12] tracking-[-0.02em]">
              Built on Arc. A chain native to USDC.
            </h2>
          </div>
          <dl>
            {SPECS.map(([k, v, sub], i) => (
              <div
                key={k}
                className={`grid grid-cols-[1fr_auto] sm:grid-cols-[160px_1fr_auto] items-baseline gap-x-6 py-3.5 border-t border-[var(--border-subtle)] ${
                  i === SPECS.length - 1 ? "border-b" : ""
                }`}
              >
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  {k}
                </dt>
                <dd className="hidden sm:block text-[12px] text-[var(--text-faint)]">
                  {sub}
                </dd>
                <dd className="font-mono text-[14px] text-[var(--text-primary)] text-right tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ─── FLOW (NanoAI x402) ──────────────────────────────── */}
      <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="grid lg:grid-cols-[1fr_400px] gap-x-12 gap-y-8 items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Protocol · x402
            </p>
            <h2 className="mt-3 font-medium text-[26px] leading-[1.12] tracking-[-0.02em] max-w-[18ch]">
              How a gasless query finalizes.
            </h2>
            <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-[var(--text-tertiary)]">
              The server returns HTTP 402, the client signs an EIP-712 intent
              off-chain, retries with the <code className="text-[12px] bg-white/[0.05] border border-[var(--border)] px-1 py-px rounded text-brand-300">X-PAYMENT</code>{" "}
              header. The response is served instantly. Settlement is batched:
              one on-chain transaction for hundreds of queries.
            </p>
          </div>

          <ol className="space-y-0">
            {[
              ["1", "Request resource", "POST /api/ask"],
              ["2", "Receive 402", "Payment Required"],
              ["3", "Sign intent", "Off-chain, zero gas"],
              ["4", "Retry w/ X-PAYMENT", "Signed authorization"],
              ["5", "Resource served", "Settlement queued"],
            ].map(([n, label, detail], i, a) => (
              <li key={n} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="h-6 w-6 rounded-full border border-[var(--border-strong)] bg-white/[0.02] grid place-items-center font-mono text-[10px] font-medium text-[var(--text-tertiary)] shrink-0">
                    {n}
                  </span>
                  {i < a.length - 1 && (
                    <div className="w-px flex-1 bg-gradient-to-b from-[var(--border-strong)] to-transparent min-h-[14px]" />
                  )}
                </div>
                <div className="pb-4 -mt-0.5">
                  <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                    {label}
                  </p>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-faint)] mt-1">
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border-subtle)] pt-14 pb-2 text-center animate-fade-up">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
          Ready when you are
        </p>
        <h2 className="mt-3 font-medium text-[26px] tracking-[-0.02em]">
          Connect a wallet to begin.
        </h2>
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <Link
            href="/dashboard"
            className="lift group inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-400 px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.7)]"
          >
            Open Merchant
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer"
            className="lift inline-flex items-center gap-2 rounded-md border border-[var(--border-strong)] hover:border-brand-400/50 px-5 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white"
          >
            Faucet ↗
          </a>
        </div>
      </section>
    </div>
  );
}

// ─── Geometric glyphs (custom inline SVG, no icon library) ─────────────────

function GlyphInvoice() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <rect x="9" y="6" width="24" height="34" rx="1.5" />
      <line x1="14" y1="14" x2="28" y2="14" />
      <line x1="14" y1="20" x2="28" y2="20" />
      <line x1="14" y1="26" x2="22" y2="26" />
      <circle cx="36" cy="34" r="6.5" className="fill-brand-500/15 stroke-brand-400" />
      <path d="M33.5 34 L35.5 36 L38.5 32" className="stroke-brand-300" strokeWidth="1.4" />
    </svg>
  );
}

function GlyphP2P() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <circle cx="12" cy="14" r="6" />
      <circle cx="36" cy="34" r="6" className="fill-brand-500/15 stroke-brand-400" />
      <path d="M16.5 18.5 L31.5 29.5" />
      <path d="M27 17 L32 17 L32 22" className="stroke-brand-300" />
      <path d="M21 31 L16 31 L16 26" className="stroke-brand-300" />
    </svg>
  );
}

function GlyphAtom() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-full w-full">
      <circle cx="24" cy="24" r="2.5" className="fill-brand-400 stroke-brand-400" />
      <ellipse cx="24" cy="24" rx="17" ry="6.5" />
      <ellipse cx="24" cy="24" rx="17" ry="6.5" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="17" ry="6.5" transform="rotate(-60 24 24)" />
    </svg>
  );
}
