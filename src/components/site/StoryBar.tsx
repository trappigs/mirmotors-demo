"use client";
import { useCallback, useState } from "react";
import type { Story } from "@/lib/home-stories";
import { StoryViewer } from "./StoryViewer";

/** Navbar altındaki Instagram benzeri story şeridi (yerel demo verisi). */
export function StoryBar({ stories, instagramUrl }: { stories: Story[]; instagramUrl?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const markSeen = useCallback((id: string) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id))), []);

  return (
    <section className="border-b border-line bg-white" aria-label="Mir Motors'ta bugün">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <div className="hidden shrink-0 items-center gap-3 border-r border-line pr-8 md:flex">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-bold text-ink">Mir Motors&apos;ta bugün</p>
            {instagramUrl ? (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted hover:text-brand">Instagram&apos;da takip et</a>
            ) : (
              <p className="text-[13px] text-muted" title="Instagram bağlantısı yayın öncesi eklenecek">Instagram · yakında</p>
            )}
          </div>
        </div>

        <ul className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:gap-4 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" data-testid="story-bar">
          {stories.map((s, i) => {
            const viewed = seen.has(s.id);
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className="group flex w-[78px] flex-col items-center gap-1.5 focus-visible:outline-none"
                  aria-label={`${s.label} story'sini aç`}
                  data-testid={`story-${s.id}`}
                >
                  <span className={`rounded-full p-[2.5px] transition ${viewed ? "bg-zinc-300" : "bg-gradient-to-tr from-brand to-[#e8434f]"} group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-2`}>
                    <span className="block rounded-full bg-white p-[2px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.cover} alt="" decoding="async" className="h-14 w-14 rounded-full object-cover" />
                    </span>
                  </span>
                  <span className={`line-clamp-2 w-full text-center text-[12px] font-medium leading-[1.2] ${viewed ? "text-muted" : "text-ink"} group-hover:text-brand`}>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {open !== null && <StoryViewer stories={stories} startIndex={open} onClose={() => setOpen(null)} onSeen={markSeen} />}
    </section>
  );
}
