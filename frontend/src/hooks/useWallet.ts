"use client";

import { useCallback, useState, useEffect } from "react";
import { openWalletSelector, disconnectWallet } from "@/lib/wallet";

export interface WalletState {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnecting: false,
    error: null,
  });

  useEffect(() => {
    const saved = localStorage.getItem("commonplace-wallet");
    if (saved) {
      setState((s) => ({ ...s, address: saved }));
    }
  }, []);

  const connect = useCallback(() => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    openWalletSelector(
      (address) => {
        localStorage.setItem("commonplace-wallet", address);
        setState({ address, isConnecting: false, error: null });
      },
      (message) => setState((s) => ({ ...s, isConnecting: false, error: message }))
    );
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    localStorage.removeItem("commonplace-wallet");
    setState({ address: null, isConnecting: false, error: null });
  }, []);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return { ...state, connect, disconnect, dismissError };
}
