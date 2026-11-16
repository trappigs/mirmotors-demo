import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatWaId, messageTypeLabel } from "@/lib/whatsapp-webhook";

export const dynamic = "force-dynamic";

/** WhatsApp gelen kutusu: solda kişiler (son mesaja göre), sağda seçilen kişinin mesajları. */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  await requireUser();
  const { k } = await searchParams;
  const selected = k && /^\d{6,20}$/.test(k) ? k : null;

  // Konuşma açılınca okunmuş sayılır (kişi listesindeki sayaç ondan önce hesaplanmasın diye önce işaretlenir).
  if (selected) await prisma.whatsAppMessage.updateMany({ where: { waId: selected, readAt: null }, data: { readAt: new Date() } });

  const [groups, unread] = await Promise.all([
    prisma.whatsAppMessage.groupBy({ by: ["waId"], _max: { sentAt: true }, orderBy: { _max: { sentAt: "desc" } }, take: 100 }),
    prisma.whatsAppMessage.groupBy({ by: ["waId"], where: { readAt: null }, _count: { _all: true } }),
  ]);
  const unreadBy = new Map(unread.map((u) => [u.waId, u._count._all]));
  const latest = await prisma.whatsAppMessage.findMany({
    where: { OR: groups.map((g) => ({ waId: g.waId, sentAt: g._max.sentAt! })) },
    orderBy: { sentAt: "desc" },
  });
  const latestBy = new Map<string, (typeof latest)[number]>();
  for (const m of latest) if (!latestBy.has(m.waId)) latestBy.set(m.waId, m);
  // Kişinin adı: mesajlardaki en son bilinen ad.
  const names = new Map<string, string>();
  if (groups.length) {
    const named = await prisma.whatsAppMessage.findMany({
      where: { waId: { in: groups.map((g) => g.waId) }, contactName: { not: null } },
      orderBy: { sentAt: "desc" }, distinct: ["waId"], select: { waId: true, contactName: true },
    });
    for (const n of named) names.set(n.waId, n.contactName!);
  }

  const thread = selected
    ? (await prisma.whatsAppMessage.findMany({ where: { waId: selected }, orderBy: { sentAt: "desc" }, take: 200 })).reverse()
    : [];

  const preview = (m: { type: string; text: string | null }) => m.text ?? `[${messageTypeLabel(m.type)}]`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">WhatsApp mesajları</h1>
        <p className="text-sm text-zinc-500">
          İşletme numarasına gelen mesajlar ve asistanın personele verdiği cevaplar. Buradan yanıt gönderilemez; fotoğraf, ses ve belgelerin yalnız türü görünür.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500" data-testid="messages-empty">
          Henüz mesaj yok.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
          <ul className={`divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white ${selected ? "hidden md:block" : ""}`} data-testid="messages-contacts">
            {groups.map((g) => {
              const m = latestBy.get(g.waId);
              const count = g.waId === selected ? 0 : unreadBy.get(g.waId) ?? 0;
              return (
                <li key={g.waId}>
                  <Link href={`/crm/mesajlar?k=${g.waId}`} className={`flex min-h-[64px] items-start gap-3 px-4 py-3 hover:bg-zinc-50 ${g.waId === selected ? "bg-zinc-100" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className={`truncate ${count ? "font-bold" : "font-semibold"}`}>{names.get(g.waId) ?? formatWaId(g.waId)}</span>
                        {m && <span className="shrink-0 text-xs text-zinc-500">{formatDateTime(m.sentAt)}</span>}
                      </p>
                      <p className="flex items-center justify-between gap-2 text-sm text-zinc-600">
                        <span className="truncate">{m ? preview(m) : ""}</span>
                        {count > 0 && <span className="shrink-0 rounded-full bg-accent px-2 text-xs font-bold text-white">{count}</span>}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <section className="flex min-h-[50vh] flex-col rounded-lg border border-zinc-200 bg-white" data-testid="messages-thread">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
                <div>
                  <Link href="/crm/mesajlar" className="mr-2 text-sm text-zinc-500 md:hidden">← Kişiler</Link>
                  <span className="font-semibold">{names.get(selected) ?? formatWaId(selected)}</span>
                  {names.has(selected) && <span className="ml-2 text-sm text-zinc-500">{formatWaId(selected)}</span>}
                </div>
                <a href={`tel:+${selected}`} className="btn-outline py-1.5 text-xs">Ara</a>
              </header>
              {thread.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500">Bu numaradan mesaj yok.</p>
              ) : (
                <ol className="flex-1 space-y-2 bg-[#f7f5f0] p-4">
                  {thread.map((m) => (
                    <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${m.direction === "OUT" ? "ml-auto rounded-tr-none bg-[#dcf8c6]" : "rounded-tl-none bg-white"}`}>
                      <p className={`whitespace-pre-wrap break-words text-sm ${m.text ? "" : "italic text-zinc-500"}`}>
                        {m.text && m.type !== "text" && <span className="mr-1 text-xs text-zinc-500">[{messageTypeLabel(m.type)}]</span>}
                        {preview(m)}
                      </p>
                      <p className="mt-1 text-right text-[11px] text-zinc-400">{m.direction === "OUT" && "Asistan · "}{formatDateTime(m.sentAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : (
            <p className="hidden items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 md:flex">
              Soldan bir kişi seçin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
