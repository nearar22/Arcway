// Store for pending intents and settlement batches.
// Backed by Firestore when service account is configured (production / Vercel).
// Falls back to in-memory storage for local dev without Firebase.

import "server-only";
import type { SignedIntent } from "./intent";
import { firestore } from "./firebase";

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

// ─── In-memory fallback (dev / no Firebase) ───────────────────────────────

const globalKey = "__nanoai_store__" as const;
type MemStore = {
  pending: QueuedIntent[];
  settled: SettlementBatch[];
  totalQueries: number;
  totalVolume: bigint;
};

function memStore(): MemStore {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = {
      pending: [],
      settled: [],
      totalQueries: 0,
      totalVolume: 0n,
    } satisfies MemStore;
  }
  return g[globalKey] as MemStore;
}

// ─── Firestore (de)serialization helpers ──────────────────────────────────

type IntentDoc = {
  id: string;
  queuedAt: number;
  prompt: string;
  answer: string;
  signature: string;
  promptHash: string;
  intent: {
    payer: string;
    payee: string;
    token: string;
    amount: string;
    nonce: string;
    deadline: string;
    serviceId: string;
  };
};

function toDoc(q: QueuedIntent): IntentDoc {
  return {
    id: q.id,
    queuedAt: q.queuedAt,
    prompt: q.prompt,
    answer: q.answer,
    signature: q.signature,
    promptHash: q.promptHash,
    intent: {
      payer: q.intent.payer,
      payee: q.intent.payee,
      token: q.intent.token,
      amount: q.intent.amount.toString(),
      nonce: q.intent.nonce.toString(),
      deadline: q.intent.deadline.toString(),
      serviceId: q.intent.serviceId,
    },
  };
}

function fromDoc(d: IntentDoc): QueuedIntent {
  return {
    id: d.id,
    queuedAt: d.queuedAt,
    prompt: d.prompt,
    answer: d.answer,
    signature: d.signature as `0x${string}`,
    promptHash: d.promptHash as `0x${string}`,
    intent: {
      payer: d.intent.payer as `0x${string}`,
      payee: d.intent.payee as `0x${string}`,
      token: d.intent.token as `0x${string}`,
      amount: BigInt(d.intent.amount),
      nonce: BigInt(d.intent.nonce),
      deadline: BigInt(d.intent.deadline),
      serviceId: d.intent.serviceId as `0x${string}`,
    },
  };
}

type BatchDoc = Omit<SettlementBatch, "totalAmount"> & { totalAmount: string };

const PENDING = "intents_pending";
const SETTLED = "intents_settled";
const STATS_DOC = "stats/nanoai";

// ─── Public API ───────────────────────────────────────────────────────────

export async function addIntent(
  i: Omit<QueuedIntent, "id" | "queuedAt">
): Promise<QueuedIntent> {
  const queued: QueuedIntent = {
    ...i,
    id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  };

  const db = firestore();
  if (db) {
    try {
      await db.collection(PENDING).doc(queued.id).set(toDoc(queued));
      const statsRef = db.doc(STATS_DOC);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(statsRef);
        const cur = snap.exists ? snap.data()! : { totalQueries: 0, totalVolume: "0" };
        tx.set(statsRef, {
          totalQueries: (cur.totalQueries ?? 0) + 1,
          totalVolume: (BigInt(cur.totalVolume ?? "0") + i.intent.amount).toString(),
        });
      });
      console.log("[intentStore] addIntent OK", queued.id);
    } catch (err) {
      console.error("[intentStore] addIntent FAILED:", err);
      throw err;
    }
  } else {
    console.warn("[intentStore] no Firestore — using in-memory fallback");
    const s = memStore();
    s.pending.push(queued);
    s.totalQueries += 1;
    s.totalVolume += i.intent.amount;
  }
  return queued;
}

export async function drainPending(): Promise<QueuedIntent[]> {
  const db = firestore();
  if (db) {
    const snap = await db.collection(PENDING).get();
    if (snap.empty) return [];
    const docs = snap.docs;
    const items = docs.map((d) => fromDoc(d.data() as IntentDoc));
    // batch-delete
    const batch = db.batch();
    docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return items;
  }
  const s = memStore();
  return s.pending.splice(0, s.pending.length);
}

export async function recordSettlement(b: SettlementBatch): Promise<void> {
  const db = firestore();
  if (db) {
    const doc: BatchDoc = { ...b, totalAmount: b.totalAmount.toString() };
    await db.collection(SETTLED).doc(b.id).set(doc);
    return;
  }
  const s = memStore();
  s.settled.unshift(b);
  if (s.settled.length > 50) s.settled.length = 50;
}

export async function snapshot(): Promise<{
  pending: QueuedIntent[];
  settled: SettlementBatch[];
  totalQueries: number;
  totalVolume: string;
}> {
  const db = firestore();
  if (db) {
    const [pendSnap, settSnap, statsSnap] = await Promise.all([
      db.collection(PENDING).orderBy("queuedAt", "desc").limit(50).get(),
      db.collection(SETTLED).orderBy("settledAt", "desc").limit(20).get(),
      db.doc(STATS_DOC).get(),
    ]);
    const pending = pendSnap.docs.map((d) => fromDoc(d.data() as IntentDoc));
    const settled = settSnap.docs.map((d) => {
      const x = d.data() as BatchDoc;
      return { ...x, totalAmount: BigInt(x.totalAmount) } as SettlementBatch;
    });
    const stats = statsSnap.exists
      ? (statsSnap.data() as { totalQueries: number; totalVolume: string })
      : { totalQueries: 0, totalVolume: "0" };
    return {
      pending,
      settled,
      totalQueries: stats.totalQueries ?? 0,
      totalVolume: stats.totalVolume ?? "0",
    };
  }
  const s = memStore();
  return {
    pending: s.pending.slice().reverse(),
    settled: s.settled.slice(0, 20),
    totalQueries: s.totalQueries,
    totalVolume: s.totalVolume.toString(),
  };
}

// Nonce — process-local counter is fine; collisions unlikely given timestamp prefix.
let nonceCounter = 0n;
export function nextNonce(): bigint {
  nonceCounter += 1n;
  return BigInt(Date.now()) * 1000n + nonceCounter;
}
