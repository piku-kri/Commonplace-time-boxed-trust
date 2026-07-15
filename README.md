# 📚 Commonplace — Neighborhood Book Exchange on Stellar

A staked, on-chain "little free library" built on Stellar / Soroban. Borrow a book, stake XLM, return it before the grace period — your deposit refunds and your community reputation rises via a cross-contract call. Let it lapse, and the deposit funds the box instead.

---

## 🔗 Live Demo & Video

| | |
|---|---|
| 🌐 **Live Platform** | [commonplace-time-boxed-trust.vercel.app](https://commonplace-time-boxed-trust.vercel.app/) |
| 🎥 **Demo Video** | [Watch on Google Drive](https://drive.google.com/file/d/1ZdOwDJw5N3g2PrX8eYCJJnfFKFwpQgW9/view?usp=sharing) |
| 📜 **LibraryRegistry Contract** | [`CBXHNXC4PSFX4PAQSPKUJXQRGBSTMZ4AROG7WGSLP7XIGD3N7LLZK62O`](https://stellar.expert/explorer/testnet/contract/CBXHNXC4PSFX4PAQSPKUJXQRGBSTMZ4AROG7WGSLP7XIGD3N7LLZK62O) |
| 📜 **StewardReputation Contract** | [`CBIZIE4XOHMR3PA2OM7JLXMKP3RA7ZDLN5JN5RXM4AA3TBORGAT657GA`](https://stellar.expert/explorer/testnet/contract/CBIZIE4XOHMR3PA2OM7JLXMKP3RA7ZDLN5JN5RXM4AA3TBORGAT657GA) |
| 🧾 **Sample Borrow Tx** | [c0c4d17f...](https://stellar.expert/explorer/testnet/tx/c0c4d17fa2b0ccba1dc1181742f94a8d719a78fdfcdedb994c499c6c04142d9b) |
| 🧾 **Sample Return Tx** | [6b56e5ce...](https://stellar.expert/explorer/testnet/tx/6b56e5ce144a6b88beda89e6eab421a92681006bd7642f4107f990015443c98a) |

---

## 🌟 Key Features

1. **Two-Contract Cross-Contract Calls** — `LibraryRegistry` atomically calls `StewardReputation` on every return and lapse, updating trust scores in the same transaction.
2. **Real XLM Deposits via Native SAC** — Deposits are escrowed using the Native XLM Stellar Asset Contract, with trustless refunds on return.
3. **Permissionless Loan Settlement** — Anyone can trigger settlement of an expired loan once the grace period passes — no admin required.
4. **Community Reputation System** — On-chain trust tiers: New Reader → Regular → Trusted Borrower → Library Steward.
5. **Live Circulation Desk** — Real-time on-chain event feed showing every listing, borrow, return, and lapse.
6. **Fully Responsive UI** — Next.js 14, TypeScript, Vanilla CSS. Works on desktop and mobile.

---

## 📸 Screenshots

### Product UI
<img src="screenshots/product ui.png" width="100%" alt="Commonplace Product UI" />

### Mobile Responsive UI
<img src="screenshots/responsive ui.png" width="100%" alt="Mobile Responsive UI" />

### CI/CD Pipeline
<img src="screenshots/ci cd workflow.png" width="100%" alt="CI/CD Pipeline" />

### Test Output (16 Passing Tests)
<img src="screenshots/test output.png" width="100%" alt="Test Output" />

---

## 🛠️ Tech Stack

- **Contracts:** Rust, Soroban SDK 21.7
- **Frontend:** Next.js 14, TypeScript, Vanilla CSS
- **Wallet:** Stellar Wallets Kit
- **Testing:** Rust test harness + soroban-sdk testutils; Vitest + React Testing Library
- **CI/CD:** GitHub Actions → Vercel

---

## 📄 License

MIT
