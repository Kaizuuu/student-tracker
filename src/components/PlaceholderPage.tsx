export default function PlaceholderPage({
  title,
  description,
  symbol,
}: {
  title: string;
  description: string;
  symbol: string;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Student Tracker</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">{description}</p>

      <div className="mt-10 rounded-3xl border border-border bg-surface p-7 sm:p-9">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-background text-xl font-semibold text-accent" aria-hidden="true">
          {symbol}
        </div>
        <h2 className="mt-6 text-lg font-semibold">This space is ready for you</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
          The planner is being built one piece at a time. This screen will fill in as its features are added.
        </p>
      </div>
    </section>
  );
}
