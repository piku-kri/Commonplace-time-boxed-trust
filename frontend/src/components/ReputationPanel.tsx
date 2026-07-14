"use client";

import { useEffect, useState } from "react";
import { StewardStats } from "@/lib/types";
import { getStewardStats } from "@/lib/soroban";
import { stroopsToXlm } from "@/lib/format";

const LABEL_COLOR: Record<StewardStats["label"], string> = {
  "New Reader": "text-cloth-soft/60",
  Regular: "text-gilt",
  "Trusted Borrower": "text-leaf",
  "Library Steward": "text-cloth",
};

export function ReputationPanel({ address }: { address: string }) {
  const [stats, setStats] = useState<StewardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getStewardStats(address)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your standing right now.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="rounded-stamp border border-card bg-white p-4 card-edge">
      <p className="font-mono text-[11px] tracking-widest uppercase text-cloth-soft/50 mb-3">
        Your standing
      </p>

      {isLoading && (
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-card/50 rounded w-1/2" />
          <div className="h-3 bg-card/30 rounded w-3/4" />
        </div>
      )}

      {error && <p className="text-sm text-overdue">{error}</p>}

      {stats && !isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={`font-display text-xl ${LABEL_COLOR[stats.label]}`}>{stats.label}</p>
            <p className="text-[11px] text-cloth-soft/50">score {stats.trustScore}/1000</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg">{stats.cyclesCompleted}</p>
            <p className="text-[11px] text-cloth-soft/50">fair exchanges</p>
          </div>
          <div>
            <p className="font-mono text-lg text-gilt">
              {stroopsToXlm(stats.depositsReturned)} <span className="text-xs">XLM</span>
            </p>
            <p className="text-[11px] text-cloth-soft/50">deposits returned</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg text-overdue/70">{stats.cyclesLapsed}</p>
            <p className="text-[11px] text-cloth-soft/50">lapsed loans</p>
          </div>
        </div>
      )}
    </div>
  );
}
