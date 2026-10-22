export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="section-mark mt-2 max-w-3xl font-display text-3xl font-extrabold tracking-tight text-ink md:text-[40px]">{title}</h1>
        {text && <p className="mt-3 max-w-xl text-muted">{text}</p>}
      </div>
    </section>
  );
}
