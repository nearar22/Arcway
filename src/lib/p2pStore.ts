// LocalStorage-backed P2P store: send history + payment requests.
// Mirrors invoiceStore (src/lib/storage.ts) — same id/subscribe pattern.

export type P2PSend = {
  id: string;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;        // human-readable USDC, e.g. "5.00"
  memo: string;
  txHash: `0x${string}`;
  at: number;
};

export type P2PRequestStatus = "pending" | "paid";

export type P2PRequest = {
  id: string;
  recipient: `0x${string}`;     // who is asking to be paid
  amount: string;
  memo: string;
  status: P2PRequestStatus;
  createdAt: number;
  paidAt?: number;
  txHash?: `0x${string}`;
  payer?: `0x${string}`;
};

const SENDS_KEY = "arc-pay:p2p-sends";
const REQUESTS_KEY = "arc-pay:p2p-requests";
const EVENT_SENDS = "arc-pay:p2p-sends-changed";
const EVENT_REQUESTS = "arc-pay:p2p-requests-changed";

function readArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArr<T>(key: string, event: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(event));
}

function genId() {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  const bytes = new Uint8Array(10);
  (globalThis.crypto || (window as any).crypto).getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// ─── Sends ───────────────────────────────────────────────────────────────

export const sendsStore = {
  list(): P2PSend[] {
    return readArr<P2PSend>(SENDS_KEY).sort((a, b) => b.at - a.at);
  },
  listFor(addr?: `0x${string}`): P2PSend[] {
    if (!addr) return [];
    const a = addr.toLowerCase();
    return this.list().filter(
      (s) => s.from.toLowerCase() === a || s.to.toLowerCase() === a
    );
  },
  add(input: Omit<P2PSend, "id" | "at">): P2PSend {
    const all = readArr<P2PSend>(SENDS_KEY);
    const send: P2PSend = { ...input, id: genId(), at: Date.now() };
    all.push(send);
    // keep last 200
    const trimmed = all.slice(-200);
    writeArr(SENDS_KEY, EVENT_SENDS, trimmed);
    return send;
  },
  subscribe(cb: () => void) {
    if (typeof window === "undefined") return () => {};
    const handler = () => cb();
    window.addEventListener(EVENT_SENDS, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_SENDS, handler);
      window.removeEventListener("storage", handler);
    };
  },
};

// ─── Requests ────────────────────────────────────────────────────────────

export const requestsStore = {
  list(): P2PRequest[] {
    return readArr<P2PRequest>(REQUESTS_KEY).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  },
  listFor(addr?: `0x${string}`): P2PRequest[] {
    if (!addr) return [];
    const a = addr.toLowerCase();
    return this.list().filter((r) => r.recipient.toLowerCase() === a);
  },
  get(id: string): P2PRequest | undefined {
    return readArr<P2PRequest>(REQUESTS_KEY).find((r) => r.id === id);
  },
  create(input: Omit<P2PRequest, "id" | "createdAt" | "status">): P2PRequest {
    const all = readArr<P2PRequest>(REQUESTS_KEY);
    const req: P2PRequest = {
      ...input,
      id: genId(),
      createdAt: Date.now(),
      status: "pending",
    };
    all.push(req);
    writeArr(REQUESTS_KEY, EVENT_REQUESTS, all);
    return req;
  },
  update(id: string, patch: Partial<P2PRequest>) {
    const all = readArr<P2PRequest>(REQUESTS_KEY);
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...patch };
    writeArr(REQUESTS_KEY, EVENT_REQUESTS, all);
  },
  remove(id: string) {
    writeArr(
      REQUESTS_KEY,
      EVENT_REQUESTS,
      readArr<P2PRequest>(REQUESTS_KEY).filter((r) => r.id !== id)
    );
  },
  subscribe(cb: () => void) {
    if (typeof window === "undefined") return () => {};
    const handler = () => cb();
    window.addEventListener(EVENT_REQUESTS, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_REQUESTS, handler);
      window.removeEventListener("storage", handler);
    };
  },
};
