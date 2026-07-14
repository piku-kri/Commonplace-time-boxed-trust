import { ListingStatus } from "@/lib/types";

const STYLES: Record<ListingStatus, string> = {
  Available: "bg-leaf/10 text-leaf border-leaf/30",
  Borrowed: "bg-gilt/10 text-gilt border-gilt/30",
  Returned: "bg-white text-cloth-soft border-card",
  Lapsed: "bg-overdue/10 text-overdue border-overdue/30",
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono tracking-wide uppercase ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
