import { STATUS_COLORS, STATUS_LABELS, type VehicleStatus } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const s = status as VehicleStatus;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[s] ?? "bg-zinc-100"}`}>
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
