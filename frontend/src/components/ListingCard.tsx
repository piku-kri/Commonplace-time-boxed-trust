import { BookListing } from "@/lib/types";
import { stroopsToXlm, formatAddress, formatRelativeTime, formatDuration } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

interface ListingCardProps {
  listing: BookListing;
  currentAddress: string | null;
  onBorrow: (listing: BookListing) => void;
  onReturn: (listing: BookListing) => void;
  onExpire: (listing: BookListing) => void;
  busyAction: string | null;
}

export function ListingCard({
  listing,
  currentAddress,
  onBorrow,
  onReturn,
  onExpire,
  busyAction,
}: ListingCardProps) {
  const isBorrower = currentAddress === listing.borrower;
  const isBusy = (action: string) => busyAction === `${listing.id}-${action}`;

  const deadline = listing.borrowedAt + listing.gracePeriodSecs;
  const nowSecs = Math.floor(Date.now() / 1000);
  const isPastDeadline = listing.status === "Borrowed" && nowSecs >= deadline;
  const timeRemaining = deadline - nowSecs;

  return (
    <article className="rounded-stamp border border-card bg-white p-4 card-edge flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-snug">{listing.title}</h3>
        <StatusBadge status={listing.status} />
      </div>

      <p className="text-sm text-cloth-soft leading-relaxed line-clamp-3">
        {listing.conditionNote}
      </p>

      <div className="flex items-baseline justify-between mt-1">
        <span className="font-mono text-lg text-gilt font-medium">
          {stroopsToXlm(listing.deposit)} <span className="text-xs text-gilt/60">XLM deposit</span>
        </span>
        <span className="text-[11px] font-mono text-cloth-soft/50">
          #{listing.id.toString().padStart(3, "0")}
        </span>
      </div>

      {listing.status === "Borrowed" && (
        <p className={`text-xs font-mono ${isPastDeadline ? "text-overdue" : "text-cloth-soft/60"}`}>
          {isPastDeadline
            ? "Grace period expired — eligible to lapse"
            : `Due back in ${formatDuration(timeRemaining)}`}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-cloth-soft/60 border-t border-card pt-3">
        <span>
          Listed by <span className="font-mono">{formatAddress(listing.lister)}</span>
        </span>
        <span>{formatRelativeTime(listing.listedAt)}</span>
      </div>

      {listing.borrower && (
        <p className="text-xs text-cloth-soft/60 -mt-2">
          Borrowed by <span className="font-mono">{formatAddress(listing.borrower)}</span>
        </p>
      )}

      <div className="flex gap-2 mt-1">
        {listing.status === "Available" && currentAddress && (
          <ActionButton
            label="Borrow this book"
            variant="primary"
            busy={isBusy("borrow")}
            onClick={() => onBorrow(listing)}
          />
        )}
        {listing.status === "Available" && !currentAddress && (
          <p className="text-xs text-cloth-soft/50 italic">Connect a wallet to borrow this.</p>
        )}
        {listing.status === "Borrowed" && isBorrower && !isPastDeadline && (
          <ActionButton
            label="Return / mark returned"
            variant="primary"
            busy={isBusy("return")}
            onClick={() => onReturn(listing)}
          />
        )}
        {listing.status === "Borrowed" && isBorrower && isPastDeadline && (
          <p className="text-xs text-overdue italic">
            The grace period has passed — anyone can now settle this loan as lapsed.
          </p>
        )}
        {listing.status === "Borrowed" && !isBorrower && isPastDeadline && currentAddress && (
          <ActionButton
            label="Settle as lapsed"
            variant="ghost-danger"
            busy={isBusy("expire")}
            onClick={() => onExpire(listing)}
          />
        )}
      </div>
    </article>
  );
}

function ActionButton({
  label,
  variant,
  busy,
  onClick,
}: {
  label: string;
  variant: "primary" | "ghost-danger";
  busy: boolean;
  onClick: () => void;
}) {
  const base =
    "flex-1 rounded-stamp px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-wait";
  const styles =
    variant === "primary"
      ? "bg-cloth text-page hover:bg-spine"
      : "border border-overdue/30 text-overdue hover:bg-overdue/5";

  return (
    <button className={`${base} ${styles}`} disabled={busy} onClick={onClick}>
      {busy ? "Confirming…" : label}
    </button>
  );
}
