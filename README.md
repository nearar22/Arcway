# Arc Pay — Stablecoin payments on Arc Network

A complete USDC payments stack on [Arc Network](https://arc.network) testnet:
merchant checkout, peer-to-peer transfers, AI pay-per-query, and a public
P2P trade order book — all settling in **&lt; 1 second** with **USDC-native gas**.

---

## What's inside

### `/dashboard` — Merchant checkout
Connect a wallet, create invoices (amount + description), share a `/pay/[id]`
checkout link with QR code. Customer pays with one click. Settles in &lt; 1s
with a real `transfer()` on-chain.

### `/p2p` — Peer-to-peer (4 tabs)
- **Trade** — public order book, Binance-P2P style. Post a swap order
  ("Sell 100 USDC, want 50 tARC"); anyone can take it. Backed by a shared
  server store (`data/orders.json` + `/api/orders`).
- **Send** — direct USDC transfer to any address.
- **Request** — generate a `/p2p/req/[id]` payment link anyone can pay.
- **Activity** — your local sent/received history.

### `/ask` — NanoAI (pay-per-query)
LLM chat with x402 micropayments. Each request signs an EIP-712 intent for
USDC and the server batches `transferFrom()` calls during settlement
(`/api/settle`). Demo for streaming sub-cent payments.

### `/faucet` — Test token faucet
- USDC → external link to Circle's faucet (gas token)
- tARC + tUSDT → on-chain `mint()` claim, free 10,000 per click

---

## Arc Testnet info

| Field | Value |
|---|---|
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| USDC (gas token) | `0x3600000000000000000000000000000000000000` |
| Explorer | https://testnet.arcscan.app |
| USDC faucet | https://faucet.circle.com/ |

### Mock test tokens (deployed for this demo)

| Symbol | Name | Address |
|---|---|---|
| tARC | Test Arc Token | `0x1a747a8bee63240a6a8724126210165770158ee3` |
| tUSDT | Test Tether USD | `0xc40a7e3b75fc4a2f8cfa50ce0912391354b6ce5d` |

Both expose a public `mint(to, amount)` (max 10k per call) so anyone can
fund themselves to test the Trade tab. Source: `contracts/MockToken.sol`.

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```

Fill `.env.local`:

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_TREASURY_ADDRESS` | ✅ | Wallet that receives NanoAI USDC + signs settlements |
| `BATCHER_PRIVATE_KEY` | optional | Server-side key that submits batched `transferFrom`. Leave blank for DEMO mode (fake tx hashes) |
| `LLM_API_KEY` | for `/ask` | OpenAI-compatible. Recommended: free Groq key |
| `LLM_BASE_URL`, `LLM_MODEL` | for `/ask` | Defaults to Groq's Llama 3.3 70B |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | MetaMask works without it |
| `NEXT_PUBLIC_TARC_ADDRESS`, `NEXT_PUBLIC_TUSDT_ADDRESS` | ✅ for Trade | Set automatically by `npm run deploy:tokens`, or use the addresses above |

### 3. Add Arc Testnet to MetaMask

| Field | Value |
|---|---|
| Network Name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency Symbol | `USDC` |
| Block Explorer | `https://testnet.arcscan.app` |

### 4. Get USDC for gas
Visit [faucet.circle.com](https://faucet.circle.com/) — 10 USDC per day, free.

### 5. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## NPM scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` / `start` | Production build & serve |
| `npm run lint` | Next.js ESLint |
| `npm run deploy:tokens` | Compile `MockToken.sol` and deploy tARC + tUSDT |
| `npm run mint:tokens [address]` | Mint 10k tARC + 10k tUSDT to an address (defaults to deployer) |

The deploy script uses **solc-js** to compile in-process and **viem** to
deploy — no Hardhat / Foundry required.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js App Router                          │
├─────────────────────────────────────────────────────────────────────┤
│  /dashboard  /p2p  /ask  /faucet  /pay/[id]  /p2p/req/[id]          │
└──────────┬──────────┬──────────┬──────────┬─────────────────────────┘
           │          │          │          │
       wagmi/viem  /api/orders /api/ask  /api/settle  /api/queue
       MetaMask    (file:      (x402 +   (batch         (poll
                    orders.json)  EIP-712) transferFrom)  intents)
                                                │
                              ┌─────────────────┴────────────────┐
                              │   Arc Testnet (chain 5042002)    │
                              │   USDC · tARC · tUSDT contracts  │
                              └──────────────────────────────────┘
```

### State stores

| Store | Scope | Source |
|---|---|---|
| `src/lib/storage.ts` | Browser localStorage | Merchant invoices |
| `src/lib/p2pStore.ts` | Browser localStorage | P2P sends + requests |
| `src/lib/intentStore.ts` | Server in-memory | NanoAI intent queue |
| `src/lib/orderStoreServer.ts` | Server JSON file (`data/orders.json`) | Public trade order book |

The order book is the only **shared** store — it's intentionally backed
by a server file so all wallets/browsers see the same orders. localStorage
stores stay per-browser by design (private invoice / sends history).

### Trade settlement flow (no escrow contract)

1. **Maker** posts order → status `open`. No funds locked.
2. **Taker** clicks Take → wallet sends buy-side tokens to maker → status `pending`.
3. **Maker** sees "Action required" → clicks Fulfill → wallet sends sell-side tokens to taker → status `filled`.

Trust caveat: taker pays first. Production should use an escrow contract
that atomically swaps both sides — listed under TODO.

---

## Tech stack

- **Next.js 14** App Router (RSC + API routes)
- **wagmi v2 + viem v2** — wallet & contract interaction
- **RainbowKit v2** — connect-wallet UI
- **TailwindCSS + lucide-react** — styling & icons
- **solc-js + tsx + dotenv** — contract compile/deploy scripts
- **nanoid** — short order/invoice IDs
- **qrcode.react** — checkout QR codes

---

## Project layout

```
contracts/
  MockToken.sol            Free-mint ERC20 for Trade demo
scripts/
  deploy-token.ts          Compile + deploy tARC, tUSDT
  mint-tokens.ts           CLI faucet (alternative to /faucet UI)
src/
  app/                     Pages + API routes
    api/
      orders/              Public order book (GET, POST, PATCH, DELETE)
      ask/                 NanoAI x402 endpoint
      settle/              Batched transferFrom settlement
      queue/               Intent queue snapshot
    dashboard/  pay/[id]/  Merchant checkout
    p2p/        p2p/req/   P2P transfers + Trade tab
    ask/                   NanoAI chat
    faucet/                Test token faucet
  components/
    trade/                 CreateOrderForm · OrderBook · MyOrders
    TokenFaucet.tsx        Reusable mint widget
    ...                    PayButton, TransferButton, NetworkGuard, etc.
  lib/
    arc.ts                 Chain definition + USDC constants
    erc20.ts               Canonical ERC20 ABI (transfer/approve/mint/...)
    tokens.ts              Token registry + amount helpers
    orderTypes.ts          Shared order schema (client + server)
    orderStoreServer.ts    JSON file persistence (server only)
    ordersApi.ts           Client fetch helpers
    intent.ts / intentStore.ts / x402.ts / llm.ts   NanoAI plumbing
    storage.ts / p2pStore.ts                        localStorage stores
data/
  orders.json              Created on first POST. Gitignored.
```

---

## Known limitations / TODO

- Trade flow is trust-required (taker pays first). **Add an `EscrowSwap.sol`** for atomic settlement.
- Order store is a JSON file — fine for local demo, breaks on serverless cold-start. Swap for Postgres / Vercel KV in production.
- No SIWE auth on `/api/orders` — caller-address checks are advisory. Add proper signed-message auth before deploying publicly.
- `BATCHER_PRIVATE_KEY` runs in DEMO mode if missing (fake tx hashes for `/api/settle`). Production needs a real funded key.

---

## License

MIT
