# Architecture

## System overview

```
                         ┌─────────────────────────┐
                         │   Next.js Frontend       │
                         │   (catalog + circulation) │
                         └────────────┬─────────────┘
                                      │ Soroban RPC
                                      ▼
                         ┌─────────────────────────┐
                         │  LibraryRegistry contract │
                         │  ─────────────────────    │
                         │  register_box                │
                         │  list_book                     │
                         │  borrow_book                     │
                         │  return_book ─────────────────────┼──┐
                         │  expire_loan ───────────────────────┼──┤ cross-contract call
                         └───────────┬──────────────────────┘  │
                                     │                           │
                          token::Client (SAC)                    │
                                     │                           ▼
                                     │           ┌─────────────────────────┐
                                     │           │ StewardReputation          │
                                     ▼           │ ─────────────────────    │
                         ┌─────────────────┐     │ record_completion            │
                         │  Native XLM SAC  │     │ record_lapse                   │
                         │  (deposit)       │     │ get_stats / steward_label        │
                         └─────────────────┘     └─────────────────────────┘
```

## Why two contracts

`LibraryRegistry` owns boxes, listings, and the loan lifecycle;
`StewardReputation` owns trust scores. Split the same way as the other
two Level 3 patterns in this series:

- **Trust follows the person, not one box.** A steward's reputation is
  meaningful across every book box in the network, not scoped to a
  single registry instance.
- **Least privilege.** `StewardReputation` does not trust every
  caller — an admin explicitly calls `authorize_writer` to allow-list
  a specific `LibraryRegistry` deployment. Any other caller attempting
  `record_completion` or `record_lapse` is rejected. See
  `test_unauthorized_writer_cannot_forge_reputation`.

## Inter-contract communication

- **`return_book`** — once a borrower confirms return within the grace
  period: (1) refunds the deposit via `token::Client::transfer`, then
  (2) calls `reputation::Client::record_completion`, passing
  `env.current_contract_address()` as the caller so
  `StewardReputation` can verify the call came from an authorized
  registry.
- **`expire_loan`** — callable by *anyone* (not just the lister or
  borrower) once the grace period has elapsed on a still-`Borrowed`
  listing. This is a deliberate design choice: it means the community,
  not just the counterparty, can trigger settlement, which matters
  because a careless lister might never notice a lapsed loan.
  Forfeits the deposit into the box's `community_fund` and calls
  `reputation::Client::record_lapse` to penalize the borrower.

Both settlement paths happen inside the same transaction as the action
that triggers them — a loan is never marked `Returned` without the
refund actually succeeding, and reputation is never out of sync with
settlement history.

## Grace period mechanics

Every listing carries its own `grace_period_secs`, set by the lister
when they list the book (minimum enforced: `MIN_GRACE_PERIOD_SECS` =
1 hour, to prevent a griefing listing with a 0-second window). The
loan's deadline is computed as `borrowed_at + grace_period_secs` at
borrow time, not listing time — so a book that sits available for
weeks doesn't shrink the borrower's actual window.

`expire_loan` checks `env.ledger().timestamp() >= deadline` and
rejects (`RegistryError::GracePeriodNotExpired`) if called early. This
is exercised directly in tests using `env.ledger().with_mut(...)` to
advance the simulated ledger timestamp — see
`test_expire_loan_before_grace_period_fails` and
`test_expire_loan_after_grace_period_forfeits_deposit_and_penalizes`.

## Listing state machine

```
        list_book
            │
            ▼
      ┌───────────┐   borrow_book    ┌──────────┐
      │ Available │ ───────────────▶ │ Borrowed  │
      └───────────┘                  └────┬─────┘
                                           │
                        return_book (borrower, before deadline)
                                           │
                                           ▼
                                     ┌──────────┐
                                     │ Returned  │  (deposit refunded,
                                     └──────────┘   reputation +18)
                                           ▲
                                           │
                              expire_loan (anyone, after deadline)
                                           │
                                           ▼
                                     ┌──────────┐
                                     │  Lapsed   │  (deposit forfeited to
                                     └──────────┘   community fund, reputation -70)
```

## Production-readiness practices applied

- Explicit `Result<T, Error>` on every entry point.
- `require_auth()` on every state-changing call that has an owner
  (`register_box`, `list_book`, `borrow_book`, `return_book`);
  `expire_loan` deliberately has no `require_auth()` beyond the
  implicit transaction submitter, since it's meant to be callable by
  any community member once the deadline has passed — the contract
  logic itself enforces the only real constraint (deadline elapsed).
- Minimum grace period enforced at listing time to prevent
  degenerate/griefing listings.
- Paginated reads (`list_listings`, `list_boxes`), no unbounded loops.
- CI builds release WASM, runs the full test suite, and runs Clippy on
  every push.
