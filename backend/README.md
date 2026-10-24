# SmartEscrow - smart contracts & demo tooling

Hardhat project implementing the escrow protocol described in the thesis (Chapters 3
and 4): the buyer's funds are locked in the contract, delivery is confirmed with an OTP
plus an on-chain geolocation check, and disputes are resolved automatically when the
evidence is conclusive (or escalated to the escrow agent otherwise).

Nothing here touches real money - everything runs on the local Hardhat network.

## Layout

```
contracts/
  SmartEscrow.sol          main contract (deal lifecycle, disputes, configuration)
  libraries/GeoUtils.sol   fixed-point distance maths (micro-degrees)
scripts/
  deploy.js                deploys, writes frontend config + ABI + backend/.env
  seed-demo.js             creates 3 ready-made deals for the dashboards
  demo-flow.js             runs the 4 thesis scenarios end-to-end (self-contained)
  keeper.js                optional worker: release / auto-resolve as soon as allowed
  print-accounts.js        local accounts, balances, optional private keys
  export-abi.js            copies the ABI into the frontend
test/
  SmartEscrow.test.js      49 lifecycle / dispute / access-control tests
  GeoUtils.test.js         distance library cross-checked against haversine
```

## Prerequisites

- Node.js 18+
- `npm install` inside `backend/`

## Quick start (local demo)

```bash
# terminal 1 - local chain (keep it running; it prints the test accounts)
npx hardhat node

# terminal 2 - deploy + seed
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed-demo.js --network localhost

# terminal 3 - frontend
cd ../frontend
npm install      # first time only
npm run dev
```

`deploy.js` writes the contract address into `frontend/src/config.json`, the ABI into
`frontend/src/contracts/SmartEscrow.json` and `ESCROW_CONTRACT` into `backend/.env`, so
the UI is wired up automatically.

## Local accounts

| # | Role | Address (Hardhat default) |
|---|------|---------------------------|
| 0 | Owner **and** escrow agent | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 1 | Buyer | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| 2 | Seller | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| 3 | Delivery agent | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |

Import them in MetaMask using the well-known test mnemonic
`test test test test test test test test test test test junk`, or run
`SHOW_PRIVATE_KEYS=true npx hardhat run scripts/print-accounts.js`. Add the network
`http://127.0.0.1:8545` with chain id `31337`.

## Commands

| Command | What it does |
|---|---|
| `npx hardhat compile` | compiles the contracts |
| `npx hardhat test` | runs all 49 unit tests |
| `npx hardhat node` | starts the local chain on `127.0.0.1:8545` |
| `npx hardhat run scripts/deploy.js --network localhost` | deploys + writes frontend config/ABI |
| `npx hardhat run scripts/seed-demo.js --network localhost` | creates the 3 demo deals |
| `npx hardhat run scripts/demo-flow.js` | prints the 4 thesis scenarios (in-memory chain) |
| `npx hardhat run scripts/keeper.js --network localhost` | optional auto-release worker |
| `npx hardhat run scripts/print-accounts.js --network localhost` | accounts + balances |
| `npx hardhat run scripts/export-abi.js` | re-copies the ABI after a contract change |

## Contract parameters

| Parameter | Default | Owner function |
|---|---|---|
| `distanceThresholdMeters` | `200` m | `setDistanceThreshold` |
| `disputeWindowSeconds` | `60` s | `setDisputeWindow` |
| `escrowAgent` | deployer / `.env` | `setEscrowAgent` |

Override the numeric parameters at deployment with `DISTANCE_THRESHOLD_METERS` /
`DISPUTE_WINDOW_SECONDS` in `backend/.env` (see `.env.example`).

## Deal lifecycle

```
FUNDED -> OTP_GENERATED -> DELIVERED -> COMPLETED        (no dispute, window elapsed)
                               \-> DISPUTED -> COMPLETED | REFUNDED    (automatic rule)
                                            \-> ESCALATED -> COMPLETED | REFUNDED  (agent)
```

1. `createDeal(seller, deliveryAgent)` payable - the buyer locks the ETH.
2. `setBuyerLocation(lat, lon)` - the buyer stores the delivery position (micro-degrees).
3. `generateOTP(dealId)` - delivery agent; a 4-digit OTP is hashed on-chain and emitted.
4. `verifyOTP(dealId, otp, lat, lon)` - delivery agent; stores the delivery position and
   starts the dispute window. The distance is computed on-chain by `GeoUtils`.
5. `releaseFunds(dealId)` - permissionless once the window expired without a dispute.
6. `raiseDispute(dealId, reason)` - buyer, only while the deal is open.
7. `autoResolveDispute(dealId)` - distance <= threshold pays the seller, otherwise the
   buyer is refunded; missing evidence escalates the case.
8. `resolveDispute(dealId, refundBuyer, note)` - escrow agent decides escalated cases.

Funds leave the contract exactly once: every payout goes through the internal `_settle`
path, which zeroes the deal amount before transferring.

## Tests

`npx hardhat test` covers creation validations, location/agent management, OTP
generation and verification, automatic release, dispute auto-resolution (both
directions and both escalation reasons), manual escalation, escrow-agent resolution,
owner-only configuration, duplicate settlements and the distance library.

## Troubleshooting

- **`frontend/src/config.json` missing or stale** - re-run `deploy.js`; the frontend never
  reads files from `backend/`, it only consumes the copied config and ABI.
- **`nonce too low` / wrong balances in MetaMask** - clear the MetaMask activity data for
  the account (Settings -> Advanced) or restart `npx hardhat node`.
- **`Dispute window has not expired yet`** - wait for the countdown shown in the UI
  (60 s by default) or let `keeper.js` release the funds.
- **`Invalid OTP`** - the buyer's dashboard displays the OTP emitted with `OTPGenerated`;
  the delivery agent's dashboard intentionally never shows it.
