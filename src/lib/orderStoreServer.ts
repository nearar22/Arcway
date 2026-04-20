// Server-side persistence for the public order book.
// File-based JSON store at `data/orders.json`. Simple, no DB required.
//
// In production (serverless deploys with read-only FS), replace with a real
// store (Vercel KV, Postgres, etc). For local demo this works perfectly.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  CreateOrderInput,
  Order,
  UpdateOrderInput,
} from "./orderTypes";

const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(ORDERS_FILE);
  } catch {
    await fs.writeFile(ORDERS_FILE, "[]", "utf8");
  }
}

async function readAll(): Promise<Order[]> {
  await ensureFile();
  const raw = await fs.readFile(ORDERS_FILE, "utf8");
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

async function writeAll(orders: Order[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function listOrders(filter?: {
  status?: Order["status"];
  maker?: string;
  taker?: string;
}): Promise<Order[]> {
  const all = await readAll();
  let result = all;
  if (filter?.status) result = result.filter((o) => o.status === filter.status);
  if (filter?.maker) {
    const m = filter.maker.toLowerCase();
    result = result.filter((o) => o.maker.toLowerCase() === m);
  }
  if (filter?.taker) {
    const t = filter.taker.toLowerCase();
    result = result.filter((o) => o.taker?.toLowerCase() === t);
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const all = await readAll();
  const now = Date.now();
  const order: Order = {
    id: nanoid(10),
    ...input,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  all.push(order);
  await writeAll(all);
  return order;
}

export async function updateOrder(
  id: string,
  patch: UpdateOrderInput,
): Promise<Order | null> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  const updated: Order = { ...all[idx], ...patch, updatedAt: Date.now() };
  all[idx] = updated;
  await writeAll(all);
  return updated;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((o) => o.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
