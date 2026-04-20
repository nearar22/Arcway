import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Link from "next/link";

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
  title: "Arc Pay · Stablecoin payments on Arc",
  description:
    "USDC checkout, peer-to-peer transfers, and pay-per-query AI on Arc Network. Sub-second finality, USDC-native gas.",
};

const NAV = [
  { href: "/dashboard", label: "Merchant" },
  { href: "/p2p", label: "P2P" },
  { href: "/ask", label: "NanoAI" },
  { href: "/faucet", label: "Faucet" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(10,10,10,0.72)] backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-5 py-3.5 flex items-center justify-between">
              <Link href="/" className="group flex items-center gap-2.5">
                <span className="relative inline-grid h-7 w-7 place-items-center rounded-[7px] bg-gradient-to-br from-brand-500 to-brand-700">
                  <span aria-hidden className="absolute inset-0 rounded-[7px] bg-brand-500/40 blur-md transition-colors duration-300 group-hover:bg-brand-400/60" />
                  <span className="relative font-mono text-[10px] font-semibold tracking-tight text-white">Arc</span>
                </span>
                <span className="font-medium tracking-tight text-[14px]">Pay</span>
                <span className="hidden sm:inline-block ml-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
                  testnet
                </span>
              </Link>
              <nav className="flex items-center gap-0.5 text-[13px]">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 rounded-md text-[var(--text-tertiary)] hover:text-white hover:bg-white/[0.03] transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://docs.arc.network"
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[var(--text-tertiary)] hover:text-white transition-colors duration-200"
                >
                  Docs <span aria-hidden className="text-[10px]">↗</span>
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">{children}</main>
          <footer className="mt-24 border-t border-[var(--border-subtle)]">
            <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap items-center gap-4 justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
              <span>Arc Testnet / Chain 5042002</span>
              <a
                className="hover:text-white/70 transition-colors"
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noreferrer"
              >
                Faucet ↗
              </a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
