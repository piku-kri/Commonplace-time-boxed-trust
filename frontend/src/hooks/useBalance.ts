"use client";

import { useState, useEffect, useCallback } from "react";

export function useBalance(address: string | null) {
  const [balance, setBalance] = useState<string>("0");

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance("0");
      return;
    }
    try {
      const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
      if (!res.ok) return;
      const data = await res.json();
      const native = data.balances?.find((b: any) => b.asset_type === "native");
      if (native) {
        setBalance(native.balance);
      }
    } catch (err) {
      console.error("Failed to fetch balance", err);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 8000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return { balance, refreshBalance: fetchBalance };
}
