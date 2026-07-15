"use client";

import { useEffect } from "react";
import { EXPLORER_TX_URL } from "@/lib/config";

export interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
  txHash?: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-80">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className={`rounded-stamp border px-4 py-3 shadow-lg card-edge flex items-start gap-2 ${
        isSuccess ? "bg-spine border-leaf/30 text-page" : "bg-white border-overdue/30"
      }`}
    >
      <span className={`mt-0.5 text-lg leading-none ${isSuccess ? "text-leaf" : "text-overdue"}`}>
        {isSuccess ? "✓" : "!"}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isSuccess ? "text-page" : "text-cloth"}`}>{toast.message}</p>
        {toast.txHash && (
          <a
            href={EXPLORER_TX_URL(toast.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[11px] underline opacity-70 hover:opacity-100"
          >
            View on Explorer ↗
          </a>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`text-sm leading-none ${isSuccess ? "text-page/40 hover:text-page" : "text-cloth-soft/40 hover:text-cloth"}`}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
