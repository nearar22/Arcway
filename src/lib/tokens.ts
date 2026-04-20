// Token registry for the /p2p Trade tab.
// USDC is canonical Arc Testnet USDC. tARC and tUSDT are mock ERC20s
// deployed via scripts/deploy-token.ts (see contracts/MockToken.sol).
//
// Each token has: address, symbol, name, decimals, and a `mintable` flag
// indicating whether the public mint() faucet is available.

import { USDC_ADDRESS, USDC_DECIMALS } from "./arc";

export type Token = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  /** True if the contract exposes a public mint(to, amount) faucet. */
  mintable: boolean;
};

const TARC_ADDRESS = (process.env.NEXT_PUBLIC_TARC_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const TUSDT_ADDRESS = (process.env.NEXT_PUBLIC_TUSDT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const TOKENS: Token[] = [
  {
    address: USDC_ADDRESS,
    symbol: "USDC",
    name: "USD Coin",
    decimals: USDC_DECIMALS,
    mintable: false,
  },
  {
    address: TARC_ADDRESS,
    symbol: "tARC",
    name: "Test Arc Token",
    decimals: 18,
    mintable: true,
  },
  {
    address: TUSDT_ADDRESS,
    symbol: "tUSDT",
    name: "Test Tether USD",
    decimals: 18,
    mintable: true,
  },
];

export function findToken(address: string): Token | undefined {
  const a = address.toLowerCase();
  return TOKENS.find((t) => t.address.toLowerCase() === a);
}

export function tokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find((t) => t.symbol === symbol);
}

/** Format a raw on-chain amount as a human-readable decimal string. */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  if (frac === 0n) return `${negative ? "-" : ""}${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

/** Parse a human-readable decimal string into a raw on-chain amount. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/** Re-export the canonical ERC20 ABI. Includes mint() for mock test tokens. */
export { erc20Abi as ERC20_ABI } from "./erc20";
