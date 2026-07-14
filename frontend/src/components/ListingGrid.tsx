import { BookListing, ListingStatus } from "@/lib/types";
import { ListingCard } from "./ListingCard";
import { ListingCardSkeleton } from "./ListingCardSkeleton";

interface ListingGridProps {
  listings: BookListing[];
  isLoading: boolean;
  error: string | null;
  currentAddress: string | null;
  onBorrow: (listing: BookListing) => void;
  onReturn: (listing: BookListing) => void;
  onExpire: (listing: BookListing) => void;
  busyAction: string | null;
  onRetry: () => void;
}

const COLUMNS: { status: ListingStatus; label: string; hint: string }[] = [
  { status: "Available", label: "On the shelf", hint: "Ready to borrow" },
  { status: "Borrowed", label: "Checked out", hint: "Awaiting return" },
  { status: "Returned", label: "Returned", hint: "Fair exchange complete" },
  { status: "Lapsed", label: "Lapsed", hint: "Grace period expired" },
];

export function ListingGrid(props: ListingGridProps) {
  const { listings, isLoading, error, onRetry } = props;

  if (error) {
    return (
      <div className="rounded-stamp border border-overdue/30 bg-overdue/5 px-6 py-10 text-center">
        <p className="font-display text-lg text-overdue mb-1">The catalog couldn&apos;t load</p>
        <p className="text-sm text-cloth-soft mb-4 max-w-md mx-auto">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-stamp bg-cloth text-page px-4 py-2 text-sm font-medium hover:bg-spine transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {COLUMNS.map((col) => {
        const items = listings.filter((l) => l.status === col.status);
        return (
          <div key={col.status} className="min-w-0">
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h2 className="font-display text-base">{col.label}</h2>
              <span className="text-[11px] font-mono text-cloth-soft/50">
                {isLoading ? "···" : items.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {isLoading && (
                <>
                  <ListingCardSkeleton />
                  <ListingCardSkeleton />
                </>
              )}
              {!isLoading && items.length === 0 && (
                <div className="rounded-stamp border border-dashed border-card px-4 py-8 text-center">
                  <p className="text-xs text-cloth-soft/40">{col.hint}</p>
                </div>
              )}
              {!isLoading &&
                items.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    currentAddress={props.currentAddress}
                    onBorrow={props.onBorrow}
                    onReturn={props.onReturn}
                    onExpire={props.onExpire}
                    busyAction={props.busyAction}
                  />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
