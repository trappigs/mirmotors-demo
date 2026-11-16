import Link from "next/link";

export const WIZARD_STEPS = ["Araç bilgileri", "Kaporta, hasar ve yasal", "Fotoğraf ve video", "Kontrol ve yayın"] as const;

/** Sihirbaz adım çubuğu. Araç henüz oluşturulmadıysa (vehicleId yok) sonraki adımlara geçilemez. */
export function WizardSteps({ current, vehicleId, done = [] }: { current: number; vehicleId?: string; done?: number[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-4" data-testid="wizard-steps">
      {WIZARD_STEPS.map((label, i) => {
        const n = i + 1;
        const cls = `block rounded-lg border px-3 py-2 text-xs font-semibold ${n === current ? "border-ink bg-ink text-white" : done.includes(n) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-white text-zinc-500"}`;
        const text = <>{done.includes(n) && n !== current ? "✓ " : `${n}. `}{label}</>;
        return (
          <li key={label}>
            {vehicleId && n !== current ? <Link href={`/crm/vehicles/${vehicleId}/tamamla?adim=${n}`} className={`${cls} hover:border-zinc-500`}>{text}</Link> : <span className={cls} aria-current={n === current ? "step" : undefined}>{text}</span>}
          </li>
        );
      })}
    </ol>
  );
}
