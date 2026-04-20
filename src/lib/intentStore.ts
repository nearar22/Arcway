// Simple in-memory store for pending intents and settlement batches.
// In production this would be a proper database (Postgres + Redis).
// For the hackathon demo, in-memory is fine since we want speed and simplicity.

import type { SignedIntent } from "./intent";

export type QueuedIntent = SignedIntent & {
  id: string;
  queuedAt: number;
  prompt: string;
  answer: string;
};

export type SettlementBatch = {
  id: string;
  txHash: `0x${string}`;
  intentIds: string[];
  totalAmount: bigint;
  settledAt: number;
  status: "pending" | "confirmed" | "failed";
  error?: string;
};

// Use a global singleton so hot-reload in dev doesn't reset state.
const globalKey = "__nanoai_store__" as const;
type Store = {
  pending: QueuedIntent[];
  settled: SettlementBatch[];
  totalQueries: number;
  totalVolume: bigint;
};

function getStore(): Store {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = {
      pending: [],
      settled: [],
      totalQueries: 0,
      totalVolume: 0n,
    } satisfies Store;
  }
  return g[globalKey] as Store;
}

export function addIntent(i: Omit<QueuedIntent, "id" | "queuedAt">): QueuedIntent {
  const store = getStore();
  const queued: QueuedIntent = {
    ...i,
    id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  };
  store.pending.push(queued);
  store.totalQueries += 1;
  store.totalVolume += i.intent.amount;
  return queued;
}

export function drainPending(): QueuedIntent[] {
  const store = getStore();
  const taken = store.pending.splice(0, store.pending.length);
  return taken;
}

export function recordSettlement(b: SettlementBatch) {
  const store = getStore();
  store.settled.unshift(b);
  // keep last 50 only
  if (store.settled.length > 50) store.settled.length = 50;
}

export function snapshot() {
  const store = getStore();
  return {
    pending: store.pending.slice().reverse(),
    settled: store.settled.slice(0, 20),
    totalQueries: store.totalQueries,
    totalVolume: store.totalVolume.toString(),
  };
}

// Used by nonce generator — not cryptographically tracked, just incremental
let nonceCounter = 0n;
export function nextNonce(): bigint {
  nonceCounter += 1n;
  return BigInt(Date.now()) * 1000n + nonceCounter;
}
