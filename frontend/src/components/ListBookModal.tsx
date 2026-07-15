"use client";

import { useState, FormEvent, useEffect } from "react";
import { BookBox } from "@/lib/types";

interface ListBookModalProps {
  isOpen: boolean;
  boxes: BookBox[];
  onClose: () => void;
  onSubmit: (
    boxId: number,
    title: string,
    conditionNote: string,
    depositXlm: string,
    gracePeriodSecs: number
  ) => Promise<void>;
  onRegisterBoxClick: () => void;
}

export function ListBookModal({
  isOpen,
  boxes,
  onClose,
  onSubmit,
  onRegisterBoxClick,
}: ListBookModalProps) {
  const [boxId, setBoxId] = useState<string>(boxes[0]?.id.toString() ?? "");
  const [title, setTitle] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [deposit, setDeposit] = useState("");
  const [graceValue, setGraceValue] = useState("48");
  const [graceUnit, setGraceUnit] = useState("hours");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !boxId && boxes.length > 0) {
      setBoxId(boxes[0].id.toString());
    }
  }, [isOpen, boxes, boxId]);

  if (!isOpen) return null;

  const validate = (): string | null => {
    if (boxes.length === 0) return "Register a book box first before listing a book.";
    if (!boxId) return "Choose which box this book is in.";
    if (title.trim().length < 2) return "Give the book a title.";
    if (conditionNote.trim().length < 5) return "Add a short note about the book's condition.";
    const depositNum = Number(deposit);
    if (!deposit || Number.isNaN(depositNum) || depositNum <= 0)
      return "Deposit must be a positive number of XLM.";
    const graceNum = Number(graceValue);
    if (!graceValue || Number.isNaN(graceNum) || graceNum <= 0)
      return "Grace period must be greater than 0.";
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
      await onSubmit(
        Number(boxId),
        title.trim(),
        conditionNote.trim(),
        deposit.trim(),
        (() => {
          const v = Number(graceValue);
          if (graceUnit === "seconds") return Math.round(v);
          if (graceUnit === "minutes") return Math.round(v * 60);
          if (graceUnit === "hours") return Math.round(v * 3600);
          return Math.round(v * 86400);
        })()
      );
      setTitle("");
      setConditionNote("");
      setDeposit("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't list this book. Try again.");
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
        className="w-full sm:max-w-md bg-page rounded-t-2xl sm:rounded-stamp border border-card shadow-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl">List a book</h2>
            <p className="text-sm text-cloth-soft/70 mt-1">
              Anyone borrowing it will stake the deposit you set.
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

        {boxes.length === 0 ? (
          <div className="rounded-stamp border border-dashed border-card px-4 py-6 text-center">
            <p className="text-sm text-cloth-soft mb-3">
              No book boxes registered yet. Register one first.
            </p>
            <button
              onClick={onRegisterBoxClick}
              className="rounded-stamp bg-cloth text-page px-4 py-2 text-sm font-medium hover:bg-spine transition-colors"
            >
              Register a book box
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Book box">
              <select value={boxId} onChange={(e) => setBoxId(e.target.value)} className="input">
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.neighborhood}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Hobbit"
                maxLength={100}
                className="input"
              />
            </Field>

            <Field label="Condition note">
              <textarea
                value={conditionNote}
                onChange={(e) => setConditionNote(e.target.value)}
                placeholder="Well loved paperback, all pages intact, slight water stain on cover."
                rows={3}
                maxLength={400}
                className="input resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Deposit (XLM)">
                <input
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="5"
                  inputMode="decimal"
                  className="input font-mono"
                />
              </Field>
              <Field label="Grace period">
                <div className="flex gap-2">
                  <input
                    value={graceValue}
                    onChange={(e) => setGraceValue(e.target.value)}
                    placeholder="48"
                    inputMode="numeric"
                    className="input font-mono w-20"
                  />
                  <select
                    value={graceUnit}
                    onChange={(e) => setGraceUnit(e.target.value)}
                    className="input flex-1"
                  >
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </Field>
            </div>

            {error && (
              <p className="text-sm text-overdue bg-overdue/5 border border-overdue/20 rounded-stamp px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-stamp bg-cloth text-page py-2.5 text-sm font-medium hover:bg-spine transition-colors disabled:opacity-50 disabled:cursor-wait mt-1"
            >
              {isSubmitting ? "Listing…" : "List book"}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 2px;
          border: 1px solid #c7b89b;
          background: white;
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid #a23b2e;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-mono uppercase tracking-wide text-cloth-soft/60 mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
