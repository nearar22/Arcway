// Server-side persistence for the public order book.
// Backed by Firestore when service account is configured (production / Vercel).
// Falls back to a file-based JSON store for local dev without Firebase.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  CreateOrderInput,
  Order,
  UpdateOrderInput,
} from "./orderTypes";
import { firestore } from "./firebase";

const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const COLLECTION = "orders";

// ─── Helpers ──────────────────────────────────────────────────────────────

function orderToDoc(o: Order): Record<string, unknown> {
  // Firestore rejects `undefined`. Convert to null or omit.
  const doc: Record<string, unknown> = {
    id: o.id,
    maker: o.maker.toLowerCase(),
    sellToken: o.sellToken.toLowerCase(),
    sellAmount: o.sellAmount,
    buyToken: o.buyToken.toLowerCase(),
    buyAmount: o.buyAmount,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    memo: o.memo ?? null,
    taker: o.taker ? o.taker.toLowerCase() : null,
    takerTxHash: o.takerTxHash ?? null,
    makerTxHash: o.makerTxHash ?? null,
  };
  return doc;
}

function docToOrder(d: Record<string, unknown>): Order {
  return {
    id: d.id as string,
    maker: (d.maker as string).toLowerCase() as `0x${string}`,
    sellToken: (d.sellToken as string).toLowerCase() as `0x${string}`,
    sellAmount: d.sellAmount as string,
    buyToken: (d.buyToken as string).toLowerCase() as `0x${string}`,
    buyAmount: d.buyAmount as string,
    memo: (d.memo as string) || undefined,
    status: d.status as Order["status"],
    taker: (d.taker as string | null)
      ? ((d.taker as string).toLowerCase() as `0x${string}`)
      : undefined,
    takerTxHash: (d.takerTxHash as `0x${string}` | undefined) || undefined,
    makerTxHash: (d.makerTxHash as `0x${string}` | undefined) || undefined,
    createdAt: d.createdAt as number,
    updatedAt: d.updatedAt as number,
  };
}

// ─── File fallback (local dev) ─────────────────────────────────────────────

async function ensureFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(ORDERS_FILE);
  } catch {
    await fs.writeFile(ORDERS_FILE, "[]", "utf8");
  }
}

async function fileReadAll(): Promise<Order[]> {
  await ensureFile();
  const raw = await fs.readFile(ORDERS_FILE, "utf8");
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

async function fileWriteAll(orders: Order[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function listOrders(filter?: {
  status?: Order["status"];
  maker?: string;
  taker?: string;
}): Promise<Order[]> {
  const db = firestore();
  let result: Order[];
  if (db) {
    let ref: any = db.collection(COLLECTION);
    if (filter?.status) ref = ref.where("status", "==", filter.status);
    if (filter?.maker) ref = ref.where("maker", "==", filter.maker.toLowerCase());
    if (filter?.taker) ref = ref.where("taker", "==", filter.taker.toLowerCase());
    // No orderBy here: combining where + orderBy on a different field requires
    // composite indexes in Firestore. Sort client-side for simplicity.
    const snap = await ref.limit(500).get();
    result = snap.docs.map((doc: any) =>
      docToOrder(doc.data() as Record<string, unknown>),
    );
  } else {
    const all = await fileReadAll();
    result = all;
    if (filter?.status) result = result.filter((o) => o.status === filter.status);
    if (filter?.maker) {
      const m = filter.maker.toLowerCase();
      result = result.filter((o) => o.maker.toLowerCase() === m);
    }
    if (filter?.taker) {
      const t = filter.taker.toLowerCase();
      result = result.filter((o) => o.taker?.toLowerCase() === t);
    }
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrder(id: string): Promise<Order | null> {
  const db = firestore();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return docToOrder(snap.data()! as Record<string, unknown>);
  }
  const all = await fileReadAll();
  return all.find((o) => o.id === id) ?? null;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const now = Date.now();
  const order: Order = {
    id: nanoid(10),
    ...input,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  const db = firestore();
  if (db) {
    await db.collection(COLLECTION).doc(order.id).set(orderToDoc(order));
  } else {
    const all = await fileReadAll();
    all.push(order);
    await fileWriteAll(all);
  }
  return order;
}

export async function updateOrder(
  id: string,
  patch: UpdateOrderInput
): Promise<Order | null> {
  const db = firestore();
  if (db) {
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const cur = docToOrder(snap.data()! as Record<string, unknown>);
    const updated: Order = { ...cur, ...patch, updatedAt: Date.now() };
    await ref.update(orderToDoc(updated));
    return updated;
  }
  const all = await fileReadAll();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  const updated: Order = { ...all[idx], ...patch, updatedAt: Date.now() };
  all[idx] = updated;
  await fileWriteAll(all);
  return updated;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const db = firestore();
  if (db) {
    await db.collection(COLLECTION).doc(id).delete();
    return true;
  }
  const all = await fileReadAll();
  const next = all.filter((o) => o.id !== id);
  if (next.length === all.length) return false;
  await fileWriteAll(next);
  return true;
}
