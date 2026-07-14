export function ListingCardSkeleton() {
  return (
    <div className="rounded-stamp border border-card bg-white p-4 animate-pulse">
      <div className="h-5 bg-card/60 rounded w-3/4 mb-3" />
      <div className="h-3 bg-card/40 rounded w-full mb-2" />
      <div className="h-3 bg-card/40 rounded w-5/6 mb-4" />
      <div className="h-6 bg-card/50 rounded w-24 mb-3" />
      <div className="h-3 bg-card/30 rounded w-1/2" />
    </div>
  );
}
