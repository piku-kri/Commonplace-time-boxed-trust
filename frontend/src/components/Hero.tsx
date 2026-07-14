interface HeroProps {
  availableCount: number;
  totalStaked: string;
  returnedCount: number;
}

export function Hero({ availableCount, totalStaked, returnedCount }: HeroProps) {
  return (
    <section className="border-b border-card card-catalog-lines">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="grid sm:grid-cols-[1.4fr,1fr] gap-10 items-end">
          <div>
            <p className="font-mono text-xs tracking-widest text-gilt uppercase mb-4">
              Borrowed · Returned · Trusted — nothing off the shelf
            </p>
            <h1 className="font-display text-[2.6rem] sm:text-6xl leading-[1.02] tracking-tight">
              A small deposit
              <br />
              <span className="italic text-cloth-soft">keeps the shelf</span>
              <br />
              honest for everyone.
            </h1>
            <p className="mt-5 max-w-md text-cloth-soft leading-relaxed">
              Stake a little XLM to borrow a book from a neighborhood
              box. Bring it back — or leave one behind — before the
              grace period ends, and your deposit returns along with a
              small boost to your standing in the community.
            </p>
          </div>

          <dl className="grid grid-cols-3 sm:grid-cols-1 gap-4 sm:gap-3 sm:border-l sm:border-card sm:pl-8">
            <StatRow label="On the shelf now" value={availableCount.toString()} accent="leaf" />
            <StatRow label="Currently staked" value={`${totalStaked} XLM`} accent="gilt" />
            <StatRow label="Fair exchanges" value={returnedCount.toString()} accent="cloth" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "leaf" | "gilt" | "cloth";
}) {
  const accentClass = {
    leaf: "text-leaf",
    gilt: "text-gilt",
    cloth: "text-cloth",
  }[accent];

  return (
    <div>
      <dd className={`font-mono text-2xl sm:text-3xl font-medium ${accentClass}`}>{value}</dd>
      <dt className="text-xs text-cloth-soft/70 mt-1">{label}</dt>
    </div>
  );
}
