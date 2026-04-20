// LocalStorage-backed invoice store (MVP).
// For production, replace with an API + database.

export type InvoiceStatus = "pending" | "paid" | "expired";

export type Invoice = {
  id: string;
  merchant: `0x${string}`;
  amount: string; // human-readable USDC, e.g. "12.50"
  description: string;
  status: InvoiceStatus;
  createdAt: number; // epoch ms
  paidAt?: number;
  txHash?: `0x${string}`;
  payer?: `0x${string}`;
};

const KEY = "arc-pay:invoices";

function read(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Invoice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(invoices: Invoice[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(invoices));
  window.dispatchEvent(new CustomEvent("arc-pay:invoices-changed"));
}

export const invoiceStore = {
  list(): Invoice[] {
    return read().sort((a, b) => b.createdAt - a.createdAt);
  },
  get(id: string): Invoice | undefined {
    return read().find((i) => i.id === id);
  },
  create(input: Omit<Invoice, "id" | "createdAt" | "status">): Invoice {
    const invoices = read();
    const invoice: Invoice = {
      ...input,
      id: genId(),
      createdAt: Date.now(),
      status: "pending",
    };
    invoices.push(invoice);
    write(invoices);
    return invoice;
  },
  update(id: string, patch: Partial<Invoice>) {
    const invoices = read();
    const idx = invoices.findIndex((i) => i.id === id);
    if (idx === -1) return;
    invoices[idx] = { ...invoices[idx], ...patch };
    write(invoices);
  },
  remove(id: string) {
    write(read().filter((i) => i.id !== id));
  },
  subscribe(cb: () => void) {
    if (typeof window === "undefined") return () => {};
    const handler = () => cb();
    window.addEventListener("arc-pay:invoices-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("arc-pay:invoices-changed", handler);
      window.removeEventListener("storage", handler);
    };
  },
};

function genId() {
  // 10-char url-safe id
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  const bytes = new Uint8Array(10);
  (globalThis.crypto || (window as any).crypto).getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
