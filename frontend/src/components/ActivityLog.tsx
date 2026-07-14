"use client";

import { ActivityEvent } from "@/lib/types";
import { formatAddress, formatRelativeTime } from "@/lib/format";
import { EXPLORER_TX_URL } from "@/lib/config";

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  BoxRegistered: "NEW BOX",
  BookListed: "LISTED",
  BookBorrowed: "BORROWED",
  BookReturned: "RETURNED",
  LoanLapsed: "LAPSED",
};

const KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  BoxRegistered: "text-gilt",
  BookListed: "text-cloth-soft",
  BookBorrowed: "text-gilt",
  BookReturned: "text-leaf",
  LoanLapsed: "text-overdue",
};

export function ActivityLog({ events }: { events: ActivityEvent[] }) {
  return (
    <aside className="rounded-stamp border border-card bg-spine text-page overflow-hidden card-edge">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="font-mono text-[11px] tracking-widest uppercase text-gilt">
          Circulation Desk — Live
        </p>
        <span className="flex items-center gap-1.5 text-[11px] font-mono text-page/50">
          <span className="w-1.5 h-1.5 rounded-full bg-leaf status-dot" />
          streaming
        </span>
      </div>

      <div className="catalog-scroll max-h-[420px] overflow-y-auto divide-y divide-white/5">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-page/50 font-mono">No activity logged this session.</p>
            <p className="text-xs text-page/30 mt-1">
              List, borrow, or return a book to see it land here, live.
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="px-4 py-3 flex items-start gap-3 animate-stamp">
              <span
                className={`font-mono text-[10px] font-semibold tracking-wider mt-0.5 w-20 flex-shrink-0 ${KIND_COLOR[event.kind]}`}
              >
                {KIND_LABEL[event.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-page/90 truncate">{event.detail}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-page/40">
                    {formatAddress(event.actor)}
                  </span>
                  <span className="text-[11px] text-page/30">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                  {event.txHash && (
                    <a
                      href={EXPLORER_TX_URL(event.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-gilt hover:text-cloth-soft transition-colors"
                    >
                      view tx ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
