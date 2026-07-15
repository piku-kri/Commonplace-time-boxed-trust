"use client";

import { formatAddress } from "@/lib/format";

interface HeaderProps {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({ address, balance, isConnecting, onConnect, onDisconnect }: HeaderProps) {
  return (
    <header className="border-b border-card bg-page/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-stamp bg-cloth flex items-center justify-center flex-shrink-0">
            <span className="font-display text-gilt text-lg leading-none">§</span>
          </div>
          <div>
            <p className="font-display text-lg sm:text-xl tracking-tight leading-none">
              Commonplace
            </p>
            <p className="text-[11px] font-mono text-cloth-soft/60 tracking-wide mt-0.5">
              NEIGHBORHOOD BOOK BOXES · TESTNET
            </p>
          </div>
        </div>

        {address ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {balance && (
              <div className="hidden sm:block text-sm font-mono text-cloth-soft px-2">
                {parseFloat(balance).toFixed(2)} XLM
              </div>
            )}
            <button
              onClick={onDisconnect}
              className="group flex items-center gap-2 rounded-stamp border border-card bg-white px-3 py-2 text-sm font-mono hover:border-overdue/40 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-leaf status-dot" />
              <span>{formatAddress(address, 5)}</span>
              <span className="text-cloth-soft/40 group-hover:text-overdue transition-colors">
                · disconnect
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="rounded-stamp bg-cloth text-page px-4 py-2 text-sm font-medium hover:bg-spine transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isConnecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
