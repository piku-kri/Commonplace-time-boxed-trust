# Commonplace

**A staked, on-chain layer for neighborhood "little free library" book
boxes on Stellar/Soroban.** Borrow a book, stake a small XLM deposit,
bring it back (or leave a replacement) before the grace period ends —
your deposit returns and your community standing rises, automatically,
via a cross-contract call. Let it lapse, and the deposit funds the box
instead.

Built for the Orange Belt (Level 3) submission — advanced smart
contracts and production-ready dApp architecture.

> 🔗 **Live demo:** _add your Vercel URL here after deploying (see
> `docs/DEPLOYMENT.md`)_
> 🎥 **Demo video:** _add your 1–2 min walkthrough link here_
> 📜 **LibraryRegistry contract:** `<add testnet address after deploy>`
> 📜 **StewardReputation contract:** `<add testnet address after deploy>`
> 🧾 **Sample transaction:** `<add a tx hash + stellar.expert link>`

---

## Why this project

A third distinct domain — after a work-bounty marketplace and a trail
condition network — applying the same architectural pattern (two
contracts, one calling the other inside an atomic transaction) to
neighborhood book exchange. The interesting design problem here is
**time-boxed trust with a permissionless failsafe**: every loan has a
grace period the borrower is expected to honor, but settlement of a
lapsed loan isn't gated behind the lister or borrower acting —
*anyone* in the community can trigger it once the deadline passes,
which is a deliberately different access-control shape than the
sponsor-approves or crowd-votes patterns used in similar dApps.

## What it does

1. Anyone can **register a book box** — a physical neighborhood
   location — and becomes its steward.
2. Anyone can **list a book** in a box: title, condition note, a
   deposit amount, and a grace period.
3. A borrower **stakes the deposit** and takes the book.
4. Before the grace period ends, the borrower **returns it** (or
   confirms they left a replacement) — the deposit refunds instantly,
   and a cross-contract call into `StewardReputation` raises their
   trust score.
5. If the grace period expires with no return, **anyone** can trigger
   settlement — the deposit is forfeited into the box's community
   fund, and a cross-contract call penalizes the borrower's trust
   score.
6. A **live circulation desk** feed shows every listing, borrow,
   return, and lapse as it happens, and every participant has a public
   trust tier (New Reader → Regular → Trusted Borrower → Library
   Steward).

## Architecture at a glance

```
Next.js frontend  ──Soroban RPC──▶  LibraryRegistry contract
                                          │        │
                              token::Client   reputation::Client
                                          │        │
                                          ▼        ▼
                                  Native XLM SAC   StewardReputation
```

