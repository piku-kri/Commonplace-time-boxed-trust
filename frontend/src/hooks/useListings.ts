"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listListings } from "@/lib/soroban";
import { BookListing, ContractCallError } from "@/lib/types";
import { isConfigured } from "@/lib/config";

interface ListingsState {
  listings: BookListing[];
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 8000;

export function useListings() {
  const [state, setState] = useState<ListingsState>({
    listings: [],
    isLoading: true,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchListings = useCallback(async (showSpinner: boolean) => {
    if (!isConfigured()) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error:
          "Contract addresses aren't configured yet. Set NEXT_PUBLIC_LIBRARY_REGISTRY_CONTRACT_ID in your environment.",
      }));
      return;
    }
    setState((s) => ({ ...s, isLoading: showSpinner, error: null }));
    try {
      const result = await listListings(0, 50);
      setState({ listings: result.reverse(), isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? (err.message + (err.stack ? ' | ' + err.stack.slice(0, 50) : '')) : String(err);
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchListings(true);
    intervalRef.current = setInterval(() => fetchListings(false), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchListings]);

  const refresh = useCallback(() => fetchListings(false), [fetchListings]);

  return { ...state, refresh };
}
