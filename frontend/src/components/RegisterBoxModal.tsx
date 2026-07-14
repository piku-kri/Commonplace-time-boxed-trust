"use client";

import { useState, FormEvent } from "react";

interface RegisterBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, neighborhood: string) => Promise<void>;
}

export function RegisterBoxModal({ isOpen, onClose, onSubmit }: RegisterBoxModalProps) {
  const [name, setName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validate = (): string | null => {
    if (name.trim().length < 3) return "Give the box a name, e.g. 'Maple Street Box'.";
    if (neighborhood.trim().length < 2) return "Add a neighborhood or area name.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), neighborhood.trim());
      setName("");
      setNeighborhood("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't register this box. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-spine/40 backdrop-blur-sm px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-page rounded-t-2xl sm:rounded-stamp border border-card shadow-xl p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl">Register a book box</h2>
            <p className="text-sm text-cloth-soft/70 mt-1">
              Anyone can register a physical box location.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-cloth-soft/40 hover:text-cloth text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-wide text-cloth-soft/60 mb-1.5 block">
              Box name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maple Street Box"
              maxLength={80}
              className="w-full rounded-stamp border border-card bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-overdue/40"
            />
          </label>

          <label className="block">
            <span className="text-xs font-mono uppercase tracking-wide text-cloth-soft/60 mb-1.5 block">
              Neighborhood
            </span>
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Riverside"
              maxLength={80}
              className="w-full rounded-stamp border border-card bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-overdue/40"
            />
          </label>

          {error && (
            <p className="text-sm text-overdue bg-overdue/5 border border-overdue/20 rounded-stamp px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-stamp bg-cloth text-page py-2.5 text-sm font-medium hover:bg-spine transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isSubmitting ? "Registering…" : "Register box"}
          </button>
        </form>
      </div>
    </div>
  );
}