Full breakdown, the permissionless-settlement design rationale, grace
period mechanics, and the state machine:
**[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

## Project structure

```
library-exchange/
├── contracts/
│   ├── library-registry/          # Boxes, listings, loan lifecycle
│   │   └── src/{lib.rs,test.rs}   # 9 tests incl. grace-period timing
│   └── steward-reputation/        # Community trust scoring
│       └── src/{lib.rs,test.rs}   # 7 tests incl. authorization checks
├── frontend/
│   ├── src/app/                   # Next.js App Router page + layout
│   ├── src/components/            # ListingCard, ActivityLog, modals, etc.
│   ├── src/hooks/                  # useWallet, useListings, useBoxes, useActivityFeed
│   └── src/lib/                    # soroban.ts, wallet.ts, format.ts
├── scripts/{build.sh,deploy_testnet.sh}
├── .github/workflows/{ci.yml,deploy-preview.yml}
└── docs/{ARCHITECTURE.md,DEPLOYMENT.md,SUBMISSION_CHECKLIST.md}
```

## Smart contract design

### `StewardReputation`

| Method | Purpose |
|---|---|
| `initialize(admin)` | One-time setup |
| `authorize_writer(writer)` | Allow-list a LibraryRegistry deployment |
| `record_completion(caller, steward, deposit_returned)` | Cross-contract; +18 trust, capped at 1000 |
| `record_lapse(caller, steward)` | Cross-contract; −70 trust |
| `get_stats(steward)` / `steward_label(steward)` | Public reads |

### `LibraryRegistry`

| Method | Purpose |
|---|---|
| `initialize(admin, token, reputation)` | Wires token + reputation addresses |
| `register_box(steward, name, neighborhood)` | Registers a physical box |
| `list_book(lister, box_id, title, note, deposit, grace_period_secs)` | Creates an `Available` listing |
| `borrow_book(listing_id, borrower)` | Escrows deposit — `Available → Borrowed` |
| `return_book(listing_id, borrower)` | Refunds deposit **and** calls the registry — `Borrowed → Returned` |
| `expire_loan(listing_id)` | Callable by anyone past deadline — `Borrowed → Lapsed` |
| `list_listings(offset, limit)` / `list_boxes(offset, limit)` | Public reads |

## Events

`BoxRegisteredEvent`, `BookListedEvent`, `BookBorrowedEvent`,
`BookReturnedEvent`, `LoanLapsedEvent` on `LibraryRegistry`, plus a
parallel reputation-specific pair on `StewardReputation` — all typed
`#[contractevent]`s with indexed topics, powering the frontend's live
circulation desk feed.

## Testing

**Contracts** — 16 tests across both contracts:

```bash
cargo test --workspace
```

Covers: box registration, listing validation (positive deposit,
minimum grace period, box must exist), full borrow → return lifecycle
with the deposit refund and reputation bump asserted, only-the-borrower
can return, grace-period timing exercised directly via
`env.ledger().with_mut(...)` (both the "too early" rejection and the
"after deadline" settlement with forfeiture + reputation penalty
asserted), double-borrow rejection, and pagination.

**Frontend** — component and utility tests:

```bash
cd frontend && npm run test
```

> **Note on this repository as delivered:** the contract and frontend
> logic were written and reviewed carefully, but this environment has
> no network access to fetch a Rust/Cargo toolchain, so `cargo test`
> has not actually been executed here. Run it yourself per
> `docs/DEPLOYMENT.md` step 4 before submitting.

## Error handling & loading states

- Every contract entry point returns `Result<T, ContractError>` with
  specific variants (`InvalidState`, `Unauthorized`,
  `GracePeriodNotExpired`, `InvalidGracePeriod`, `InvalidDeposit`)
  instead of panicking.
- `src/lib/soroban.ts` centralizes simulate → sign → submit → poll for
  every write and translates raw simulation errors into plain-language
  UI copy (see `readableSimulationError`).
- Every async action has a loading state (button → "Confirming…",
  skeleton cards while the catalog loads) and a visible error state
  (inline in the list-book and register-box modals, a dismissible
  wallet-error banner, a retry button if the catalog fails to load).
  The list-book form also handles the "no boxes yet" edge case by
  routing the user to register one first, rather than showing a
  broken empty dropdown.

## Mobile responsiveness

The catalog grid collapses from 4 columns → 2 → 1, both modals become
bottom sheets on small screens, and the header/hero stack vertically
below `sm:`.

## Local development

```bash
# Contracts
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
cargo test --workspace

# Frontend
cd frontend
cp .env.example .env.local   # fill in after deploying, see docs/DEPLOYMENT.md
npm install
npm run dev
```

Full walkthrough: **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.

## Tech stack

- **Contracts:** Rust, Soroban SDK 21.7
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Wallet:** Stellar Wallets Kit
- **RPC:** `@stellar/stellar-sdk`
- **Testing:** Rust's built-in harness + soroban-sdk testutils; Vitest
  + React Testing Library
- **CI/CD:** GitHub Actions (contract build/test/clippy, frontend
  lint/test/build, PR build-gate)

## License

MIT — see `LICENSE`.
