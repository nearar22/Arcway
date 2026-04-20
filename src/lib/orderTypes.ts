// Shared types for the public P2P order book.
// Used by both the API (server) and the client.

export type OrderStatus = "open" | "pending" | "filled" | "cancelled";

export type Order = {
  id: string;
  maker: `0x${string}`;
  /** Token contract maker is selling (giving away). */
  sellToken: `0x${string}`;
  /** Raw on-chain amount (bigint as decimal string) for sellToken. */
  sellAmount: string;
  /** Token contract maker wants to receive. */
  buyToken: `0x${string}`;
  /** Raw on-chain amount (bigint as decimal string) for buyToken. */
  buyAmount: string;
  memo?: string;

  status: OrderStatus;
  /** Address that claimed the order (taker). */
  taker?: `0x${string}`;
  /** Tx hash where taker sent buyToken to maker. */
  takerTxHash?: `0x${string}`;
  /** Tx hash where maker sent sellToken to taker. */
  makerTxHash?: `0x${string}`;

  createdAt: number;
  updatedAt: number;
};

export type CreateOrderInput = Pick<
  Order,
  "maker" | "sellToken" | "sellAmount" | "buyToken" | "buyAmount" | "memo"
>;

export type UpdateOrderInput = Partial<
  Pick<Order, "status" | "taker" | "takerTxHash" | "makerTxHash">
>;
