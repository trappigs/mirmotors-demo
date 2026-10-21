export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_90%_0%,rgba(201,165,107,0.18),transparent_60%),linear-gradient(180deg,#0e1015,#111a2b)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="eyebrow-light">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
        {text && <p className="mt-4 max-w-xl text-zinc-400">{text}</p>}
      </div>
    </section>
  );
}
