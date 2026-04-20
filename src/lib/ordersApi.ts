// Client-side fetch helpers for the public order book API.
// Server source: src/app/api/orders/route.ts

import type {
  CreateOrderInput,
  Order,
  OrderStatus,
} from "./orderTypes";

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchOrders(filter?: {
  status?: OrderStatus;
  maker?: string;
  taker?: string;
}): Promise<Order[]> {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.maker) params.set("maker", filter.maker);
  if (filter?.taker) params.set("taker", filter.taker);
  const qs = params.toString();
  const { orders } = await jsonFetch<{ orders: Order[] }>(
    `/api/orders${qs ? `?${qs}` : ""}`,
  );
  return orders;
}

export async function fetchOrder(id: string): Promise<Order> {
  const { order } = await jsonFetch<{ order: Order }>(`/api/orders/${id}`);
  return order;
}

export async function createOrderApi(input: CreateOrderInput): Promise<Order> {
  const { order } = await jsonFetch<{ order: Order }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return order;
}

export async function takeOrderApi(
  id: string,
  args: { taker: `0x${string}`; takerTxHash: `0x${string}` },
): Promise<Order> {
  const { order } = await jsonFetch<{ order: Order }>(`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "pending",
      taker: args.taker,
      takerTxHash: args.takerTxHash,
      caller: args.taker,
    }),
  });
  return order;
}

export async function fulfillOrderApi(
  id: string,
  args: { caller: `0x${string}`; makerTxHash: `0x${string}` },
): Promise<Order> {
  const { order } = await jsonFetch<{ order: Order }>(`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "filled",
      makerTxHash: args.makerTxHash,
      caller: args.caller,
    }),
  });
  return order;
}

export async function cancelOrderApi(
  id: string,
  caller: `0x${string}`,
): Promise<Order> {
  const { order } = await jsonFetch<{ order: Order }>(`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", caller }),
  });
  return order;
}
