import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Link from "next/link";
import { MeshBackground } from "@/components/ui/MeshBackground";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Arcway · Stablecoin payments built for the next second",
  description:
    "USDC-native payments on Arc. Issue invoices, settle P2P, run pay-per-query AI with x402. Sub-second finality, gasless.",
};

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/p2p", label: "P2P" },
  { href: "/ask", label: "Ask" },
  { href: "/faucet", label: "Faucet" },
];

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient
          id="arcway-logo"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9B7CFF" />
          <stop offset="1" stopColor="#5A3DFF" />
        </linearGradient>
      </defs>
      <path
        d="M6 24 C 6 12, 26 12, 26 24"
        stroke="url(#arcway-logo)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="26" cy="24" r="2.5" fill="url(#arcway-logo)" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <MeshBackground />
          <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgba(10,10,10,0.72)] backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="group flex items-center gap-2">
                  <Logo />
                  <span className="text-sm font-semibold tracking-tight">
                    Arcway
                  </span>
                  <span className="hidden sm:inline-flex rounded-full border border-white/10 bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Testnet
                  </span>
                </Link>
                <nav className="hidden md:flex items-center gap-1 text-sm">
                  {NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-surface/60 hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <a
                href="https://github.com/nearar22/Arcway"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
              >
                GitHub <span aria-hidden className="text-[10px]">↗</span>
              </a>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
            {children}
          </main>
          <footer className="mt-24 border-t border-white/[0.04]">
            <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center gap-4 justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              <span>Arc Testnet · Chain 5042002</span>
              <div className="flex items-center gap-5">
                <a
                  className="hover:text-foreground/70 transition-colors"
                  href="https://testnet.arcscan.app"
                  target="_blank"
                  rel="noreferrer"
                >
                  Arcscan ↗
                </a>
                <a
                  className="hover:text-foreground/70 transition-colors"
                  href="https://github.com/nearar22/Arcway"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub ↗
                </a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
