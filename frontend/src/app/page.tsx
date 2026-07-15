"use client";

import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ActivityLog } from "@/components/ActivityLog";
import { ListingGrid } from "@/components/ListingGrid";
import { ListBookModal } from "@/components/ListBookModal";
import { RegisterBoxModal } from "@/components/RegisterBoxModal";
import { ReputationPanel } from "@/components/ReputationPanel";
import { ToastStack, Toast } from "@/components/Toast";
import { useWallet } from "@/hooks/useWallet";
import { useBalance } from "@/hooks/useBalance";
import { useListings } from "@/hooks/useListings";
import { useBoxes } from "@/hooks/useBoxes";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { BookListing } from "@/lib/types";
import { stroopsToXlm, xlmToStroops } from "@/lib/format";
import { registerBox, listBook, borrowBook, returnBook, expireLoan } from "@/lib/soroban";

export default function HomePage() {
  const wallet = useWallet();
  const { balance, refreshBalance } = useBalance(wallet.address);
  const { listings, isLoading, error, refresh } = useListings();
  const { boxes, refresh: refreshBoxes } = useBoxes();
  const { events, pushEvent } = useActivityFeed();

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const stats = useMemo(() => {
    const available = listings.filter((l) => l.status === "Available");
    const returned = listings.filter((l) => l.status === "Returned");
    const staked = listings
      .filter((l) => l.status === "Borrowed")
      .reduce((sum, l) => sum + BigInt(l.deposit), 0n);
    return {
      availableCount: available.length,
      returnedCount: returned.length,
      totalStaked: stroopsToXlm(staked.toString()),
    };
  }, [listings]);

  const handleRegisterBox = async (name: string, neighborhood: string) => {
    if (!wallet.address) {
      addToast({ type: "error", message: "Connect your wallet first to register a box." });
      return;
    }
    try {
      const txHash = await registerBox(wallet.address, name, neighborhood);
      addToast({ type: "success", message: `Registered "${name}".`, txHash });
      pushEvent({
        kind: "BoxRegistered",
        listingId: -1,
        actor: wallet.address,
        detail: `Registered box "${name}" in ${neighborhood}`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refreshBoxes();
      refreshBalance();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't register this box.",
      });
      throw err;
    }
  };

  const handleListBook = async (
    boxId: number,
    title: string,
    conditionNote: string,
    depositXlm: string,
    gracePeriodSecs: number
  ) => {
    if (!wallet.address) {
      addToast({ type: "error", message: "Connect your wallet first to list a book." });
      return;
    }
    try {
      const depositStroops = xlmToStroops(depositXlm);
      const txHash = await listBook(
        wallet.address,
        boxId,
        title,
        conditionNote,
        depositStroops,
        gracePeriodSecs
      );
      addToast({ type: "success", message: `Listed "${title}".`, txHash });
      pushEvent({
        kind: "BookListed",
        listingId: -1,
        actor: wallet.address,
        detail: `Listed "${title}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
      refreshBalance();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't list this book.",
      });
      throw err;
    }
  };

  const handleBorrow = async (listing: BookListing) => {
    if (!wallet.address) return;
    setBusyAction(`${listing.id}-borrow`);
    try {
      const txHash = await borrowBook(listing.id, wallet.address);
      addToast({ type: "success", message: `Borrowed "${listing.title}".`, txHash });
      pushEvent({
        kind: "BookBorrowed",
        listingId: listing.id,
        actor: wallet.address,
        detail: `Borrowed "${listing.title}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
      refreshBalance();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't borrow this book.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReturn = async (listing: BookListing) => {
    if (!wallet.address) return;
    setBusyAction(`${listing.id}-return`);
    try {
      const txHash = await returnBook(listing.id, wallet.address);
      addToast({
        type: "success",
        message: `Returned "${listing.title}" — deposit refunded.`,
        txHash,
      });
      pushEvent({
        kind: "BookReturned",
        listingId: listing.id,
        actor: wallet.address,
        detail: `Returned "${listing.title}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
      refreshBalance();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't return this book.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleExpire = async (listing: BookListing) => {
    if (!wallet.address) return;
    setBusyAction(`${listing.id}-expire`);
    try {
      const txHash = await expireLoan(listing.id, wallet.address);
      addToast({
        type: "success",
        message: `Settled "${listing.title}" as lapsed.`,
        txHash,
      });
      pushEvent({
        kind: "LoanLapsed",
        listingId: listing.id,
        actor: wallet.address,
        detail: `"${listing.title}" settled as lapsed`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
      refreshBalance();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't settle this loan.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <main className="min-h-screen">
      <Header
        address={wallet.address}
        balance={balance}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
      />

      <Hero
        availableCount={stats.availableCount}
        totalStaked={stats.totalStaked}
        returnedCount={stats.returnedCount}
      />

      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-8 sm:py-10">
        <div className="grid lg:grid-cols-[1fr,320px] gap-8">
          <div>
            <div className="flex items-center justify-between mb-5 gap-3">
              <h2 className="font-display text-xl">The catalog</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBoxModalOpen(true)}
                  disabled={!wallet.address}
                  title={!wallet.address ? "Connect your wallet to register a box" : undefined}
                  className="rounded-stamp border border-cloth text-cloth px-3 py-2 text-sm font-medium hover:bg-cloth/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Register box
                </button>
                <button
                  onClick={() => setIsListModalOpen(true)}
                  disabled={!wallet.address}
                  title={!wallet.address ? "Connect your wallet to list a book" : undefined}
                  className="rounded-stamp bg-gilt text-white px-4 py-2 text-sm font-medium hover:bg-gilt/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + List a book
                </button>
              </div>
            </div>

            <ListingGrid
              listings={listings}
              isLoading={isLoading}
              error={error}
              currentAddress={wallet.address}
              onBorrow={handleBorrow}
              onReturn={handleReturn}
              onExpire={handleExpire}
              busyAction={busyAction}
              onRetry={refresh}
            />
          </div>

          <div className="flex flex-col gap-5">
            {wallet.address && <ReputationPanel address={wallet.address} />}
            <ActivityLog events={events} />
          </div>
        </div>
      </section>

      <ListBookModal
        isOpen={isListModalOpen}
        boxes={boxes}
        onClose={() => setIsListModalOpen(false)}
        onSubmit={handleListBook}
        onRegisterBoxClick={() => {
          setIsListModalOpen(false);
          setIsBoxModalOpen(true);
        }}
      />
      <RegisterBoxModal
        isOpen={isBoxModalOpen}
        onClose={() => setIsBoxModalOpen(false)}
        onSubmit={handleRegisterBox}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {wallet.error && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50">
          <div className="rounded-stamp border border-overdue/30 bg-white px-4 py-3 shadow-lg flex items-start gap-2">
            <span className="text-overdue text-lg leading-none mt-0.5">!</span>
            <div className="flex-1">
              <p className="text-sm text-cloth">{wallet.error}</p>
            </div>
            <button
              onClick={wallet.dismissError}
              className="text-cloth-soft/40 hover:text-cloth text-sm"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
